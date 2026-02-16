import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Authenticate the user
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify user is a tenant admin or super admin
    if (user.user_role !== 'tenant_admin' && user.user_role !== 'super_admin') {
      return Response.json({ error: 'Forbidden: Only admins can list users' }, { status: 403 });
    }

    // Super admins can see all users, tenant admins see only their tenant
    let tenantUsers;
    if (user.user_role === 'super_admin') {
      tenantUsers = await base44.asServiceRole.entities.User.list();
    } else {
      // Verify tenant admin has a tenant_id
      if (!user.tenant_id) {
        return Response.json({ error: 'User not assigned to a tenant' }, { status: 400 });
      }
      tenantUsers = await base44.asServiceRole.entities.User.filter({ 
        tenant_id: user.tenant_id 
      });
    }

    return Response.json({ users: tenantUsers }, { status: 200 });
  } catch (error) {
    console.error('Error fetching tenant users:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});