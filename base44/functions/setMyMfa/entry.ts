import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const sr = base44.asServiceRole;
    const currentUser = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!currentUser) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { enable, code } = await req.json().catch(() => ({}));
    if (typeof enable !== 'boolean') {
      return Response.json({ error: 'enable (boolean) is required' }, { status: 400 });
    }

    const oldValue = !!currentUser.mfa_enabled;
    const isSuperAdmin = currentUser.app_role === 'super_admin' || currentUser.original_app_role === 'super_admin';

    if (enable) {
      // Turning MFA ON: allowed for the user themselves.
      await sr.entities.User.update(currentUser.id, { mfa_enabled: true });
    } else {
      // Turning MFA OFF: requires a valid emailed code, unless the caller is super_admin.
      if (!isSuperAdmin) {
        if (!code) {
          return Response.json({ error: 'A verification code is required to disable 2FA' }, { status: 400 });
        }
        const codes = await sr.entities.MfaCode.filter({ user_email: currentUser.email, is_used: false });
        if (!codes || codes.length === 0) {
          return Response.json({ error: 'No valid code found. Please request a new code.' }, { status: 400 });
        }
        const latest = codes.sort((a, b) => new Date(b.created_date) - new Date(a.created_date))[0];
        if (new Date() > new Date(latest.expires_at)) {
          return Response.json({ error: 'Code has expired. Please request a new code.' }, { status: 400 });
        }
        if (latest.code !== String(code).trim()) {
          return Response.json({ error: 'Invalid code. Please try again.' }, { status: 400 });
        }
        await sr.entities.MfaCode.update(latest.id, { is_used: true });
      }
      await sr.entities.User.update(currentUser.id, { mfa_enabled: false });
    }

    const newValue = enable;
    await sr.entities.AuditLog.create({
      tenant_id: currentUser.tenant_id || undefined,
      action_type: 'mfa_setting_changed',
      actor_email: currentUser.email,
      actor_role: currentUser.app_role,
      target_entity_type: 'User',
      target_entity_id: currentUser.id,
      target_entity_name: currentUser.email,
      changes: { before: { mfa_enabled: oldValue }, after: { mfa_enabled: newValue } },
      timestamp: new Date().toISOString()
    });

    return Response.json({ success: true, mfa_enabled: newValue });
  } catch (error) {
    console.error('setMyMfa error:', error);
    return Response.json({ error: error.message || 'Failed to update MFA setting' }, { status: 500 });
  }
});