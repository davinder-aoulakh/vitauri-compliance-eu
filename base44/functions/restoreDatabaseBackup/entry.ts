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
// Format: { childEntity: [{ field: 'field_name', referencesEntity: 'ParentEntity' }] }
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
    const { entity_name, records, data_env, id_map_input } = body;
    const dataEnv = data_env === 'dev' ? 'dev' : 'prod';
    const dataEnvOpts = dataEnv === 'dev' ? { data_env: 'dev' } : null;

    if (!entity_name || !records) {
      return Response.json({ error: 'entity_name and records are required' }, { status: 400 });
    }
    if (!RESTORABLE_ENTITIES.includes(entity_name)) {
      return Response.json({ error: `Entity '${entity_name}' is not in the restorable list` }, { status: 400 });
    }
    if (!records || records.length === 0) {
      return Response.json({ success: true, skipped: true, message: 'No records to restore', stats: { updated: 0, inserted: 0, deleted: 0, id_remapped: 0 } });
    }

    const entityApi = base44.asServiceRole.entities[entity_name];

    // ── Ingest the global ID map built from previously restored entities ──────
    // id_map_input: { EntityName: { old_id: new_id, ... }, ... }
    const globalIdMap = id_map_input || {};

    // ── PHASE 0: Fetch all existing records from DB ────────────────────────────
    console.log(`[restore:${entity_name}] Fetching existing records...`);
    const existingRecords = await fetchAllRecords(entityApi, dataEnvOpts);
    const existingById = new Map(existingRecords.map(r => [r.id, r]));

    // Build a set of backup IDs for quick lookup
    const backupIdSet = new Set(records.map(r => r.id));

    // Track stats
    const stats = { updated: 0, inserted: 0, deleted: 0, id_remapped: 0 };
    // old_id → new_id mapping for records that get new IDs on insert
    const localIdMap = {}; // { old_id: new_id }

    // ── PHASE 1: UPSERT (Update existing, insert missing) ──────────────────────
    console.log(`[restore:${entity_name}] Phase 1: Upserting ${records.length} records...`);

    for (const backupRecord of records) {
      const backupId = backupRecord.id;

      // Apply any foreign key remappings from previously restored parent entities
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
          // No ID change — map to itself so Phase 3 knows this ID is still valid
          localIdMap[backupId] = backupId;
        } catch (e) {
          console.error(`[restore:${entity_name}] Update failed for id=${backupId}:`, e.message);
        }
      } else {
        // ── Record DOES NOT EXIST → INSERT ─────────────────────────────────
        try {
          // Try to preserve the original ID
          const insertPayload = { id: backupId, ...recordToWrite };
          let inserted;
          try {
            inserted = await entityApi.create(insertPayload, dataEnvOpts || undefined);
          } catch {
            // If preserving ID fails, insert without ID (platform assigns new one)
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

    // ── PHASE 3: DELETE EXTRA RECORDS ─────────────────────────────────────────
    // "Extra" = in DB but NOT in backup AND NOT a newly-inserted record from this restore
    console.log(`[restore:${entity_name}] Phase 3: Identifying extra records to delete...`);

    // All IDs that SHOULD exist after restore:
    // - backup IDs that were found and updated
    // - new IDs generated when inserting backup records
    const expectedNewIds = new Set(Object.values(localIdMap));

    for (const existingRecord of existingRecords) {
      const dbId = existingRecord.id;

      // If this DB record's ID is NOT in backup AND NOT a newly created record from this restore
      if (!backupIdSet.has(dbId) && !expectedNewIds.has(dbId)) {
        try {
          await entityApi.delete(dbId, dataEnvOpts || undefined);
          stats.deleted++;
          await sleep(80);
        } catch (e) {
          console.error(`[restore:${entity_name}] Delete failed for id=${dbId}:`, e.message);
        }
      }
    }

    console.log(`[restore:${entity_name}] Done — updated:${stats.updated} inserted:${stats.inserted} deleted:${stats.deleted} remapped:${stats.id_remapped}`);

    return Response.json({
      success: true,
      entity: entity_name,
      stats,
      id_map: localIdMap  // Return this so frontend can pass it to dependent entity restores
    });

  } catch (error) {
    console.error('[restoreDatabaseBackup] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});