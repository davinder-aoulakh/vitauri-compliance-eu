import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const ENTITY_NAMES = [
  'Tenant', 'Entity', 'Workflow', 'WorkflowVersion',
  'CRSReport', 'ReferencedData', 'CrsCountryInfo',
  'DashboardConfiguration', 'FormConfiguration',
  'JurisdictionConfig', 'CustomValidationRule', 'PlatformSettings'
];

// Heavier entities fetched with limit to avoid timeout
const LARGE_ENTITY_NAMES = [
  'Account', 'Beneficiary', 'ControllingPerson',
  'EntityClassificationHistory', 'AccountClassificationHistory'
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
      entities: {},
      entity_counts: {}
    };

    // Fetch smaller entities in parallel
    const smallResults = await Promise.allSettled(
      ENTITY_NAMES.map(async (name) => {
        const records = await base44.asServiceRole.entities[name].list('-created_date', 500);
        return { name, records };
      })
    );
    for (const r of smallResults) {
      if (r.status === 'fulfilled') {
        backup.entities[r.value.name] = r.value.records;
        backup.entity_counts[r.value.name] = r.value.records.length;
      }
    }

    // Fetch larger entities sequentially with lower limit
    for (const name of LARGE_ENTITY_NAMES) {
      try {
        const records = await base44.asServiceRole.entities[name].list('-created_date', 200);
        backup.entities[name] = records;
        backup.entity_counts[name] = records.length;
      } catch {
        backup.entities[name] = [];
        backup.entity_counts[name] = 0;
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