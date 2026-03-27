import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Verify the requesting user is authenticated and is an admin
        const currentUser = await base44.auth.me();
        if (!currentUser) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }
        
        if (currentUser.app_role !== 'tenant_admin' && currentUser.app_role !== 'super_admin') {
            return Response.json({ error: 'Only administrators can invite users' }, { status: 403 });
        }

        const { email, full_name, user_role, tenant_id, job_title, department, permissions } = await req.json();

        if (!email || !full_name) {
            return Response.json({ error: 'Email and full name are required' }, { status: 400 });
        }

        // Use the SDK users.inviteUser to invite the user
        // await base44.users.inviteUser(email, user_role === 'tenant_admin' ? 'admin' : 'user');
       // await base44.auth.inviteUser(email, user_role === 'tenant_admin' ? 'admin' : 'user');
       await base44.asServiceRole.users.inviteUser(email, 'user');

        // Update the new user's profile fields via service role
        const result = { email, full_name, user_role: user_role || 'tenant_user' };

        return Response.json({ success: true, message: 'Invitation sent successfully', result });
    } catch (error) {
        console.error('Invite user error:', error);
        return Response.json({ error: error.message || 'Failed to send invitation' }, { status: 500 });
    }
});