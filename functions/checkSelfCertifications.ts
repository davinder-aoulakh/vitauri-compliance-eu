import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // For scheduled automations, there's no authenticated user
    // Use service role directly for all operations
    const accounts = await base44.asServiceRole.entities.Account.list();
    
    const overdueAccounts = [];
    const now = new Date();
    const OVERDUE_DAYS = 90;

    for (const account of accounts) {
      // Skip if no request date set
      if (!account.self_certification_request_date) {
        continue;
      }

      // Skip if already marked as overdue
      if (account.self_certification_overdue === true) {
        continue;
      }

      // Calculate days since request
      const requestDate = new Date(account.self_certification_request_date);
      const daysDiff = Math.floor((now - requestDate) / (1000 * 60 * 60 * 24));

      // Check if 90 days have passed
      if (daysDiff >= OVERDUE_DAYS) {
        // Mark as overdue
        await base44.asServiceRole.entities.Account.update(account.id, {
          self_certification_overdue: true
        });

        // Log audit entry
        await base44.asServiceRole.entities.AuditLog.create({
          tenant_id: account.tenant_id,
          action_type: "account_updated",
          actor_email: "system",
          actor_role: "system",
          target_entity_type: "Account",
          target_entity_id: account.id,
          target_entity_name: account.account_number,
          changes: {
            field: "self_certification_overdue",
            previous_value: false,
            new_value: true,
            reason: `90 days passed since self-certification request (requested on ${account.self_certification_request_date})`
          },
          timestamp: new Date().toISOString()
        });

        overdueAccounts.push({
          account_id: account.id,
          account_number: account.account_number,
          account_holder_name: account.account_holder_name,
          request_date: account.self_certification_request_date,
          days_overdue: daysDiff
        });
      }
    }

    // Optionally send notification if there are overdue accounts
    if (overdueAccounts.length > 0) {
      console.log(`Found ${overdueAccounts.length} overdue accounts:`, overdueAccounts);
      
      // You can optionally send an email notification to admins here
      // Example: await base44.integrations.Core.SendEmail({...});
    }

    return Response.json({
      success: true,
      checked_accounts: accounts.length,
      overdue_accounts: overdueAccounts.length,
      overdue_details: overdueAccounts
    });
  } catch (error) {
    console.error("Error checking self-certifications:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});