import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.app_role !== 'super_admin') {
      return Response.json({ error: 'Forbidden: Super admin access required' }, { status: 403 });
    }

    const { workflow_id, change_summary, version_label } = await req.json();

    if (!workflow_id) {
      return Response.json({ error: 'workflow_id is required' }, { status: 400 });
    }

    // Fetch the current workflow
    const workflows = await base44.entities.Workflow.filter({ id: workflow_id });
    if (!workflows || workflows.length === 0) {
      return Response.json({ error: 'Workflow not found' }, { status: 404 });
    }
    const workflow = workflows[0];

    // Count existing versions to determine next version number
    const existingVersions = await base44.entities.WorkflowVersion.filter({ workflow_id });
    const versionCount = existingVersions.length;

    // Version numbering: major on publish, minor on draft save
    let versionNumber;
    if (versionCount === 0) {
      versionNumber = "1.0";
    } else {
      const sortedVersions = existingVersions.sort((a, b) => {
        const [aMaj, aMin] = (a.version_number || "1.0").split('.').map(Number);
        const [bMaj, bMin] = (b.version_number || "1.0").split('.').map(Number);
        if (bMaj !== aMaj) return bMaj - aMaj;
        return bMin - aMin;
      });
      const latestVersion = sortedVersions[0].version_number || "1.0";
      const [major, minor] = latestVersion.split('.').map(Number);

      if (version_label === 'major') {
        versionNumber = `${major + 1}.0`;
      } else {
        versionNumber = `${major}.${minor + 1}`;
      }
    }

    const isPublished = version_label === 'major';

    // Create the snapshot record
    const versionRecord = await base44.entities.WorkflowVersion.create({
      workflow_id: workflow.id,
      workflow_name: workflow.workflow_name,
      version_number: versionNumber,
      version_label: version_label || 'minor',
      snapshot: { ...workflow },
      change_summary: change_summary || (isPublished ? 'Workflow published' : 'Draft saved'),
      saved_by: user.email,
      saved_at: new Date().toISOString(),
      is_published_snapshot: isPublished,
      step_count: workflow.steps?.length || 0
    });

    return Response.json({ 
      success: true, 
      version_id: versionRecord.id,
      version_number: versionNumber
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});