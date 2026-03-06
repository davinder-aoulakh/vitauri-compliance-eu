import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const ENTITY_NAMES = [
  'Tenant', 'Entity', 'Account', 'Workflow', 'WorkflowVersion',
  'AuditLog', 'CRSReport', 'Beneficiary', 'ControllingPerson',
  'ReferencedData', 'CrsCountryInfo', 'DashboardConfiguration',
  'FormConfiguration', 'JurisdictionConfig', 'CustomValidationRule',
  'WorkflowComponent', 'WorkflowAnalytics', 'DatabaseBackup',
  'EntityClassificationHistory', 'AccountClassificationHistory',
  'ControllingPersonClassificationHistory', 'AutoClassificationRule',
  'RolePermission', 'PlatformSettings', 'DashboardTemplate'
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (user.app_role !== 'super_admin') {
      return Response.json({ error: 'Forbidden: Super admin access required' }, { status: 403 });
    }

    const backup = { backup_date: new Date().toISOString(), entities: {}, entity_counts: {} };

    const results = await Promise.allSettled(
      ENTITY_NAMES.map(async (entityName) => {
        const records = await base44.asServiceRole.entities[entityName].list('-created_date', 5000);
        return { entityName, records };
      })
    );

    for (const result of results) {
      const entityName = result.value?.entityName || ENTITY_NAMES[results.indexOf(result)];
      if (result.status === 'fulfilled') {
        backup.entities[entityName] = result.value.records;
        backup.entity_counts[entityName] = result.value.records.length;
      } else {
        backup.entities[entityName] = [];
        backup.entity_counts[entityName] = 0;
      }
    }

    const jsonStr = JSON.stringify(backup, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });

    const uploadResult = await base44.asServiceRole.integrations.Core.UploadFile({ file: blob });

    return Response.json({
      file_url: uploadResult.file_url,
      entity_counts: backup.entity_counts,
      backup_date: backup.backup_date
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});