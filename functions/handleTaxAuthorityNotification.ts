import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

/**
 * Webhook endpoint to receive and process tax authority notifications
 * Handles acceptance, rejection, and error notifications for CRS reports
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Parse incoming XML notification
    const xmlText = await req.text();
    
    // Extract key information from XML (simplified parsing)
    const messageRefIdMatch = xmlText.match(/<MessageRefId>([^<]+)<\/MessageRefId>/);
    const statusMatch = xmlText.match(/<Status>([^<]+)<\/Status>/);
    const errorCodeMatch = xmlText.match(/<ErrorCode>([^<]+)<\/ErrorCode>/);
    const errorDescMatch = xmlText.match(/<ErrorDescription>([^<]+)<\/ErrorDescription>/);
    
    if (!messageRefIdMatch) {
      return Response.json({ 
        error: 'Invalid notification: MessageRefId not found' 
      }, { status: 400 });
    }

    const messageRefId = messageRefIdMatch[1];
    const notificationStatus = statusMatch ? statusMatch[1] : 'unknown';
    const errorCode = errorCodeMatch ? errorCodeMatch[1] : null;
    const errorDescription = errorDescMatch ? errorDescMatch[1] : null;

    // Find the corresponding report
    // Note: In production, you'd store the MessageRefId in the report or have a lookup table
    const reports = await base44.asServiceRole.entities.CRSReport.list();
    const matchingReport = reports.find(r => 
      r.notification_details?.messageRefId === messageRefId ||
      r.id === messageRefId // Fallback if MessageRefId is the report ID
    );

    if (!matchingReport) {
      return Response.json({ 
        error: 'Report not found for MessageRefId: ' + messageRefId,
        messageRefId 
      }, { status: 404 });
    }

    // Determine new status based on notification
    let newStatus = matchingReport.status;
    if (notificationStatus.toLowerCase().includes('accept')) {
      newStatus = 'accepted';
    } else if (notificationStatus.toLowerCase().includes('reject')) {
      newStatus = 'rejected';
    }

    // Update report with notification details
    await base44.asServiceRole.entities.CRSReport.update(matchingReport.id, {
      status: newStatus,
      notification_details: {
        ...matchingReport.notification_details,
        last_notification_date: new Date().toISOString(),
        notification_status: notificationStatus,
        error_code: errorCode,
        error_description: errorDescription,
        raw_notification: xmlText
      }
    });

    // Create audit log entry
    await base44.asServiceRole.entities.AuditLog.create({
      tenant_id: matchingReport.tenant_id,
      action_type: newStatus === 'accepted' ? 'report_submitted' : 'report_generated',
      actor_email: 'tax_authority_system',
      target_entity_type: "CRSReport",
      target_entity_id: matchingReport.id,
      changes: {
        status: newStatus,
        notification_status: notificationStatus,
        error_code: errorCode
      },
      timestamp: new Date().toISOString()
    });

    return Response.json({
      success: true,
      report_id: matchingReport.id,
      new_status: newStatus,
      message: 'Notification processed successfully'
    });

  } catch (error) {
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});