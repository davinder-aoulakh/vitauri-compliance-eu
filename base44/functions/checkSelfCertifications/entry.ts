import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // For scheduled automations, there's no authenticated user
    // Use service role directly for all operations
    const accounts = await base44.asServiceRole.entities.Account.list();
    const controllingPersons = await base44.asServiceRole.entities.ControllingPerson.list();
    
    const overdueAccounts = [];
    const overdueControllingPersons = [];
    const now = new Date();
    const OVERDUE_DAYS = 90;

    // Check Accounts
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

    // Check Controlling Persons
    for (const person of controllingPersons) {
      // Skip if no request date set
      if (!person.self_certification_request_date) {
        continue;
      }

      // Skip if already marked as overdue
      if (person.self_certification_overdue === true) {
        continue;
      }

      // Calculate days since request
      const requestDate = new Date(person.self_certification_request_date);
      const daysDiff = Math.floor((now - requestDate) / (1000 * 60 * 60 * 24));

      // Check if 90 days have passed
      if (daysDiff >= OVERDUE_DAYS) {
        // Mark as overdue
        await base44.asServiceRole.entities.ControllingPerson.update(person.id, {
          self_certification_overdue: true
        });

        const personName = person.first_name && person.last_name 
          ? `${person.first_name} ${person.last_name}` 
          : person.full_name || 'N/A';

        // Log audit entry
        await base44.asServiceRole.entities.AuditLog.create({
          tenant_id: person.tenant_id,
          action_type: "account_updated",
          actor_email: "system",
          actor_role: "system",
          target_entity_type: "ControllingPerson",
          target_entity_id: person.id,
          target_entity_name: personName,
          changes: {
            field: "self_certification_overdue",
            previous_value: false,
            new_value: true,
            reason: `90 days passed since self-certification request (requested on ${person.self_certification_request_date})`
          },
          timestamp: new Date().toISOString()
        });

        overdueControllingPersons.push({
          controlling_person_id: person.id,
          name: personName,
          account_id: person.account_id,
          request_date: person.self_certification_request_date,
          days_overdue: daysDiff
        });
      }
    }

    // Optionally send notification if there are overdue items
    if (overdueAccounts.length > 0 || overdueControllingPersons.length > 0) {
      console.log(`Found ${overdueAccounts.length} overdue accounts and ${overdueControllingPersons.length} overdue controlling persons`);
      console.log('Overdue accounts:', overdueAccounts);
      console.log('Overdue controlling persons:', overdueControllingPersons);
      
      // You can optionally send an email notification to admins here
      // Example: await base44.integrations.Core.SendEmail({...});
    }

    return Response.json({
      success: true,
      checked_accounts: accounts.length,
      checked_controlling_persons: controllingPersons.length,
      overdue_accounts: overdueAccounts.length,
      overdue_controlling_persons: overdueControllingPersons.length,
      overdue_accounts_details: overdueAccounts,
      overdue_controlling_persons_details: overdueControllingPersons
    });
  } catch (error) {
    console.error("Error checking self-certifications:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});