import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.app_role !== 'super_admin') {
      return Response.json({ error: 'Forbidden: Super admin access required' }, { status: 403 });
    }

    const { version_id } = await req.json();

    if (!version_id) {
      return Response.json({ error: 'version_id is required' }, { status: 400 });
    }

    // Fetch the version snapshot
    const versions = await base44.entities.WorkflowVersion.filter({ id: version_id });
    if (!versions || versions.length === 0) {
      return Response.json({ error: 'Version not found' }, { status: 404 });
    }
    const version = versions[0];
    const snapshot = version.snapshot;

    if (!snapshot || !version.workflow_id) {
      return Response.json({ error: 'Invalid snapshot data' }, { status: 400 });
    }

    // First, save the current state as a new snapshot before overwriting
    const currentWorkflows = await base44.entities.WorkflowVersion.filter({ workflow_id: version.workflow_id });
    const sortedVersions = currentWorkflows.sort((a, b) => {
      const [aMaj, aMin] = (a.version_number || "1.0").split('.').map(Number);
      const [bMaj, bMin] = (b.version_number || "1.0").split('.').map(Number);
      if (bMaj !== aMaj) return bMaj - aMaj;
      return bMin - aMin;
    });
    const latestVersion = sortedVersions[0]?.version_number || "1.0";
    const [major, minor] = latestVersion.split('.').map(Number);
    const preRestoreVersionNumber = `${major}.${minor + 1}`;

    // Get the live workflow to snapshot it before restore
    const liveWorkflows = await base44.entities.Workflow.filter({ id: version.workflow_id });
    if (liveWorkflows.length > 0) {
      const liveWorkflow = liveWorkflows[0];
      await base44.entities.WorkflowVersion.create({
        workflow_id: version.workflow_id,
        workflow_name: liveWorkflow.workflow_name,
        version_number: preRestoreVersionNumber,
        version_label: 'minor',
        snapshot: { ...liveWorkflow },
        change_summary: `Auto-saved before restoring to v${version.version_number}`,
        saved_by: user.email,
        saved_at: new Date().toISOString(),
        is_published_snapshot: false,
        step_count: liveWorkflow.steps?.length || 0
      });
    }

    // Restore: update the live workflow with snapshot data (minus system fields)
    const { id, created_date, updated_date, created_by, created_by_id, entity_name, app_id, ...restoreData } = snapshot;

    const changeLog = restoreData.change_log || [];
    changeLog.push({
      version: restoreData.version,
      changed_by: user.email,
      changed_date: new Date().toISOString(),
      changes_description: `Restored from snapshot v${version.version_number} (taken ${version.saved_at})`
    });

    await base44.entities.Workflow.update(version.workflow_id, {
      ...restoreData,
      status: 'draft',
      change_log: changeLog
    });

    return Response.json({ success: true, message: `Workflow restored to v${version.version_number}` });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});