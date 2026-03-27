import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
    try {
        // 1. Parse the body FIRST before SDK consumes the request
        const body = await req.json();
        const { email, full_name, app_role, job_title, department, tenant_id } = body;

        // 2. Initialize SDK client (after body is parsed)
        const base44 = createClientFromRequest(req);

        // 3. Authenticate the calling user
        const currentUser = await base44.auth.me();
        if (!currentUser) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 4. Authorize: only tenant_admin or super_admin can invite users
        if (currentUser.app_role !== 'tenant_admin' && currentUser.app_role !== 'super_admin') {
            return Response.json({ error: 'Only administrators can invite users' }, { status: 403 });
        }

        // 5. Validate required fields
        if (!email || !full_name || !app_role) {
            return Response.json({ error: 'Email, full name, and role are required' }, { status: 400 });
        }

        if (!tenant_id) {
            return Response.json({ error: 'Inviting admin is not assigned to a tenant' }, { status: 400 });
        }

        // 6. Check for duplicate email within this tenant
        const existingUsers = await base44.asServiceRole.entities.User.filter({ email, tenant_id });
        if (existingUsers && existingUsers.length > 0) {
            return Response.json({ error: `A user with email '${email}' already exists in this organization.` }, { status: 409 });
        }

        // 7. Send the platform invitation — this creates the User record in the platform
        await base44.users.inviteUser(email, 'user');

        // 8. Find the newly created user record and update it with all custom fields
        // Wait briefly for the platform to create the user record
        await new Promise(resolve => setTimeout(resolve, 1500));

        const newUsers = await base44.asServiceRole.entities.User.filter({ email });
        if (newUsers && newUsers.length > 0) {
            const newUser = newUsers[0];
            await base44.asServiceRole.entities.User.update(newUser.id, {
                display_name: full_name,
                app_role,
                job_title: job_title || '',
                department: department || '',
                tenant_id,
                invite_status: 'pending'
            });
        }

        return Response.json({
            success: true,
            message: 'Invitation sent successfully.',
            user: {
                email,
                display_name: full_name,
                app_role,
                job_title: job_title || '',
                department: department || '',
                tenant_id,
                invite_status: 'pending'
            }
        });

    } catch (error) {
        console.error('Invite user error:', error);

        if (error.status === 409 || (error.message && error.message.includes('already exists'))) {
            return Response.json({ error: error.message }, { status: 409 });
        }

        return Response.json({
            error: error.message || 'Failed to send invitation'
        }, { status: 500 });
    }
});