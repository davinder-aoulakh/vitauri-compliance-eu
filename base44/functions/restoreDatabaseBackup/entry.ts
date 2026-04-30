import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Entities that support restore (excludes User which is managed by auth)
const RESTORABLE_ENTITIES = [
  'Tenant', 'Entity', 'Account', 'ControllingPerson', 'Beneficiary',
  'CRSReport', 'AuditLog', 'Workflow', 'WorkflowVersion', 'WorkflowAnalytics',
  'WorkflowComponent', 'WorkflowIntegration', 'DashboardConfiguration',
  'DashboardTemplate', 'FormConfiguration', 'ReferencedData', 'CrsCountryInfo',
  'JurisdictionConfig', 'CustomValidationRule', 'AutoClassificationRule',
  'EntityClassificationHistory', 'AccountClassificationHistory',
  'ControllingPersonClassificationHistory', 'RolePermission', 'PlatformSettings',
  'Ticket', 'TicketComment'
];

// Foreign key relationships: which fields in child entities reference parent entity IDs
const ENTITY_RELATIONSHIPS = {
  Entity:                            [{ field: 'tenant_id', referencesEntity: 'Tenant' }],
  Account:                           [{ field: 'tenant_id', referencesEntity: 'Tenant' },
                                      { field: 'entity_id', referencesEntity: 'Entity' }],
  ControllingPerson:                 [{ field: 'tenant_id', referencesEntity: 'Tenant' },
                                      { field: 'account_id', referencesEntity: 'Account' }],
  Beneficiary:                       [{ field: 'tenant_id', referencesEntity: 'Tenant' },
                                      { field: 'account_id', referencesEntity: 'Account' }],
  CRSReport:                         [{ field: 'tenant_id', referencesEntity: 'Tenant' },
                                      { field: 'entity_id', referencesEntity: 'Entity' }],
  AuditLog:                          [{ field: 'tenant_id', referencesEntity: 'Tenant' }],
  DashboardConfiguration:            [{ field: 'tenant_id', referencesEntity: 'Tenant' }],
  CustomValidationRule:              [{ field: 'tenant_id', referencesEntity: 'Tenant' }],
  AccountClassificationHistory:      [{ field: 'tenant_id', referencesEntity: 'Tenant' },
                                      { field: 'account_id', referencesEntity: 'Account' }],
  EntityClassificationHistory:       [{ field: 'tenant_id', referencesEntity: 'Tenant' },
                                      { field: 'entity_id', referencesEntity: 'Entity' }],
  ControllingPersonClassificationHistory: [{ field: 'tenant_id', referencesEntity: 'Tenant' },
                                           { field: 'account_id', referencesEntity: 'Account' }],
  WorkflowVersion:                   [{ field: 'workflow_id', referencesEntity: 'Workflow' }],
  WorkflowAnalytics:                 [{ field: 'workflow_id', referencesEntity: 'Workflow' },
                                      { field: 'tenant_id', referencesEntity: 'Tenant' }],
  Ticket:                            [{ field: 'tenant_id', referencesEntity: 'Tenant' }],
  TicketComment:                     [{ field: 'tenant_id', referencesEntity: 'Tenant' },
                                      { field: 'ticket_id', referencesEntity: 'Ticket' }],
};

// System fields to strip during upsert (never send these to create/update)
const SYSTEM_FIELDS = new Set(['created_date', 'updated_date', 'created_by_id', 'app_id']);

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Fetch ALL records for an entity (paginates through all pages)
async function fetchAllRecords(entityApi, dataEnvOpts) {
  const all = [];
  let skip = 0;
  const PAGE_SIZE = 100;
  while (true) {
    const page = await entityApi.list('-created_date', PAGE_SIZE, dataEnvOpts ? { ...dataEnvOpts, skip } : { skip });
    if (!page || page.length === 0) break;
    all.push(...page);
    if (page.length < PAGE_SIZE) break;
    skip += PAGE_SIZE;
    await sleep(100);
  }
  return all;
}

// Strip system-managed fields from a record before create/update
function cleanRecord(record) {
  const cleaned = {};
  for (const [k, v] of Object.entries(record)) {
    if (!SYSTEM_FIELDS.has(k)) cleaned[k] = v;
  }
  return cleaned;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.app_role !== 'super_admin') {
      return Response.json({ error: 'Forbidden: Super admin access required' }, { status: 403 });
    }

    const body = await req.json();
    const {
      entity_name,
      records,
      data_env,
      id_map_input,
      // Chunking control flags:
      // is_final_chunk: true  → run Phase 3 (delete stale records) after upserting
      // is_final_chunk: false → skip Phase 3 (more chunks coming)
      // accumulated_id_map: the entity-level id map built from previous chunks of the SAME entity
      is_final_chunk = true,
      accumulated_id_map = {},
      // all_backup_ids: full set of backup IDs for this entity (used in Phase 3 delete on final chunk)
      all_backup_ids = null,
    } = body;

    const dataEnv = data_env === 'dev' ? 'dev' : 'prod';
    const dataEnvOpts = dataEnv === 'dev' ? { data_env: 'dev' } : null;

    if (!entity_name || !records) {
      return Response.json({ error: 'entity_name and records are required' }, { status: 400 });
    }
    if (!RESTORABLE_ENTITIES.includes(entity_name)) {
      return Response.json({ error: `Entity '${entity_name}' is not in the restorable list` }, { status: 400 });
    }
    if (!records || records.length === 0) {
      return Response.json({
        success: true,
        skipped: true,
        message: 'No records to restore',
        stats: { updated: 0, inserted: 0, deleted: 0, id_remapped: 0 },
        id_map: {}
      });
    }

    const entityApi = base44.asServiceRole.entities[entity_name];

    // Global cross-entity ID map (parent entities already restored)
    const globalIdMap = id_map_input || {};

    // ── PHASE 0: Fetch all existing DB records ─────────────────────────────────
    // Only needed on first chunk (or single-chunk) to get the existingById map,
    // and also on the final chunk for the delete phase.
    // We always fetch here — chunk calls are short-lived so this stays fast.
    console.log(`[restore:${entity_name}] Fetching existing records from DB...`);
    const existingRecords = await fetchAllRecords(entityApi, dataEnvOpts);
    const existingById = new Map(existingRecords.map(r => [r.id, r]));

    // Build set of this chunk's backup IDs
    const chunkBackupIdSet = new Set(records.map(r => r.id));

    // Stats for THIS chunk
    const stats = { updated: 0, inserted: 0, deleted: 0, id_remapped: 0 };

    // Merge previous chunk id maps for this entity into localIdMap
    const localIdMap = { ...accumulated_id_map };

    // ── PHASE 1: UPSERT this chunk ─────────────────────────────────────────────
    console.log(`[restore:${entity_name}] Upserting chunk of ${records.length} records...`);

    for (const backupRecord of records) {
      const backupId = backupRecord.id;

      const recordToWrite = cleanRecord({ ...backupRecord });

      // Remap foreign keys based on globalIdMap from parent entities
      const relationships = ENTITY_RELATIONSHIPS[entity_name] || [];
      for (const rel of relationships) {
        const oldRefId = recordToWrite[rel.field];
        if (oldRefId && globalIdMap[rel.referencesEntity]?.[oldRefId]) {
          recordToWrite[rel.field] = globalIdMap[rel.referencesEntity][oldRefId];
        }
      }

      if (existingById.has(backupId)) {
        // ── Record EXISTS → UPDATE ──────────────────────────────────────────
        try {
          await entityApi.update(backupId, recordToWrite, dataEnvOpts || undefined);
          stats.updated++;
          localIdMap[backupId] = backupId;
        } catch (e) {
          console.error(`[restore:${entity_name}] Update failed for id=${backupId}:`, e.message);
        }
      } else {
        // ── Record DOES NOT EXIST → INSERT ─────────────────────────────────
        try {
          const insertPayload = { id: backupId, ...recordToWrite };
          let inserted;
          try {
            inserted = await entityApi.create(insertPayload, dataEnvOpts || undefined);
          } catch {
            const { id: _omit, ...withoutId } = recordToWrite;
            inserted = await entityApi.create(withoutId, dataEnvOpts || undefined);
          }

          const newId = inserted?.id || backupId;
          localIdMap[backupId] = newId;

          if (newId !== backupId) {
            stats.id_remapped++;
            console.log(`[restore:${entity_name}] ID remapped: ${backupId} → ${newId}`);
          }
          stats.inserted++;
        } catch (e) {
          console.error(`[restore:${entity_name}] Insert failed for id=${backupId}:`, e.message);
        }
      }

      await sleep(50);
    }

    // ── PHASE 3: DELETE STALE RECORDS — only on final chunk ───────────────────
    if (is_final_chunk) {
      console.log(`[restore:${entity_name}] Final chunk — running Phase 3 (delete stale records)...`);

      // The complete set of backup IDs for this entity (passed by frontend from all chunks combined)
      const fullBackupIdSet = all_backup_ids ? new Set(all_backup_ids) : chunkBackupIdSet;

      // All new IDs that now exist after this full restore (old_id → new_id values)
      const expectedNewIds = new Set(Object.values(localIdMap));

      for (const existingRecord of existingRecords) {
        const dbId = existingRecord.id;
        if (!fullBackupIdSet.has(dbId) && !expectedNewIds.has(dbId)) {
          try {
            await entityApi.delete(dbId, dataEnvOpts || undefined);
            stats.deleted++;
            await sleep(80);
          } catch (e) {
            console.error(`[restore:${entity_name}] Delete failed for id=${dbId}:`, e.message);
          }
        }
      }
    } else {
      console.log(`[restore:${entity_name}] Intermediate chunk — skipping Phase 3 (more chunks pending).`);
    }

    console.log(`[restore:${entity_name}] Chunk done — updated:${stats.updated} inserted:${stats.inserted} deleted:${stats.deleted} remapped:${stats.id_remapped}`);

    return Response.json({
      success: true,
      entity: entity_name,
      stats,
      id_map: localIdMap  // Accumulated map for this entity — returned so frontend can pass to next chunk/entity
    });

  } catch (error) {
    console.error('[restoreDatabaseBackup] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});