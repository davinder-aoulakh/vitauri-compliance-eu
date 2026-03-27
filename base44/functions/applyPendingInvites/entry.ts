import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);

        // Fetch all pending invites
        const pendingInvites = await base44.asServiceRole.entities.PendingInvite.filter({ status: 'pending' });

        if (!pendingInvites || pendingInvites.length === 0) {
            return Response.json({ success: true, message: 'No pending invites to process.' });
        }

        let applied = 0;
        let notFound = 0;

        for (const invite of pendingInvites) {
            // Look for the user record by email
            const users = await base44.asServiceRole.entities.User.filter({ email: invite.email });

            if (!users || users.length === 0) {
                notFound++;
                continue;
            }

            const user = users[0];

            // Apply the custom fields
            await base44.asServiceRole.entities.User.update(user.id, {
                display_name: invite.display_name,
                app_role: invite.app_role,
                job_title: invite.job_title || '',
                department: invite.department || '',
                tenant_id: invite.tenant_id,
                invite_status: 'accepted'
            });

            // Mark invite as applied
            await base44.asServiceRole.entities.PendingInvite.update(invite.id, {
                status: 'applied'
            });

            console.log(`Applied invite fields to user: ${invite.email}`);
            applied++;
        }

        return Response.json({
            success: true,
            applied,
            notFound,
            message: `Applied ${applied} invite(s). ${notFound} user(s) not yet registered.`
        });

    } catch (error) {
        console.error('applyPendingInvites error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});