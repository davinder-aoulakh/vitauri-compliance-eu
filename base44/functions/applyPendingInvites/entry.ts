import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const sr = base44.asServiceRole;

        let targetEmail = null;
        try {
            const body = await req.json();
            targetEmail = body?.email || null;
        } catch (_) {}

        // When called from the app with an email, it must be the caller's own email
        if (targetEmail) {
            const caller = await base44.auth.me().catch(() => null);
            if (!caller || caller.email !== targetEmail) {
                return Response.json({ error: 'Forbidden' }, { status: 403 });
            }
        }

        // Only genuinely pending invites are ever applied
        let pending = await sr.entities.PendingInvite.filter({ status: 'pending' });
        if (targetEmail) {
            pending = pending.filter(i => i.email === targetEmail);
        }
        if (!pending || pending.length === 0) {
            return Response.json({ success: true, message: 'No pending invites to process.' });
        }

        // Newest invite first so duplicates for the same email resolve to the latest one
        pending.sort((a, b) => new Date(b.created_date).getTime() - new Date(a.created_date).getTime());

        let applied = 0;
        let notFound = 0;
        const handled = new Set();

        for (const invite of pending) {
            if (handled.has(invite.email)) {
                await sr.entities.PendingInvite.update(invite.id, { status: 'expired' });
                continue;
            }

            const users = await sr.entities.User.filter({ email: invite.email });
            if (!users || users.length === 0) {
                notFound++;
                continue;
            }
            const user = users[0];
            handled.add(invite.email);

            // Never change an existing Super Admin
            if (user.app_role === 'super_admin') {
                await sr.entities.PendingInvite.update(invite.id, { status: 'expired' });
                continue;
            }

            // Mark applied first so it can never run twice
            await sr.entities.PendingInvite.update(invite.id, { status: 'applied' });

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
            await sr.entities.User.update(user.id, updatePayload);

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