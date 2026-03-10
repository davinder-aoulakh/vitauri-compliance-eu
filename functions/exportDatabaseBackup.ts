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

async function getRetentionDays(base44) {
  try {
    const settings = await base44.asServiceRole.entities.PlatformSettings.filter({ setting_key: 'backup_retention_days' });
    return settings[0]?.setting_value?.days || 90;
  } catch {
    return 90;
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.app_role !== 'super_admin') {
      return Response.json({ error: 'Forbidden: Super admin access required' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const mode = body.mode || 'full';
    const targetEntity = body.entity || null;
    const dataEnv = body.data_env === 'dev' ? 'dev' : 'prod';

    const exportedAt = new Date().toISOString();
    const retentionDays = await getRetentionDays(base44);
    const expiresAt = new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000).toISOString();

    // ── Single-table mode ──────────────────────────────────────────────────────
    if (mode === 'table' && targetEntity) {
      if (!ENTITIES.includes(targetEntity)) {
        return Response.json({ error: `Unknown entity: ${targetEntity}` }, { status: 400 });
      }
      const records = await base44.asServiceRole.entities[targetEntity].list('-created_date', 10000, { data_env: dataEnv });
      const backup = {
        metadata: {
          exported_at: exportedAt,
          exported_by: user.email,
          mode: 'table',
          entity: targetEntity,
          total_records: records.length,
          data_env: dataEnv
        },
        entity: targetEntity,
        records: records || []
      };

      // Upload to file storage
      const fileName = `crs_${targetEntity}_${exportedAt.replace(/[:.]/g, '-')}.json`;
      const fileBlob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const formData = new FormData();
      formData.append('file', fileBlob, fileName);

      let fileUrl = null;
      try {
        const uploadRes = await base44.asServiceRole.integrations.Core.UploadFile({ file: fileBlob });
        fileUrl = uploadRes.file_url;
      } catch (e) {
        console.error('File upload failed:', e.message);
      }

      // Log to BackupStorage
      try {
        await base44.asServiceRole.entities.BackupStorage.create({
          backup_type: 'table_export',
          entity_name: targetEntity,
          file_url: fileUrl,
          file_name: fileName,
          total_records: records.length,
          entity_count: 1,
          exported_by: user.email,
          exported_at: exportedAt,
          expires_at: expiresAt,
          status: 'completed'
        });
      } catch (e) {
        console.error('BackupStorage log failed:', e.message);
      }

      return Response.json({ ...backup, file_url: fileUrl });
    }

    // ── Full database mode ─────────────────────────────────────────────────────
    const backup = {
      metadata: {
        exported_at: exportedAt,
        exported_by: user.email,
        app_version: '1.0',
        mode: 'full',
        entity_count: ENTITIES.length
      },
      entities: {}
    };

    const results = await Promise.allSettled(
      ENTITIES.map(async (entityName) => {
        try {
          const records = await base44.asServiceRole.entities[entityName].list('-created_date', 10000, { data_env: dataEnv });
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

    // Upload to file storage
    const fileName = `crs_full_backup_${exportedAt.replace(/[:.]/g, '-')}.json`;
    const fileBlob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });

    let fileUrl = null;
    try {
      const uploadRes = await base44.asServiceRole.integrations.Core.UploadFile({ file: fileBlob });
      fileUrl = uploadRes.file_url;
    } catch (e) {
      console.error('File upload failed:', e.message);
    }

    // Log to BackupStorage
    try {
      await base44.asServiceRole.entities.BackupStorage.create({
        backup_type: 'full_export',
        file_url: fileUrl,
        file_name: fileName,
        total_records: totalRecords,
        entity_count: ENTITIES.length,
        exported_by: user.email,
        exported_at: exportedAt,
        expires_at: expiresAt,
        status: 'completed'
      });
    } catch (e) {
      console.error('BackupStorage log failed:', e.message);
    }

    return Response.json({ ...backup, file_url: fileUrl });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});