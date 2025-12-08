import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

/**
 * Automated submission of CRS reports to tax authority APIs
 * Supports PFGU, IRS, and other jurisdiction-specific endpoints
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { report_id } = await req.json();

    if (!report_id) {
      return Response.json({ error: 'report_id is required' }, { status: 400 });
    }

    // Fetch the report
    const report = await base44.entities.CRSReport.filter({ id: report_id });
    if (!report || report.length === 0) {
      return Response.json({ error: 'Report not found' }, { status: 404 });
    }

    const crsReport = report[0];

    // Verify report is validated
    if (crsReport.status !== 'validated') {
      return Response.json({ 
        error: 'Report must be validated before submission',
        current_status: crsReport.status 
      }, { status: 400 });
    }

    if (!crsReport.xml_file_url) {
      return Response.json({ error: 'XML file not generated' }, { status: 400 });
    }

    // Fetch jurisdiction configuration
    const jurisdictionConfigs = await base44.entities.JurisdictionConfig.filter({
      jurisdiction_code: crsReport.reporting_jurisdiction
    });
    const jurisdictionConfig = jurisdictionConfigs[0];

    if (!jurisdictionConfig?.api_endpoints?.submission_url) {
      return Response.json({ 
        error: 'No submission API configured for this jurisdiction',
        jurisdiction: crsReport.reporting_jurisdiction
      }, { status: 400 });
    }

    // Download XML content
    const xmlResponse = await fetch(crsReport.xml_file_url);
    const xmlContent = await xmlResponse.text();

    // Get authentication credentials (from secrets or OAuth)
    const authType = jurisdictionConfig.api_endpoints.auth_type || 'token';
    let headers = {
      'Content-Type': 'application/xml',
      'Accept': 'application/xml'
    };

    if (authType === 'token') {
      const apiKey = Deno.env.get(`${crsReport.reporting_jurisdiction}_API_KEY`);
      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }
    }

    // Submit to tax authority with retry logic
    let lastError = null;
    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const submitResponse = await fetch(jurisdictionConfig.api_endpoints.submission_url, {
          method: 'POST',
          headers,
          body: xmlContent,
          signal: AbortSignal.timeout(30000) // 30 second timeout
        });

        const responseText = await submitResponse.text();

        if (submitResponse.ok) {
          // Parse response for submission reference
          const refMatch = responseText.match(/<SubmissionReference>([^<]+)<\/SubmissionReference>/);
          const submissionRef = refMatch ? refMatch[1] : `AUTO_${Date.now()}`;

          // Update report status
          await base44.entities.CRSReport.update(crsReport.id, {
            status: 'submitted',
            submission_date: new Date().toISOString().split('T')[0],
            submission_reference: submissionRef,
            submitted_by: user.email,
            notification_details: {
              ...crsReport.notification_details,
              submission_attempt_date: new Date().toISOString(),
              submission_response: responseText.substring(0, 500),
              submission_success: true
            }
          });

          // Log success
          await base44.entities.AuditLog.create({
            tenant_id: crsReport.tenant_id,
            action_type: 'report_submitted',
            actor_email: user.email,
            target_entity_type: 'CRSReport',
            target_entity_id: crsReport.id,
            changes: {
              status: 'submitted',
              submission_reference: submissionRef,
              attempt: attempt
            },
            timestamp: new Date().toISOString()
          });

          return Response.json({
            success: true,
            submission_reference: submissionRef,
            message: 'Report submitted successfully to tax authority'
          });
        } else {
          lastError = `HTTP ${submitResponse.status}: ${responseText}`;
          
          if (attempt < maxRetries) {
            // Wait before retry (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
            continue;
          }
        }
      } catch (error) {
        lastError = error.message;
        
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          continue;
        }
      }
    }

    // All retries failed
    await base44.entities.CRSReport.update(crsReport.id, {
      notification_details: {
        ...crsReport.notification_details,
        submission_attempt_date: new Date().toISOString(),
        submission_error: lastError,
        submission_success: false
      }
    });

    return Response.json({
      success: false,
      error: 'Submission failed after ' + maxRetries + ' attempts',
      details: lastError
    }, { status: 500 });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});