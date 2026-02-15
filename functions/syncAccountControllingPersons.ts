import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { accountId } = await req.json();

        if (!accountId) {
            return Response.json({ error: 'Account ID is required' }, { status: 400 });
        }

        // Fetch all controlling persons for this account
        const controllingPersons = await base44.entities.ControllingPerson.filter({ account_id: accountId });

        // Count total controlling persons
        const totalCount = controllingPersons.length;

        // Check if any are unclassified (is_reportable is null or undefined)
        const hasUnclassified = controllingPersons.some(cp => cp.is_reportable === null || cp.is_reportable === undefined);

        // Update the account with the counts
        await base44.entities.Account.update(accountId, {
            controlling_persons_count: totalCount,
            has_unclassified_controlling_persons: hasUnclassified
        });

        return Response.json({
            success: true,
            controlling_persons_count: totalCount,
            has_unclassified_controlling_persons: hasUnclassified
        });
    } catch (error) {
        console.error('Error syncing controlling persons:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});