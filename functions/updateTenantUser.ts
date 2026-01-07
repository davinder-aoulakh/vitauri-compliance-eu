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
      return Response.json({ error: 'Forbidden: Only tenant admins can update users' }, { status: 403 });
    }

    // Parse request body
    const body = await req.json();
    const { userId, userData } = body;
    
    if (!userId || !userData) {
      return Response.json({ error: 'Missing userId or userData' }, { status: 400 });
    }

    // Fetch the user to verify they're in the same tenant
    const usersInTenant = await base44.asServiceRole.entities.User.filter({ tenant_id: user.tenant_id });
    const userToUpdate = usersInTenant.find(u => u.id === userId);
    
    if (!userToUpdate) {
      return Response.json({ error: 'User not found in your organization' }, { status: 404 });
    }

    // Update the user using auth API (for built-in fields like full_name)
    const updatedUser = await base44.asServiceRole.auth.updateUser(userId, userData);

    return Response.json({ user: updatedUser }, { status: 200 });
  } catch (error) {
    console.error('Error updating tenant user:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});