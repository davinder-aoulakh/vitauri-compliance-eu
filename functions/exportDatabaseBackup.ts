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
    const user = await base44.auth.me();

    if (!user || user.app_role !== 'super_admin') {
      return Response.json({ error: 'Forbidden: Super admin access required' }, { status: 403 });
    }

    const backup = {
      metadata: {
        exported_at: new Date().toISOString(),
        exported_by: user.email,
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

    return Response.json(backup);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});