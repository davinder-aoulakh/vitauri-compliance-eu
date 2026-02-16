import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Get current user
        const currentUser = await base44.auth.me();
        if (!currentUser) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { role, tenant_id, job_title, permissions } = await req.json();

        if (!role) {
            return Response.json({ error: 'Role is required' }, { status: 400 });
        }

        // Use service role to update user - this bypasses permission restrictions
        const updateData = {
            user_role: role,
            tenant_id: tenant_id || null,
            job_title: job_title || null
        };
        
        // Only include permissions if it exists in the schema
        if (permissions && Object.keys(permissions).length > 0) {
            updateData.permissions = permissions;
        }
        
        await base44.asServiceRole.entities.User.update(currentUser.id, updateData);

        return Response.json({ success: true, message: `Role updated to ${role}` });
    } catch (error) {
        console.error('Switch role error:', error);
        return Response.json({ error: error.message || 'Failed to switch role' }, { status: 500 });
    }
});