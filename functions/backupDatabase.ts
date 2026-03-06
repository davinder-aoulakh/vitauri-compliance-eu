import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const ENTITY_NAMES = [
  'Tenant', 'Entity', 'Workflow', 'CRSReport',
  'ReferencedData', 'CrsCountryInfo', 'DashboardConfiguration',
  'FormConfiguration', 'JurisdictionConfig', 'CustomValidationRule', 'PlatformSettings'
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

    const results = await Promise.allSettled(
      ENTITY_NAMES.map(async (name) => {
        const records = await base44.asServiceRole.entities[name].list('-created_date', 100);
        return { name, records };
      })
    );

    for (const r of results) {
      if (r.status === 'fulfilled') {
        backup.entities[r.value.name] = r.value.records;
        backup.entity_counts[r.value.name] = r.value.records.length;
      } else {
        const name = ENTITY_NAMES[results.indexOf(r)];
        backup.entities[name] = [];
        backup.entity_counts[name] = 0;
      }
    }

    const jsonStr = JSON.stringify(backup);
    const filename = `backup_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    const formData = new FormData();
    formData.append('file', new Blob([jsonStr], { type: 'application/json' }), filename);

    // Use fetch directly to upload as multipart form
    const appId = Deno.env.get('BASE44_APP_ID');
    const uploadResp = await fetch(`https://api.base44.com/api/apps/${appId}/files/upload`, {
      method: 'POST',
      headers: { 'X-API-Key': req.headers.get('X-API-Key') || '' },
      body: formData
    });
    const uploadResult = await uploadResp.json();

    return Response.json({
      file_url: uploadResult.file_url,
      entity_counts: backup.entity_counts,
      backup_date: backup.backup_date
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});