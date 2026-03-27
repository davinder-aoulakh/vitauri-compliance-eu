import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);

        // 1. Authenticate the calling user
        const currentUser = await base44.auth.me();
        if (!currentUser) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 2. Authorize: only tenant_admin or super_admin can invite users
        if (currentUser.app_role !== 'tenant_admin' && currentUser.app_role !== 'super_admin') {
            return Response.json({ error: 'Only administrators can invite users' }, { status: 403 });
        }

        const { email, full_name, app_role, job_title, department, tenant_id } = await req.json();

        console.log(req.json())
        //const tenant_id = currentUser.tenant_id;

        // 3. Validate required fields
        if (!email || !full_name || !app_role) {
            return Response.json({ error: 'Email, full name, and role are required' }, { status: 400 });
        }

        if (!tenant_id) {
            return Response.json({ error: 'Inviting admin is not assigned to a tenant' }, { status: 400 });
        }

        // 4. Check for duplicate email within this tenant
        const existingUsers = await base44.asServiceRole.entities.User.filter({ email, tenant_id });
        if (existingUsers && existingUsers.length > 0) {
            return Response.json({ error: `A user with email '${email}' already exists in this organization.` }, { status: 409 });
        }

        // 5. Create the user record in the database immediately with all custom fields
        // This stores the profile data before the user accepts the invite
      /*  const newUserRecord = await base44.asServiceRole.entities.User.create({
            email,
            full_name: full_name,
            display_name: full_name,
            job_title: job_title || '',
            department: department || '',
            tenant_id,
            app_role,
            invite_status: 'pending'
        });  */

        // 6. Send the platform invitation email via Base44
        // await base44.users.inviteUser(email, 'user');

        await base44.users.inviteUser(email, app_role, {
    full_name,
    display_name: full_name,
    job_title,
    department,
    tenant_id,
    invite_status: 'pending'
});

        return Response.json({
            success: true,
            message: 'Invitation sent successfully. User record created with pending status.',
            user: {
                id: newUserRecord.id,
                email,
                display_name: full_name,
                app_role,
                invite_status: 'pending',
                tenant_id
            }
        });

    } catch (error) {
        console.error('Invite user error:', error);

        if (error.status === 409 || (error.message && error.message.includes('already exists'))) {
            return Response.json({ error: error.message }, { status: 409 });
        }

        return Response.json({
            error: error.message || 'Failed to send invitation',
            hint: 'Ensure the inviting admin has the Base44 platform-level "admin" role.'
        }, { status: 500 });
    }
});