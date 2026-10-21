import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const TENANT_ROLES = ['tenant_admin', 'tenant_user'];

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const sr = base44.asServiceRole;

        const currentUser = await base44.auth.me();
        if (!currentUser) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { action, role, tenant_id, job_title } = await req.json();

        const sessions = await sr.entities.ImpersonationSession.filter({ user_id: currentUser.id, is_active: true });
        const session = sessions?.[0] || null;

        const audit = (type, changes) => sr.entities.AuditLog.create({
            tenant_id: changes.tenant_id || undefined,
            action_type: type,
            actor_email: currentUser.email,
            actor_role: 'super_admin',
            target_entity_type: 'User',
            target_entity_id: currentUser.id,
            target_entity_name: currentUser.email,
            changes,
            timestamp: new Date().toISOString()
        });

        // Report server-side impersonation state (used by the banner)
        if (action === 'status') {
            return Response.json({
                active: !!session,
                tenant_id: session?.impersonated_tenant_id || null,
                tenant_name: session?.impersonated_tenant_name || null,
                role: session?.impersonated_role || null
            });
        }

        // Switch down to a tenant role (Super Admin only, or already impersonating)
        if (action === 'start') {
            if (currentUser.app_role !== 'super_admin' && !session) {
                return Response.json({ error: 'Forbidden: only Super Admins can act as a tenant role' }, { status: 403 });
            }
            if (!TENANT_ROLES.includes(role)) {
                return Response.json({ error: 'Invalid role' }, { status: 400 });
            }
            if (!tenant_id) {
                return Response.json({ error: 'tenant_id is required' }, { status: 400 });
            }
            const tenant = await sr.entities.Tenant.get(tenant_id).catch(() => null);
            if (!tenant) {
                return Response.json({ error: 'Tenant not found' }, { status: 404 });
            }

            const sessionFields = {
                impersonated_role: role,
                impersonated_tenant_id: tenant.id,
                impersonated_tenant_name: tenant.name
            };
            if (session) {
                // Keep the original role/tenant already saved
                await sr.entities.ImpersonationSession.update(session.id, sessionFields);
            } else {
                await sr.entities.ImpersonationSession.create({
                    user_id: currentUser.id,
                    user_email: currentUser.email,
                    original_role: currentUser.app_role,
                    original_tenant_id: currentUser.tenant_id || '',
                    original_job_title: currentUser.job_title || '',
                    ...sessionFields,
                    is_active: true,
                    started_at: new Date().toISOString()
                });
            }

            await sr.entities.User.update(currentUser.id, {
                app_role: role,
                tenant_id: tenant.id,
                job_title: job_title || null
            });
            await audit('user_role_changed', { event: 'impersonation_started', role, tenant_id: tenant.id, tenant_name: tenant.name });
            return Response.json({ success: true, message: `Now acting as ${role}` });
        }

        // Return to the original role saved on the server (client-sent role/tenant are ignored)
        if (action === 'return') {
            if (!session) {
                if (currentUser.app_role === 'super_admin') {
                    return Response.json({ success: true, message: 'Already Super Admin' });
                }
                return Response.json({ error: 'No active impersonation session found' }, { status: 403 });
            }

            await sr.entities.User.update(currentUser.id, {
                app_role: session.original_role,
                tenant_id: session.original_tenant_id || null,
                job_title: session.original_job_title || null
            });
            await sr.entities.ImpersonationSession.update(session.id, {
                is_active: false,
                ended_at: new Date().toISOString(),
                ended_reason: 'returned'
            });
            await audit('user_role_changed', { event: 'impersonation_returned', restored_role: session.original_role, tenant_id: session.impersonated_tenant_id });
            return Response.json({ success: true, message: `Returned to ${session.original_role}` });
        }

        return Response.json({ error: 'Invalid action' }, { status: 400 });
    } catch (error) {
        console.error('Switch role error:', error);
        return Response.json({ error: error.message || 'Failed to switch role' }, { status: 500 });
    }
});