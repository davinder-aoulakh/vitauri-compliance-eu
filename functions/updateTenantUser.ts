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
      return Response.json({ error: 'Forbidden: Only admins can update users' }, { status: 403 });
    }

    // Parse request body
    const body = await req.json();
    const { userId, userData } = body;
    
    if (!userId || !userData) {
      return Response.json({ error: 'Missing userId or userData' }, { status: 400 });
    }

    // For super_admin role, remove tenant_id (super admins are not tied to tenants)
    if (userData.user_role === 'super_admin') {
      userData.tenant_id = null;
    } else if (!userData.tenant_id && user.tenant_id) {
      // If no tenant_id provided and user has one, use current user's tenant
      userData.tenant_id = user.tenant_id;
    }

    // Fetch the user to verify access
    let userToUpdate;
    if (user.user_role === 'super_admin') {
      // Super admins can update any user
      const allUsers = await base44.asServiceRole.entities.User.list();
      userToUpdate = allUsers.find(u => u.id === userId);
    } else {
      // Tenant admins can only update users in their tenant
      const usersInTenant = await base44.asServiceRole.entities.User.filter({ tenant_id: user.tenant_id });
      userToUpdate = usersInTenant.find(u => u.id === userId);
    }
    
    if (!userToUpdate) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    // Update user using service role
    const updatedUser = await base44.asServiceRole.entities.User.update(userId, userData);

    return Response.json({ user: updatedUser }, { status: 200 });
  } catch (error) {
    console.error('Error updating tenant user:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});