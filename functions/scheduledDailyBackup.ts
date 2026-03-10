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

async function purgeExpiredBackups(base44) {
  try {
    const allBackups = await base44.asServiceRole.entities.BackupStorage.list();
    const now = new Date();
    const expired = allBackups.filter(b => b.expires_at && new Date(b.expires_at) < now);
    for (const b of expired) {
      await base44.asServiceRole.entities.BackupStorage.delete(b.id);
    }
    console.log(`[ScheduledBackup] Purged ${expired.length} expired backup records.`);
  } catch (e) {
    console.error('[ScheduledBackup] Purge failed:', e.message);
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const body = await req.json().catch(() => ({}));
    const dataEnv = body.data_env === 'dev' ? 'dev' : 'prod';

    let exportedBy = 'scheduled';
    let backupType = 'scheduled';
    try {
      const user = await base44.auth.me();
      if (user && user.app_role !== 'super_admin') {
        return Response.json({ error: 'Forbidden: Super admin access required' }, { status: 403 });
      }
      if (user) {
        exportedBy = user.email;
        backupType = 'adhoc';
      }
    } catch {
      // Called by scheduler — no user session
    }

    const exportedAt = new Date().toISOString();
    const retentionDays = await getRetentionDays(base44);
    const expiresAt = new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000).toISOString();

    const backup = {
      metadata: {
        exported_at: exportedAt,
        exported_by: exportedBy,
        app_version: '1.0',
        backup_type: backupType,
        entity_count: ENTITIES.length,
        data_env: dataEnv
      },
      entities: {}
    };

    const results = await Promise.allSettled(
      ENTITIES.map(async (entityName) => {
        try {
          const records = dataEnv === 'dev'
            ? await base44.asServiceRole.entities[entityName].list('-created_date', 10000, { data_env: 'dev' })
            : await base44.asServiceRole.entities[entityName].list('-created_date', 10000);
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

    // Upload backup to file storage
    const fileName = `crs_${backupType}_backup_${exportedAt.replace(/[:.]/g, '-')}.json`;
    const fileContent = JSON.stringify(backup, null, 2);
    const fileBlob = new File([fileContent], fileName, { type: 'application/json' });

    let fileUrl = null;
    try {
      const uploadRes = await base44.asServiceRole.integrations.Core.UploadFile({ file: fileBlob });
      fileUrl = uploadRes.file_url;
      console.log(`[ScheduledBackup] File stored at: ${fileUrl}`);
    } catch (e) {
      console.error('[ScheduledBackup] File upload failed:', e.message);
    }

    // Log to BackupStorage entity
    try {
      await base44.asServiceRole.entities.BackupStorage.create({
        backup_type: backupType,
        file_url: fileUrl,
        file_name: fileName,
        total_records: totalRecords,
        entity_count: ENTITIES.length,
        exported_by: exportedBy,
        exported_at: exportedAt,
        expires_at: expiresAt,
        status: 'completed'
      });
    } catch (e) {
      console.error('[ScheduledBackup] BackupStorage log failed:', e.message);
    }

    // Purge expired backups
    await purgeExpiredBackups(base44);

    console.log(`[ScheduledBackup] Completed at ${exportedAt} — ${totalRecords} records across ${ENTITIES.length} entities. Type: ${backupType}`);

    return Response.json({
      success: true,
      metadata: { ...backup.metadata, total_records: totalRecords },
      file_url: fileUrl,
      backup
    });
  } catch (error) {
    console.error('[ScheduledBackup] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});