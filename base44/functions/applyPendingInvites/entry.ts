import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { getActiveSessions } from '../../shared/impersonation.ts';

// Applies only genuinely pending invites, once. Applied/expired invites are never replayed.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);

    let targetEmail = null;
    try {
      const body = await req.json();
      targetEmail = body?.email ? String(body.email).toLowerCase() : null;
    } catch (_) {}

    const invites = await base44.asServiceRole.entities.PendingInvite.filter({ status: 'pending' });
    let pending = (invites || []).filter(i => i.email);
    if (targetEmail) {
      pending = pending.filter(i => i.email.toLowerCase() === targetEmail);
    }
    if (pending.length === 0) {
      return Response.json({ success: true, message: 'No pending invites to process.' });
    }

    // Group by email; the newest pending invite wins, older duplicates are expired.
    const byEmail = new Map();
    for (const inv of pending) {
      const key = inv.email.toLowerCase();
      if (!byEmail.has(key)) byEmail.set(key, []);
      byEmail.get(key).push(inv);
    }

    let applied = 0;
    let notFound = 0;
    let skipped = 0;

    for (const [email, group] of byEmail) {
      group.sort((a, b) => String(b.created_date).localeCompare(String(a.created_date)));
      const [invite, ...older] = group;

      const users = await base44.asServiceRole.entities.User.filter({ email: invite.email });
      const user = users?.[0];
      if (!user) {
        notFound++;
        continue;
      }

      for (const dup of older) {
        await base44.asServiceRole.entities.PendingInvite.update(dup.id, { status: 'expired' });
      }

      // Never downgrade a Super Admin, and never touch a user mid-impersonation.
      const sessions = await getActiveSessions(base44, user.id);
      if (user.app_role === 'super_admin' || sessions.length > 0) {
        await base44.asServiceRole.entities.PendingInvite.update(invite.id, { status: 'expired' });
        console.log(`Skipped invite for protected user: ${email}`);
        skipped++;
        continue;
      }

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
      await base44.asServiceRole.entities.PendingInvite.update(invite.id, { status: 'applied' });
      applied++;
    }

    return Response.json({
      success: true,
      applied,
      skipped,
      notFound,
      message: `Applied ${applied} invite(s), skipped ${skipped}. ${notFound} user(s) not yet registered.`
    });
  } catch (error) {
    console.error('applyPendingInvites error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}