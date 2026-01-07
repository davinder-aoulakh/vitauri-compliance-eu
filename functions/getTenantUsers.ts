import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Authenticate the user
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify user is a tenant admin
    if (user.user_role !== 'tenant_admin') {
      return Response.json({ error: 'Forbidden: Only tenant admins can list users' }, { status: 403 });
    }

    // Verify user has a tenant_id
    if (!user.tenant_id) {
      return Response.json({ error: 'User not assigned to a tenant' }, { status: 400 });
    }

    // Use service role to fetch all users for this tenant
    const tenantUsers = await base44.asServiceRole.entities.User.filter({ 
      tenant_id: user.tenant_id 
    });

    return Response.json({ users: tenantUsers }, { status: 200 });
  } catch (error) {
    console.error('Error fetching tenant users:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});