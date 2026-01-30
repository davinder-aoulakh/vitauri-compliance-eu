import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // Only super admin can deploy templates
    if (user?.user_role !== 'super_admin') {
      return Response.json({ error: 'Forbidden: Super admin access required' }, { status: 403 });
    }

    const { template_id, tenant_ids, set_as_default } = await req.json();

    if (!template_id) {
      return Response.json({ error: 'template_id is required' }, { status: 400 });
    }

    // Fetch the template
    const templates = await base44.asServiceRole.entities.DashboardTemplate.filter({ id: template_id });
    const template = templates[0];

    if (!template) {
      return Response.json({ error: 'Template not found' }, { status: 404 });
    }

    if (!template.is_published) {
      return Response.json({ error: 'Template is not published' }, { status: 400 });
    }

    // Get target tenants
    let targetTenants;
    if (tenant_ids && tenant_ids.length > 0) {
      // Deploy to specific tenants
      targetTenants = await base44.asServiceRole.entities.Tenant.filter({
        id: { $in: tenant_ids }
      });
    } else {
      // Deploy to all tenants
      targetTenants = await base44.asServiceRole.entities.Tenant.list();
    }

    const results = {
      success: [],
      errors: [],
      total: targetTenants.length
    };

    // Deploy to each tenant
    for (const tenant of targetTenants) {
      try {
        // Check if dashboard with this name already exists for tenant
        const existingDashboards = await base44.asServiceRole.entities.DashboardConfiguration.filter({
          tenant_id: tenant.id,
          dashboard_name: template.template_name
        });

        if (existingDashboards.length > 0) {
          // Update existing dashboard
          await base44.asServiceRole.entities.DashboardConfiguration.update(
            existingDashboards[0].id,
            {
              layout: template.layout,
              theme: template.theme,
              description: template.description,
              is_published: true,
              is_default: set_as_default || existingDashboards[0].is_default,
              published_by: user.email,
              published_date: new Date().toISOString()
            }
          );
          results.success.push({ tenant_id: tenant.id, tenant_name: tenant.name, action: 'updated' });
        } else {
          // If setting as default, unset other defaults first
          if (set_as_default) {
            const otherDefaults = await base44.asServiceRole.entities.DashboardConfiguration.filter({
              tenant_id: tenant.id,
              is_default: true
            });
            for (const defaultDash of otherDefaults) {
              await base44.asServiceRole.entities.DashboardConfiguration.update(defaultDash.id, {
                is_default: false
              });
            }
          }

          // Create new dashboard for tenant
          await base44.asServiceRole.entities.DashboardConfiguration.create({
            tenant_id: tenant.id,
            dashboard_name: template.template_name,
            description: template.description,
            layout: template.layout,
            theme: template.theme,
            is_published: true,
            is_default: set_as_default || false,
            published_by: user.email,
            published_date: new Date().toISOString()
          });
          results.success.push({ tenant_id: tenant.id, tenant_name: tenant.name, action: 'created' });
        }
      } catch (error) {
        results.errors.push({
          tenant_id: tenant.id,
          tenant_name: tenant.name,
          error: error.message
        });
      }
    }

    // Update template deployment stats
    await base44.asServiceRole.entities.DashboardTemplate.update(template_id, {
      deployment_stats: {
        deployed_to_tenant_count: results.success.length,
        last_deployment_date: new Date().toISOString()
      }
    });

    return Response.json({
      message: 'Template deployment completed',
      results
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});