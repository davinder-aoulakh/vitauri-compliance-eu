import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
    try {
        const body = await req.json();
        const base44 = createClientFromRequest(req);

        const { event, data } = body;

        if (event?.type !== 'create') {
            return Response.json({ skipped: true });
        }

        const userId = event?.entity_id;
        let userEmail = data?.email;

        if (!userId) {
            return Response.json({ skipped: true, reason: 'No user id in payload' });
        }

        // If payload was too large or email missing, fetch the user directly
        if (!userEmail || body.payload_too_large) {
            const fetchedUser = await base44.asServiceRole.entities.User.get(userId);
            userEmail = fetchedUser?.email;
        }

        if (!userEmail) {
            return Response.json({ skipped: true, reason: 'Could not determine user email' });
        }

        // Find a matching pending invite for this email
        const pendingInvites = await base44.asServiceRole.entities.PendingInvite.filter({
            email: userEmail,
            status: 'pending'
        });

        if (!pendingInvites || pendingInvites.length === 0) {
            return Response.json({ skipped: true, reason: 'No pending invite found for this email' });
        }

        const invite = pendingInvites[0];

        // Update the newly created User record with all custom fields
        await base44.asServiceRole.entities.User.update(userId, {
            display_name: invite.display_name,
            app_role: invite.app_role,
            job_title: invite.job_title || '',
            department: invite.department || '',
            tenant_id: invite.tenant_id,
            invite_status: 'pending'
        });

        // Mark the invite as applied
        await base44.asServiceRole.entities.PendingInvite.update(invite.id, {
            status: 'applied'
        });

        console.log(`Applied pending invite fields to user ${userEmail} (id: ${userId})`);

        return Response.json({ success: true, email: userEmail });

    } catch (error) {
        console.error('onUserCreated error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});