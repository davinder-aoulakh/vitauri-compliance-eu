import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// Only backup configuration/reference entities - operational data (Accounts, etc.) is too large
const ENTITY_NAMES = [
  'Tenant', 'Entity', 'Workflow', 'WorkflowVersion',
  'CRSReport', 'ReferencedData', 'CrsCountryInfo',
  'DashboardConfiguration', 'FormConfiguration',
  'JurisdictionConfig', 'CustomValidationRule', 'PlatformSettings'
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

    const backup = {
      backup_date: new Date().toISOString(),
      backed_up_by: user.email,
      note: 'Configuration and reference data backup. Operational data (Accounts, ControllingPersons, Beneficiaries, etc.) must be exported separately.',
      entities: {},
      entity_counts: {}
    };

    for (const name of ENTITY_NAMES) {
      try {
        const records = await base44.asServiceRole.entities[name].list('-created_date', 1000);
        backup.entities[name] = records;
        backup.entity_counts[name] = records.length;
      } catch {
        backup.entities[name] = [];
        backup.entity_counts[name] = 0;
      }
    }

    const jsonStr = JSON.stringify(backup);
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