import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);

        // Get optional target email from payload (for per-user triggering from AuthContext)
        let targetEmail = null;
        try {
            const body = await req.json();
            targetEmail = body?.email || null;
        } catch (_) {}

        // Fetch all pending/applied invites (always use service role)
        const allInvites = await base44.asServiceRole.entities.PendingInvite.filter({});
        let pendingInvites = allInvites.filter(i => i.status === 'pending' || i.status === 'applied');

        // If a specific email was provided, only process that user
        if (targetEmail) {
            pendingInvites = pendingInvites.filter(i => i.email === targetEmail);
        }

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

            // Skip if user already has the correct tenant assigned
            if (user.tenant_id === invite.tenant_id && user.app_role === invite.app_role) {
                continue;
            }

            // Apply the custom fields — include mfa_enabled from the invite if set
            const updatePayload = {
                display_name: invite.display_name,
                app_role: invite.app_role,
                job_title: invite.job_title || '',
                department: invite.department || '',
                tenant_id: invite.tenant_id,
                invite_status: 'accepted'
            };
            if (invite.mfa_enabled !== undefined && invite.mfa_enabled !== null) {
                updatePayload.mfa_enabled = invite.mfa_enabled;
            }
            await base44.asServiceRole.entities.User.update(user.id, updatePayload);

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