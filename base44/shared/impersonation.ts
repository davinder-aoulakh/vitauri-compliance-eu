export const ALL_ROLES = ['super_admin', 'tenant_admin', 'tenant_supervisor', 'tenant_user'];
export const TENANT_ROLES = ['tenant_admin', 'tenant_supervisor', 'tenant_user'];
export const IMPERSONATION_JOB_TITLE = 'Super Admin (Impersonating)';

// Active sessions for a user, newest first.
export async function getActiveSessions(base44, userId) {
  const rows = await base44.asServiceRole.entities.ImpersonationSession.filter({ user_id: userId, is_active: true });
  return (rows || []).sort((a, b) => String(b.created_date).localeCompare(String(a.created_date)));
}

export async function closeSession(base44, session, { reason, endedBy }) {
  await base44.asServiceRole.entities.ImpersonationSession.update(session.id, {
    is_active: false,
    ended_at: new Date().toISOString(),
    ended_reason: reason,
    ended_by: endedBy
  });
}

export async function writeAudit(base44, { tenantId, actorEmail, actorRole, targetId, targetName, changes }) {
  await base44.asServiceRole.entities.AuditLog.create({
    tenant_id: tenantId || undefined,
    action_type: 'user_role_changed',
    actor_email: actorEmail,
    actor_role: actorRole,
    target_entity_type: 'User',
    target_entity_id: targetId,
    target_entity_name: targetName,
    changes,
    timestamp: new Date().toISOString()
  });
}