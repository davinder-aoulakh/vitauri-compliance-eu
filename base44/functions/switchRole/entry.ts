import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const TENANT_ROLES = ['tenant_admin', 'tenant_supervisor', 'tenant_user'];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const sr = base44.asServiceRole;
    const currentUser = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!currentUser) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, role, tenant_id, job_title } = await req.json().catch(() => ({}));

    const sessions = await sr.entities.ImpersonationSession.filter({ user_id: currentUser.id, is_active: true });
    const session = sessions?.[0] || null;

    // Report server-side impersonation state (used by the banner)
    if (action === 'status') {
      return Response.json({
        active: !!session,
        tenant_id: session?.impersonated_tenant_id || null,
        tenant_name: session?.impersonated_tenant_name || null,
        role: session?.impersonated_role || null
      });
    }

    // Switch down to a tenant role (Super Admin only)
    if (action === 'start') {
      if (currentUser.app_role !== 'super_admin') {
        return Response.json({ error: 'Forbidden: only Super Admins can act as a tenant role' }, { status: 403 });
      }
      if (!TENANT_ROLES.includes(role)) {
        return Response.json({ error: 'Invalid role' }, { status: 400 });
      }
      if (!tenant_id) {
        return Response.json({ error: 'tenant_id is required' }, { status: 400 });
      }
      const tenant = await sr.entities.Tenant.get(tenant_id).catch((e) => (e.status === 404 ? null : Promise.reject(e)));
      if (!tenant) {
        return Response.json({ error: 'Tenant not found' }, { status: 404 });
      }

      const realRole = currentUser.app_role; // 'super_admin'
      const sessionFields = {
        impersonated_role: role,
        impersonated_tenant_id: tenant.id,
        impersonated_tenant_name: tenant.name,
        original_role: realRole,
        original_tenant_id: currentUser.tenant_id || '',
        original_job_title: currentUser.job_title || ''
      };
      if (session) {
        await sr.entities.ImpersonationSession.update(session.id, sessionFields);
      } else {
        await sr.entities.ImpersonationSession.create({
          user_id: currentUser.id,
          user_email: currentUser.email,
          ...sessionFields,
          is_active: true,
          started_at: new Date().toISOString()
        });
      }

      // Route the user field changes through adminSetUserTenant (server-side super_admin check + audit).
      const res = await base44.functions.invoke('adminSetUserTenant', {
        userId: currentUser.id,
        app_role: role,
        tenant_id: tenant.id,
        job_title: job_title || null,
        original_app_role: realRole
      });
      if (res?.data?.error) {
        throw new Error(res.data.error);
      }

      return Response.json({ success: true, message: `Now acting as ${role}` });
    }

    // Return to the original Super Admin role. Only a user whose original_app_role is super_admin may return.
    if (action === 'return') {
      if (currentUser.original_app_role !== 'super_admin') {
        return Response.json({ error: 'Forbidden: only an impersonating Super Admin may return to Super Admin' }, { status: 403 });
      }

      const restoreRole = session?.original_role || 'super_admin';
      const res = await base44.functions.invoke('adminSetUserTenant', {
        userId: currentUser.id,
        app_role: restoreRole,
        tenant_id: null,
        job_title: null,
        original_app_role: null
      });
      if (res?.data?.error) {
        throw new Error(res.data.error);
      }

      if (session) {
        await sr.entities.ImpersonationSession.update(session.id, {
          is_active: false,
          ended_at: new Date().toISOString(),
          ended_reason: 'returned'
        });
      }

      return Response.json({ success: true, message: `Returned to ${restoreRole}` });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Switch role error:', error);
    return Response.json({ error: error.message || 'Failed to switch role' }, { status: 500 });
  }
});