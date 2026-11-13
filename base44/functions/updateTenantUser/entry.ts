import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Tenant admins (and super admins switched into a tenant) may only touch these fields.
const ALLOWED_NON_SUPER_FIELDS = ['display_name', 'full_name', 'job_title', 'department', 'app_role'];
const ALLOWED_APP_ROLES_FOR_TENANT_ADMIN = ['tenant_user', 'tenant_supervisor', 'tenant_admin'];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Authenticate the user
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify user is a tenant admin or super admin
    if (user.app_role !== 'tenant_admin' && user.app_role !== 'super_admin') {
      return Response.json({ error: 'Forbidden: Only admins can update users' }, { status: 403 });
    }

    // Parse request body
    const body = await req.json();
    const { userId, userData } = body;

    if (!userId || !userData) {
      return Response.json({ error: 'Missing userId or userData' }, { status: 400 });
    }

    const sr = base44.asServiceRole;

    // --- Super admin path: behaviour unchanged ---
    if (user.app_role === 'super_admin') {
      // For super_admin role, remove tenant_id (super admins are not tied to tenants)
      if (userData.app_role === 'super_admin') {
        userData.tenant_id = null;
      } else if (!userData.tenant_id && user.tenant_id) {
        // If no tenant_id provided and user has one, use current user's tenant
        userData.tenant_id = user.tenant_id;
      }

      // Super admins can update any user
      const allUsers = await sr.entities.User.list();
      const userToUpdate = allUsers.find(u => u.id === userId);
      if (!userToUpdate) {
        return Response.json({ error: 'User not found' }, { status: 404 });
      }

      const updatedUser = await sr.entities.User.update(userId, userData);
      return Response.json({ user: updatedUser }, { status: 200 });
    }

    // --- Non-super-admin (tenant_admin) path: restricted ---
    // A super admin who has switched into a tenant has app_role !== 'super_admin' here,
    // so they are treated as a tenant admin until they return.

    // 1. Reject any field outside the allowed set; change nothing.
    const submittedKeys = Object.keys(userData);
    const disallowed = submittedKeys.filter(k => !ALLOWED_NON_SUPER_FIELDS.includes(k));
    if (disallowed.length > 0) {
      return Response.json(
        { error: `Forbidden: tenant admin may not set fields: ${disallowed.join(', ')}` },
        { status: 403 }
      );
    }

    // 2. app_role (if present) is limited to tenant roles.
    if ('app_role' in userData && !ALLOWED_APP_ROLES_FOR_TENANT_ADMIN.includes(userData.app_role)) {
      return Response.json(
        { error: `Forbidden: app_role cannot be set to ${String(userData.app_role)}` },
        { status: 403 }
      );
    }

    // 3. Target user must be in the caller's tenant.
    const usersInTenant = await sr.entities.User.filter({ tenant_id: user.tenant_id });
    const userToUpdate = usersInTenant.find(u => u.id === userId);
    if (!userToUpdate) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    // Build a clean update payload from allowed fields only.
    const update = {};
    if ('display_name' in userData) update.display_name = userData.display_name;
    if ('full_name' in userData) update.full_name = userData.full_name;
    if ('job_title' in userData) update.job_title = userData.job_title;
    if ('department' in userData) update.department = userData.department;
    if ('app_role' in userData) update.app_role = userData.app_role;

    const updatedUser = await sr.entities.User.update(userId, update);

    // 4. AuditLog after a successful app_role change.
    if ('app_role' in update && userToUpdate.app_role !== update.app_role) {
      await sr.entities.AuditLog.create({
        tenant_id: user.tenant_id || undefined,
        action_type: 'user_role_changed',
        actor_email: user.email,
        actor_role: user.app_role,
        target_entity_type: 'User',
        target_entity_id: userId,
        target_entity_name: userToUpdate.email,
        changes: { before: { app_role: userToUpdate.app_role }, after: { app_role: update.app_role } },
        timestamp: new Date().toISOString()
      });
    }

    return Response.json({ user: updatedUser }, { status: 200 });
  } catch (error) {
    console.error('Error updating tenant user:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});