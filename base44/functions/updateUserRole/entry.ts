import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const ALLOWED_ROLES = ['super_admin', 'tenant_admin', 'tenant_supervisor', 'tenant_user'];

Deno.serve(async (req) => {
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
        if (!ALLOWED_ROLES.includes(role)) {
            return Response.json({ error: 'Invalid role' }, { status: 400 });
        }

        const updateData = { app_role: role };
        if (role === 'super_admin') {
            updateData.tenant_id = null;
        }

        await base44.asServiceRole.entities.User.update(userId, updateData);

        // An explicit role change closes any active impersonation session so a stale return can't undo it
        const sessions = await base44.asServiceRole.entities.ImpersonationSession.filter({ user_id: userId, is_active: true });
        for (const s of sessions || []) {
            await base44.asServiceRole.entities.ImpersonationSession.update(s.id, {
                is_active: false,
                ended_at: new Date().toISOString(),
                ended_reason: 'role_changed'
            });
        }

        await base44.asServiceRole.entities.AuditLog.create({
            action_type: 'user_role_changed',
            actor_email: currentUser.email,
            actor_role: 'super_admin',
            target_entity_type: 'User',
            target_entity_id: userId,
            changes: { new_role: role, closed_impersonation_sessions: (sessions || []).length },
            timestamp: new Date().toISOString()
        });

        return Response.json({ success: true });
    } catch (error) {
        console.error('updateUserRole error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});