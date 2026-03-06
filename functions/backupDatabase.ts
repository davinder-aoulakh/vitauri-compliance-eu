import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// Fetches a single entity and returns its records
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (user.app_role !== 'super_admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { entity_name, limit = 500 } = body;

    if (!entity_name) {
      return Response.json({ error: 'entity_name is required' }, { status: 400 });
    }

    const records = await base44.asServiceRole.entities[entity_name].list('-created_date', limit);

    return Response.json({ entity_name, records, count: records.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});