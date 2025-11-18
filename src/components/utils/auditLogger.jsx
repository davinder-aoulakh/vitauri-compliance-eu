import { base44 } from "@/api/base44Client";

/**
 * Create an audit log entry
 */
export async function createAuditLog({
  action_type,
  target_entity_type,
  target_entity_id,
  changes = null,
  metadata = {}
}) {
  try {
    const user = await base44.auth.me();
    const tenant = user.tenant_id;

    await base44.entities.AuditLog.create({
      tenant_id: tenant,
      action_type,
      actor_email: user.email,
      actor_role: user.user_role,
      target_entity_type,
      target_entity_id,
      changes,
      ip_address: metadata.ip_address || "Unknown",
      user_agent: navigator.userAgent,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Failed to create audit log:", error);
  }
}

export const auditLog = {
  entityCreated: (entityId, entityData) =>
    createAuditLog({
      action_type: "entity_created",
      target_entity_type: "Entity",
      target_entity_id: entityId,
      changes: { after: entityData }
    }),

  entityUpdated: (entityId, before, after) =>
    createAuditLog({
      action_type: "entity_updated",
      target_entity_type: "Entity",
      target_entity_id: entityId,
      changes: { before, after }
    }),

  entityDeleted: (entityId, entityData) =>
    createAuditLog({
      action_type: "entity_deleted",
      target_entity_type: "Entity",
      target_entity_id: entityId,
      changes: { before: entityData }
    }),

  entityClassified: (entityId, classificationData) =>
    createAuditLog({
      action_type: "entity_classified",
      target_entity_type: "Entity",
      target_entity_id: entityId,
      changes: { after: classificationData }
    }),

  accountCreated: (accountId, accountData) =>
    createAuditLog({
      action_type: "account_created",
      target_entity_type: "Account",
      target_entity_id: accountId,
      changes: { after: accountData }
    }),

  accountUpdated: (accountId, before, after) =>
    createAuditLog({
      action_type: "account_updated",
      target_entity_type: "Account",
      target_entity_id: accountId,
      changes: { before, after }
    }),

  accountDeleted: (accountId, accountData) =>
    createAuditLog({
      action_type: "account_deleted",
      target_entity_type: "Account",
      target_entity_id: accountId,
      changes: { before: accountData }
    }),

  accountClassified: (accountId, classificationData) =>
    createAuditLog({
      action_type: "account_classified",
      target_entity_type: "Account",
      target_entity_id: accountId,
      changes: { after: classificationData }
    }),

  settingsChanged: (settingType, before, after) =>
    createAuditLog({
      action_type: "settings_changed",
      target_entity_type: "UserSettings",
      target_entity_id: settingType,
      changes: { before, after }
    }),

  workflowPublished: (workflowId, workflowData) =>
    createAuditLog({
      action_type: "workflow_published",
      target_entity_type: "Workflow",
      target_entity_id: workflowId,
      changes: { after: workflowData }
    })
};