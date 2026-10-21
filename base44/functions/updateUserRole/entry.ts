import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

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

        const updateData = { app_role: role };
        if (role === 'super_admin') {
            updateData.tenant_id = null;
        }

        await base44.asServiceRole.entities.User.update(userId, updateData);

        return Response.json({ success: true });
    } catch (error) {
        console.error('updateUserRole error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});