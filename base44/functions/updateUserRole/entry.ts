import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { ALL_ROLES, getActiveSessions, closeSession, writeAudit } from '../../shared/impersonation.ts';

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);

    const currentUser = await base44.auth.me();
    if (!currentUser) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (currentUser.app_role !== 'super_admin') {
      return Response.json({ error: 'Forbidden: Super Admin access required' }, { status: 403 });
    }

    const { userId, role } = await req.json();
    if (!userId || !role) {
      return Response.json({ error: 'userId and role are required' }, { status: 400 });
    }
    if (!ALL_ROLES.includes(role)) {
      return Response.json({ error: 'Invalid role' }, { status: 400 });
    }
    if (userId === currentUser.id) {
      return Response.json({ error: 'You cannot change your own role' }, { status: 400 });
    }

    const targets = await base44.asServiceRole.entities.User.filter({ id: userId });
    const target = targets?.[0];
    if (!target) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    const updateData = { app_role: role };
    if (role === 'super_admin') {
      updateData.tenant_id = null;
    }
    await base44.asServiceRole.entities.User.update(userId, updateData);

    // An explicit admin role change must not be undone by a stale "return" later.
    const sessions = await getActiveSessions(base44, userId);
    for (const s of sessions) {
      await closeSession(base44, s, { reason: 'admin_role_change', endedBy: currentUser.email });
    }

    await writeAudit(base44, {
      tenantId: target.tenant_id,
      actorEmail: currentUser.email,
      actorRole: currentUser.app_role,
      targetId: userId,
      targetName: target.email,
      changes: {
        event: 'role_change',
        from_role: target.app_role,
        to_role: role,
        impersonation_sessions_closed: sessions.length
      }
    });

    return Response.json({ success: true, sessions_closed: sessions.length });
  } catch (error) {
    console.error('updateUserRole error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}