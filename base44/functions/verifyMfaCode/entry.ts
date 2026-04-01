import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { code } = await req.json();
    if (!code) return Response.json({ error: 'Code is required' }, { status: 400 });

    // Find the most recent unused code for this user
    const codes = await base44.asServiceRole.entities.MfaCode.filter({
      user_email: user.email,
      is_used: false
    });

    if (codes.length === 0) {
      return Response.json({ success: false, error: 'No valid code found. Please request a new code.' }, { status: 400 });
    }

    // Sort by created_date descending to get the latest
    const latestCode = codes.sort((a, b) => new Date(b.created_date) - new Date(a.created_date))[0];

    // Check expiry
    if (new Date() > new Date(latestCode.expires_at)) {
      return Response.json({ success: false, error: 'Code has expired. Please request a new code.' }, { status: 400 });
    }

    // Check code match
    if (latestCode.code !== String(code).trim()) {
      return Response.json({ success: false, error: 'Invalid code. Please try again.' }, { status: 400 });
    }

    // Mark code as used
    await base44.asServiceRole.entities.MfaCode.update(latestCode.id, { is_used: true });

    return Response.json({ success: true });
  } catch (error) {
    console.error('verifyMfaCode error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});