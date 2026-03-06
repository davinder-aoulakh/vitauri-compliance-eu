import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const ENTITIES = [
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

    // Allow both scheduled (no user) and manual invocation (super admin only)
    let calledByUser = false;
    try {
      const user = await base44.auth.me();
      if (user && user.app_role !== 'super_admin') {
        return Response.json({ error: 'Forbidden: Super admin access required' }, { status: 403 });
      }
      calledByUser = true;
    } catch {
      // Called by scheduler — no user session, that's fine
    }

    const exportedAt = new Date().toISOString();
    const backup = {
      metadata: {
        exported_at: exportedAt,
        exported_by: calledByUser ? 'manual' : 'scheduled',
        app_version: '1.0',
        entity_count: ENTITIES.length
      },
      entities: {}
    };

    const results = await Promise.allSettled(
      ENTITIES.map(async (entityName) => {
        try {
          const records = await base44.asServiceRole.entities[entityName].list();
          return { entityName, records: records || [] };
        } catch {
          return { entityName, records: [] };
        }
      })
    );

    let totalRecords = 0;
    for (const result of results) {
      if (result.status === 'fulfilled') {
        const { entityName, records } = result.value;
        backup.entities[entityName] = records;
        totalRecords += records.length;
      }
    }

    backup.metadata.total_records = totalRecords;

    // Store backup record in PlatformSettings for audit trail
    try {
      await base44.asServiceRole.entities.PlatformSettings.create({
        setting_key: 'scheduled_backup_log',
        setting_value: {
          exported_at: exportedAt,
          exported_by: calledByUser ? 'manual_adhoc' : 'scheduled_daily',
          total_records: totalRecords,
          entity_count: ENTITIES.length
        }
      });
    } catch {
      // Non-fatal — log entry creation failure should not block the backup
    }

    console.log(`[ScheduledBackup] Completed at ${exportedAt} — ${totalRecords} records across ${ENTITIES.length} entities.`);

    return Response.json({
      success: true,
      metadata: backup.metadata,
      backup
    });
  } catch (error) {
    console.error('[ScheduledBackup] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});