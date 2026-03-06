import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.app_role !== 'super_admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { entity_name } = body;
    if (!entity_name) {
      return Response.json({ error: 'entity_name required' }, { status: 400 });
    }

    const records = await base44.asServiceRole.entities[entity_name].list('-created_date', 100);
    return Response.json({ entity_name, records, count: records.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});