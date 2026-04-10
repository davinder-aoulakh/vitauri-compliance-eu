import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// Entities that support restore (excludes User which is managed by auth)
const RESTORABLE_ENTITIES = [
  'Tenant', 'Entity', 'Account', 'ControllingPerson', 'Beneficiary',
  'CRSReport', 'AuditLog', 'Workflow', 'WorkflowVersion', 'WorkflowAnalytics',
  'WorkflowComponent', 'WorkflowIntegration', 'DashboardConfiguration',
  'DashboardTemplate', 'FormConfiguration', 'ReferencedData', 'CrsCountryInfo',
  'JurisdictionConfig', 'CustomValidationRule', 'AutoClassificationRule',
  'EntityClassificationHistory', 'AccountClassificationHistory',
  'ControllingPersonClassificationHistory', 'RolePermission', 'PlatformSettings', 'Ticket', 'TicketComment'
];

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.app_role !== 'super_admin') {
      return Response.json({ error: 'Forbidden: Super admin access required' }, { status: 403 });
    }

    const { entity_name, records, data_env } = await req.json();
    const dataEnv = data_env === 'dev' ? 'dev' : 'prod';

    if (!entity_name || !records) {
      return Response.json({ error: 'entity_name and records are required' }, { status: 400 });
    }

    if (!RESTORABLE_ENTITIES.includes(entity_name)) {
      return Response.json({ error: `Entity '${entity_name}' is not in the restorable list` }, { status: 400 });
    }

    if (!records || records.length === 0) {
      return Response.json({ success: true, skipped: true, message: 'No records to restore', records_restored: 0 });
    }

    // ── Deletion phase: fetch in batches of 50, delete one by one with throttling ──
    let iterations = 0;
    const MAX_ITERATIONS = 200;

    while (iterations < MAX_ITERATIONS) {
      const existing = await base44.asServiceRole.entities[entity_name].list('-created_date', 50,
        dataEnv === 'dev' ? { data_env: 'dev' } : undefined
      );
      if (!existing || existing.length === 0) break;

      for (const record of existing) {
        await base44.asServiceRole.entities[entity_name].delete(
          record.id,
          dataEnv === 'dev' ? { data_env: 'dev' } : undefined
        );
        await sleep(80);
      }
      await sleep(300);
      iterations++;
    }

    // ── Insertion phase: insert in batches of 25 with throttling ──
    const INSERT_BATCH_SIZE = 25;
    for (let i = 0; i < records.length; i += INSERT_BATCH_SIZE) {
      const batch = records.slice(i, i + INSERT_BATCH_SIZE).map(record => {
        // Strip system-managed fields so the DB assigns new ones correctly
        const { created_date, updated_date, created_by_id, entity_name: _en, app_id, ...data } = record;
        return data;
      });

      await base44.asServiceRole.entities[entity_name].bulkCreate(
        batch,
        dataEnv === 'dev' ? { data_env: 'dev' } : undefined
      );
      await sleep(300);
    }

    console.log(`[restoreDatabaseBackup] Restored ${records.length} records for entity: ${entity_name}`);
    return Response.json({
      success: true,
      entity: entity_name,
      records_restored: records.length
    });

  } catch (error) {
    console.error('[restoreDatabaseBackup] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});