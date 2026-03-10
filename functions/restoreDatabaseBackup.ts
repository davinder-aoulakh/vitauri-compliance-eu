import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// Entities that support restore (excludes User which is managed by auth)
const RESTORABLE_ENTITIES = [
  'Tenant', 'Entity', 'Account', 'ControllingPerson', 'Beneficiary',
  'CRSReport', 'AuditLog', 'Workflow', 'WorkflowVersion', 'WorkflowAnalytics',
  'WorkflowComponent', 'WorkflowIntegration', 'DashboardConfiguration',
  'DashboardTemplate', 'FormConfiguration', 'ReferencedData', 'CrsCountryInfo',
  'JurisdictionConfig', 'CustomValidationRule', 'AutoClassificationRule',
  'EntityClassificationHistory', 'AccountClassificationHistory',
  'ControllingPersonClassificationHistory', 'RolePermission', 'PlatformSettings'
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.app_role !== 'super_admin') {
      return Response.json({ error: 'Forbidden: Super admin access required' }, { status: 403 });
    }

    const { backup, entities_to_restore, data_env } = await req.json();
    const dataEnv = data_env === 'dev' ? 'dev' : 'prod';

    if (!backup || !backup.entities) {
      return Response.json({ error: 'Invalid backup file format' }, { status: 400 });
    }

    const entitiesToRestore = entities_to_restore || RESTORABLE_ENTITIES;
    const report = { success: [], failed: [], skipped: [] };

    for (const entityName of entitiesToRestore) {
      if (!RESTORABLE_ENTITIES.includes(entityName)) {
        report.skipped.push({ entity: entityName, reason: 'Not in restorable list' });
        continue;
      }

      const records = backup.entities[entityName];
      if (!records || records.length === 0) {
        report.skipped.push({ entity: entityName, reason: 'No records in backup' });
        continue;
      }

      try {
        // Fetch existing records and delete them
        const existing = await base44.asServiceRole.entities[entityName].list('-created_date', 10000, { data_env: dataEnv });
        for (const record of existing) {
          await base44.asServiceRole.entities[entityName].delete(record.id, { data_env: dataEnv });
        }

        // Re-insert records from backup in batches of 50
        const BATCH_SIZE = 50;
        for (let i = 0; i < records.length; i += BATCH_SIZE) {
          const batch = records.slice(i, i + BATCH_SIZE).map(record => {
            // Strip system-managed fields so the DB assigns new ones correctly
            const { created_date, updated_date, created_by_id, entity_name, app_id, ...data } = record;
            return data;
          });
          await base44.asServiceRole.entities[entityName].bulkCreate(batch, { data_env: dataEnv });
        }

        report.success.push({ entity: entityName, records_restored: records.length });
      } catch (err) {
        report.failed.push({ entity: entityName, reason: err.message });
      }
    }

    return Response.json({
      success: true,
      report,
      summary: {
        restored: report.success.length,
        failed: report.failed.length,
        skipped: report.skipped.length
      }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});