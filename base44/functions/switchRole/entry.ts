import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import {
  TENANT_ROLES,
  IMPERSONATION_JOB_TITLE,
  getActiveSessions,
  closeSession,
  writeAudit
} from '../../shared/impersonation.ts';

// Server-backed impersonation.
//   action "status": returns the caller's active impersonation session (if any)
//   action "start":  Super Admin (or already-impersonating user) acts as a tenant role
//   action "return": restores the role/tenant saved in the active session
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const currentUser = await base44.auth.me();
    if (!currentUser) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const action = body.action;
    const sessions = await getActiveSessions(base44, currentUser.id);
    const session = sessions[0] || null;

    // Safety: never keep more than one active session per user.
    for (const extra of sessions.slice(1)) {
      await closeSession(base44, extra, { reason: 'migration_superseded', endedBy: 'system' });
    }

    if (action === 'status') {
      if (!session) return Response.json({ active: false });
      return Response.json({
        active: true,
        session: {
          impersonated_tenant_id: session.impersonated_tenant_id,
          impersonated_tenant_name: session.impersonated_tenant_name,
          impersonated_role: session.impersonated_role,
          original_role: session.original_role,
          started_at: session.started_at
        }
      });
    }

    if (action === 'start') {
      const { tenant_id, role } = body;
      const targetRole = role || 'tenant_admin';

      // Only a Super Admin, or a user already inside a valid session, may switch down.
      if (!session && currentUser.app_role !== 'super_admin') {
        return Response.json({ error: 'Forbidden: only a Super Admin can act as a tenant' }, { status: 403 });
      }
      if (!TENANT_ROLES.includes(targetRole)) {
        return Response.json({ error: 'Invalid tenant role' }, { status: 400 });
      }
      if (!tenant_id || typeof tenant_id !== 'string') {
        return Response.json({ error: 'tenant_id is required' }, { status: 400 });
      }
      const tenants = await base44.asServiceRole.entities.Tenant.filter({ id: tenant_id });
      const tenant = tenants?.[0];
      if (!tenant) {
        return Response.json({ error: 'Tenant not found' }, { status: 404 });
      }

      const now = new Date().toISOString();
      const impersonationFields = {
        impersonated_tenant_id: tenant.id,
        impersonated_tenant_name: tenant.name,
        impersonated_role: targetRole
      };

      let activeSession;
      let created = false;
      if (session) {
        // Switching between tenants: keep the saved original role/tenant untouched.
        activeSession = await base44.asServiceRole.entities.ImpersonationSession.update(session.id, impersonationFields);
      } else {
        activeSession = await base44.asServiceRole.entities.ImpersonationSession.create({
          user_id: currentUser.id,
          user_email: currentUser.email,
          original_role: currentUser.app_role,
          original_tenant_id: currentUser.tenant_id || '',
          original_job_title: currentUser.job_title || '',
          ...impersonationFields,
          started_at: now,
          is_active: true,
          source: 'switch'
        });
        created = true;
      }

      try {
        await base44.asServiceRole.entities.User.update(currentUser.id, {
          app_role: targetRole,
          tenant_id: tenant.id,
          job_title: IMPERSONATION_JOB_TITLE
        });
      } catch (err) {
        // Don't leave a false session behind if the role update failed.
        if (created) {
          await closeSession(base44, activeSession, { reason: 'returned', endedBy: 'system' });
        }
        throw err;
      }

      await writeAudit(base44, {
        tenantId: tenant.id,
        actorEmail: currentUser.email,
        actorRole: session ? session.original_role : currentUser.app_role,
        targetId: currentUser.id,
        targetName: currentUser.email,
        changes: {
          event: 'impersonation_start',
          from_role: currentUser.app_role,
          to_role: targetRole,
          tenant_id: tenant.id,
          tenant_name: tenant.name,
          original_role: session ? session.original_role : currentUser.app_role
        }
      });

      return Response.json({ success: true, message: `Now acting as ${targetRole} for ${tenant.name}` });
    }

    if (action === 'return') {
      if (!session) {
        return Response.json({ error: 'No active impersonation session to return from' }, { status: 409 });
      }

      await base44.asServiceRole.entities.User.update(currentUser.id, {
        app_role: session.original_role,
        tenant_id: session.original_tenant_id || null,
        job_title: session.original_job_title || null
      });
      await closeSession(base44, session, { reason: 'returned', endedBy: currentUser.email });

      await writeAudit(base44, {
        tenantId: session.impersonated_tenant_id,
        actorEmail: currentUser.email,
        actorRole: session.original_role,
        targetId: currentUser.id,
        targetName: currentUser.email,
        changes: {
          event: 'impersonation_return',
          from_role: currentUser.app_role,
          to_role: session.original_role,
          tenant_id: session.impersonated_tenant_id
        }
      });

      return Response.json({ success: true, message: `Returned to ${session.original_role}` });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('switchRole error:', error);
    return Response.json({ error: error.message || 'Failed to switch role' }, { status: 500 });
  }
}