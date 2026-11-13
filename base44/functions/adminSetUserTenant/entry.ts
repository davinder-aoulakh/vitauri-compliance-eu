import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const ALLOWED_APP_ROLES = ['super_admin', 'tenant_admin', 'tenant_supervisor', 'tenant_user'];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const sr = base44.asServiceRole;
    const currentUser = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!currentUser) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only a real Super Admin (or a Super Admin currently impersonating) may change tenant/role.
    if (currentUser.app_role !== 'super_admin' && currentUser.original_app_role !== 'super_admin') {
      return Response.json({ error: 'Forbidden: only Super Admins may change tenant/role assignment' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { userId, app_role, tenant_id, job_title, original_app_role } = body;
    if (!userId) {
      return Response.json({ error: 'userId is required' }, { status: 400 });
    }

    const update = {};
    if (app_role !== undefined) {
      if (!ALLOWED_APP_ROLES.includes(app_role)) {
        return Response.json({ error: 'Invalid app_role' }, { status: 400 });
      }
      update.app_role = app_role;
    }
    if (tenant_id !== undefined) {
      update.tenant_id = tenant_id || null;
    }
    if (job_title !== undefined) {
      update.job_title = job_title || null;
    }
    if (original_app_role !== undefined) {
      update.original_app_role = original_app_role || null;
    }

    if (Object.keys(update).length === 0) {
      return Response.json({ error: 'No fields to update' }, { status: 400 });
    }

    const target = await sr.entities.User.get(userId).catch((e) => (e.status === 404 ? null : Promise.reject(e)));
    if (!target) {
      return Response.json({ error: 'Target user not found' }, { status: 404 });
    }

    const before = {
      app_role: target.app_role,
      tenant_id: target.tenant_id,
      job_title: target.job_title,
      original_app_role: target.original_app_role
    };

    await sr.entities.User.update(userId, update);

    await sr.entities.AuditLog.create({
      tenant_id: currentUser.tenant_id || undefined,
      action_type: 'user_role_changed',
      actor_email: currentUser.email,
      actor_role: currentUser.app_role,
      target_entity_type: 'User',
      target_entity_id: userId,
      target_entity_name: target.email,
      changes: { before, after: { ...before, ...update } },
      timestamp: new Date().toISOString()
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error('adminSetUserTenant error:', error);
    return Response.json({ error: error.message || 'Failed to update user tenant/role' }, { status: 500 });
  }
});