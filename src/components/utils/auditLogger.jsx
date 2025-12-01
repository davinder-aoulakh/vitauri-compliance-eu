import { base44 } from "@/api/base44Client";

/**
 * Create an audit log entry
 */
export async function createAuditLog({
  action_type,
  target_entity_type,
  target_entity_id,
  target_entity_name = null,
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
      target_entity_name,
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
      target_entity_name: workflowData?.workflow_name,
      changes: { after: workflowData }
    }),

  workflowArchived: (workflowId, workflowData) =>
    createAuditLog({
      action_type: "workflow_archived",
      target_entity_type: "Workflow",
      target_entity_id: workflowId,
      target_entity_name: workflowData?.workflow_name,
      changes: { before: workflowData }
    }),

  // Dashboard audit logs
  dashboardCreated: (dashboardId, dashboardData) =>
    createAuditLog({
      action_type: "dashboard_created",
      target_entity_type: "DashboardConfiguration",
      target_entity_id: dashboardId,
      target_entity_name: dashboardData?.dashboard_name,
      changes: { after: dashboardData }
    }),

  dashboardUpdated: (dashboardId, before, after) =>
    createAuditLog({
      action_type: "dashboard_updated",
      target_entity_type: "DashboardConfiguration",
      target_entity_id: dashboardId,
      target_entity_name: after?.dashboard_name || before?.dashboard_name,
      changes: { before, after }
    }),

  dashboardDeleted: (dashboardId, dashboardData) =>
    createAuditLog({
      action_type: "dashboard_deleted",
      target_entity_type: "DashboardConfiguration",
      target_entity_id: dashboardId,
      target_entity_name: dashboardData?.dashboard_name,
      changes: { before: dashboardData }
    }),

  dashboardPublished: (dashboardId, dashboardData) =>
    createAuditLog({
      action_type: "dashboard_published",
      target_entity_type: "DashboardConfiguration",
      target_entity_id: dashboardId,
      target_entity_name: dashboardData?.dashboard_name,
      changes: { after: dashboardData }
    }),

  // Widget audit logs
  widgetAdded: (dashboardId, dashboardName, widgetData) =>
    createAuditLog({
      action_type: "widget_added",
      target_entity_type: "DashboardConfiguration",
      target_entity_id: dashboardId,
      target_entity_name: dashboardName,
      changes: { after: { widget: widgetData } }
    }),

  widgetUpdated: (dashboardId, dashboardName, before, after) =>
    createAuditLog({
      action_type: "widget_updated",
      target_entity_type: "DashboardConfiguration",
      target_entity_id: dashboardId,
      target_entity_name: dashboardName,
      changes: { before: { widget: before }, after: { widget: after } }
    }),

  widgetRemoved: (dashboardId, dashboardName, widgetData) =>
    createAuditLog({
      action_type: "widget_removed",
      target_entity_type: "DashboardConfiguration",
      target_entity_id: dashboardId,
      target_entity_name: dashboardName,
      changes: { before: { widget: widgetData } }
    }),

  // User management audit logs
  userInvited: (userEmail, roleData) =>
    createAuditLog({
      action_type: "user_invited",
      target_entity_type: "User",
      target_entity_id: userEmail,
      target_entity_name: userEmail,
      changes: { after: roleData }
    }),

  userRoleChanged: (userId, userEmail, before, after) =>
    createAuditLog({
      action_type: "user_role_changed",
      target_entity_type: "User",
      target_entity_id: userId,
      target_entity_name: userEmail,
      changes: { before, after }
    }),

  userRemoved: (userId, userData) =>
    createAuditLog({
      action_type: "user_removed",
      target_entity_type: "User",
      target_entity_id: userId,
      target_entity_name: userData?.email,
      changes: { before: userData }
    }),

  permissionChanged: (userId, userEmail, before, after) =>
    createAuditLog({
      action_type: "permission_changed",
      target_entity_type: "User",
      target_entity_id: userId,
      target_entity_name: userEmail,
      changes: { before, after }
    }),

  // Data operations audit logs
  dataExported: (entityType, exportDetails) =>
    createAuditLog({
      action_type: "data_exported",
      target_entity_type: entityType,
      target_entity_id: "export",
      target_entity_name: `${entityType} Export`,
      changes: { after: exportDetails }
    }),

  dataImported: (entityType, importDetails) =>
    createAuditLog({
      action_type: "data_imported",
      target_entity_type: entityType,
      target_entity_id: "import",
      target_entity_name: `${entityType} Import`,
      changes: { after: importDetails }
    }),

  // Report audit logs
  reportGenerated: (reportId, reportData) =>
    createAuditLog({
      action_type: "report_generated",
      target_entity_type: "CRSReport",
      target_entity_id: reportId,
      target_entity_name: `${reportData?.reporting_year} CRS Report`,
      changes: { after: reportData }
    }),

  reportSubmitted: (reportId, reportData) =>
    createAuditLog({
      action_type: "report_submitted",
      target_entity_type: "CRSReport",
      target_entity_id: reportId,
      target_entity_name: `${reportData?.reporting_year} CRS Report`,
      changes: { after: reportData }
    })
};