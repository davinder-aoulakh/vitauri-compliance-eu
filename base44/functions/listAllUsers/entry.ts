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

        const users = await base44.asServiceRole.entities.User.list();

        return Response.json({ users });
    } catch (error) {
        console.error('listAllUsers error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});