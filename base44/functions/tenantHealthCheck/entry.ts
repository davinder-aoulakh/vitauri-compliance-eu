import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.app_role !== 'super_admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { tenant_id } = await req.json().catch(() => ({}));

    // Fetch all needed data in parallel
    const [tenants, accounts, entities, controllingPersons, beneficiaries, auditLogs] = await Promise.all([
      base44.asServiceRole.entities.Tenant.list(),
      base44.asServiceRole.entities.Account.list(),
      base44.asServiceRole.entities.Entity.list(),
      base44.asServiceRole.entities.ControllingPerson.list(),
      base44.asServiceRole.entities.Beneficiary.list(),
      base44.asServiceRole.entities.AuditLog.list(),
    ]);

    const tenantsToCheck = tenant_id
      ? tenants.filter(t => t.id === tenant_id)
      : tenants;

    const results = tenantsToCheck.map(tenant => {
      const tid = tenant.id;
      const issues = [];

      // -- Scoped data for this tenant
      const tAccounts = accounts.filter(a => a.tenant_id === tid);
      const tEntities = entities.filter(e => e.tenant_id === tid);
      const tCPs = controllingPersons.filter(cp => cp.tenant_id === tid);
      const tBeneficiaries = beneficiaries.filter(b => b.tenant_id === tid);
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const tRecentLogs = auditLogs.filter(l => l.tenant_id === tid && l.created_date > thirtyDaysAgo);

      // ── CHECK 1: Orphaned accounts (entity_id not in tenant entities)
      const entityIds = new Set(tEntities.map(e => e.id));
      const orphanedAccounts = tAccounts.filter(a => a.entity_id && !entityIds.has(a.entity_id));
      if (orphanedAccounts.length > 0) {
        issues.push({
          type: 'orphaned_records',
          severity: 'high',
          title: 'Orphaned Accounts',
          description: `${orphanedAccounts.length} account(s) reference entities that no longer exist.`,
          action: 'Review and reassign or delete orphaned accounts.',
          count: orphanedAccounts.length
        });
      }

      // ── CHECK 2: Orphaned controlling persons (account_id not in tenant accounts)
      const accountIds = new Set(tAccounts.map(a => a.id));
      const orphanedCPs = tCPs.filter(cp => cp.account_id && !accountIds.has(cp.account_id));
      if (orphanedCPs.length > 0) {
        issues.push({
          type: 'orphaned_records',
          severity: 'high',
          title: 'Orphaned Controlling Persons',
          description: `${orphanedCPs.length} controlling person record(s) are linked to deleted accounts.`,
          action: 'Delete orphaned controlling person records.',
          count: orphanedCPs.length
        });
      }

      // ── CHECK 3: Orphaned beneficiaries
      const orphanedBeneficiaries = tBeneficiaries.filter(b => b.account_id && !accountIds.has(b.account_id));
      if (orphanedBeneficiaries.length > 0) {
        issues.push({
          type: 'orphaned_records',
          severity: 'high',
          title: 'Orphaned Beneficiaries',
          description: `${orphanedBeneficiaries.length} beneficiary record(s) are linked to deleted accounts.`,
          action: 'Delete orphaned beneficiary records.',
          count: orphanedBeneficiaries.length
        });
      }

      // ── CHECK 4: Accounts with no contact info
      const noContactAccounts = tAccounts.filter(a => !a.current_email && !a.current_phone);
      if (noContactAccounts.length > 0) {
        issues.push({
          type: 'incomplete_profile',
          severity: 'medium',
          title: 'Accounts Missing Contact Info',
          description: `${noContactAccounts.length} account(s) have no email or phone on record.`,
          action: 'Request updated contact details from account holders.',
          count: noContactAccounts.length
        });
      }

      // ── CHECK 5: Unclassified entities
      const unclassifiedEntities = tEntities.filter(e => e.rfi_status === 'pending_classification');
      if (unclassifiedEntities.length > 0) {
        issues.push({
          type: 'incomplete_profile',
          severity: 'medium',
          title: 'Unclassified Entities',
          description: `${unclassifiedEntities.length} entity(ies) are still pending RFI classification.`,
          action: 'Run the entity classification workflow for pending entities.',
          count: unclassifiedEntities.length
        });
      }

      // ── CHECK 6: Accounts pending review
      const pendingAccounts = tAccounts.filter(a => a.reportability_status === 'pending_review');
      const pendingPct = tAccounts.length > 0 ? Math.round((pendingAccounts.length / tAccounts.length) * 100) : 0;
      if (pendingPct > 30) {
        issues.push({
          type: 'classification_backlog',
          severity: pendingPct > 60 ? 'high' : 'medium',
          title: 'High Classification Backlog',
          description: `${pendingPct}% of accounts (${pendingAccounts.length}) are still pending review.`,
          action: 'Prioritise account classification to reduce backlog.',
          count: pendingAccounts.length
        });
      }

      // ── CHECK 7: Overdue self-certifications
      const overdueSelfCerts = tAccounts.filter(a => a.self_certification_overdue === true);
      if (overdueSelfCerts.length > 0) {
        issues.push({
          type: 'compliance_gap',
          severity: 'high',
          title: 'Overdue Self-Certifications',
          description: `${overdueSelfCerts.length} account(s) have self-certifications overdue (>90 days).`,
          action: 'Send reminders and escalate to relationship managers.',
          count: overdueSelfCerts.length
        });
      }

      // ── CHECK 8: Incomplete tenant profile
      const missingFields = [];
      if (!tenant.contact_email) missingFields.push('contact email');
      if (!tenant.jurisdiction) missingFields.push('jurisdiction');
      if (!tenant.tax_id) missingFields.push('tax ID');
      if (missingFields.length > 0) {
        issues.push({
          type: 'incomplete_profile',
          severity: 'low',
          title: 'Incomplete Tenant Profile',
          description: `Tenant profile is missing: ${missingFields.join(', ')}.`,
          action: 'Complete the tenant profile in Tenant Management.',
          count: missingFields.length
        });
      }

      // ── CHECK 9: No activity in 30 days
      if (tRecentLogs.length === 0 && tAccounts.length > 0) {
        issues.push({
          type: 'inactivity',
          severity: 'low',
          title: 'No Recent Activity',
          description: 'No user actions recorded in the last 30 days.',
          action: 'Reach out to tenant admin to confirm platform is actively used.',
          count: 0
        });
      }

      // ── CHECK 10: Trial tenants with no entities
      if (tenant.subscription_status === 'trial' && tEntities.length === 0) {
        issues.push({
          type: 'onboarding',
          severity: 'low',
          title: 'Trial Tenant — No Entities Onboarded',
          description: 'Tenant is on trial but has not added any entities yet.',
          action: 'Assist tenant admin with onboarding their first entity.',
          count: 0
        });
      }

      // ── RISK SCORE CALCULATION
      // Start at 100, subtract per issue weighted by severity
      const severityWeights = { high: 20, medium: 10, low: 5 };
      let score = 100;
      for (const issue of issues) {
        score -= severityWeights[issue.severity] || 5;
      }
      score = Math.max(0, score);

      const riskLevel =
        score >= 80 ? 'healthy' :
        score >= 60 ? 'warning' :
        score >= 40 ? 'at_risk' : 'critical';

      return {
        tenant_id: tid,
        tenant_name: tenant.name,
        short_name: tenant.short_name,
        subscription_status: tenant.subscription_status,
        jurisdiction: tenant.jurisdiction,
        risk_score: score,
        risk_level: riskLevel,
        issues,
        stats: {
          total_accounts: tAccounts.length,
          total_entities: tEntities.length,
          pending_accounts: pendingAccounts.length,
          unclassified_entities: unclassifiedEntities.length,
        },
        checked_at: new Date().toISOString()
      };
    });

    return Response.json({ results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});