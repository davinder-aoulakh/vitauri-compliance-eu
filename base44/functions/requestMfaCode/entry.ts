import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Generate a 6-digit code
    const code = String(Math.floor(100000 + Math.random() * 900000));

    // Expire in 10 minutes
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    // Invalidate any existing codes for this user
    const existingCodes = await base44.asServiceRole.entities.MfaCode.filter({ user_email: user.email });
    for (const existing of existingCodes) {
      await base44.asServiceRole.entities.MfaCode.update(existing.id, { is_used: true });
    }

    // Store the new code
    await base44.asServiceRole.entities.MfaCode.create({
      user_email: user.email,
      code,
      expires_at: expiresAt,
      is_used: false
    });

    // Send the code via email
    await base44.asServiceRole.integrations.Core.SendEmail({
      to: user.email,
      subject: 'Your Verification Code',
      body: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #f8fafc; border-radius: 8px;">
          <h2 style="color: #1e293b; margin-bottom: 8px;">Verification Code</h2>
          <p style="color: #64748b; margin-bottom: 24px;">Enter the code below to complete your login. This code expires in 10 minutes.</p>
          <div style="background: #fff; border: 2px solid #e2e8f0; border-radius: 8px; padding: 24px; text-align: center; margin-bottom: 24px;">
            <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #4f46e5;">${code}</span>
          </div>
          <p style="color: #94a3b8; font-size: 13px;">If you did not request this code, please ignore this email.</p>
        </div>
      `
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error('requestMfaCode error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});