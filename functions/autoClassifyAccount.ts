import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Authenticate user
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { accountId, event_type } = await req.json();
        
        if (!accountId) {
            return Response.json({ error: 'accountId is required' }, { status: 400 });
        }

        // Fetch the account
        const accounts = await base44.asServiceRole.entities.Account.filter({ id: accountId });
        if (!accounts || accounts.length === 0) {
            return Response.json({ error: 'Account not found' }, { status: 404 });
        }
        const account = accounts[0];

        // Fetch all active auto-classification rules
        const rules = await base44.asServiceRole.entities.AutoClassificationRule.filter({
            entity_type: "Account",
            is_active: true
        });

        if (!rules || rules.length === 0) {
            return Response.json({ 
                message: 'No active auto-classification rules found',
                classified: false 
            });
        }

        // Sort rules by priority (highest first)
        const sortedRules = rules.sort((a, b) => (b.priority || 0) - (a.priority || 0));

        // Fetch related entity if account has entity_id
        let entity = null;
        if (account.entity_id) {
            try {
                const entities = await base44.asServiceRole.entities.Entity.filter({ id: account.entity_id });
                entity = entities[0] || null;
            } catch (error) {
                console.error("Error fetching related entity:", error);
            }
        }

        // Evaluate each rule
        let matchedRule = null;
        for (const rule of sortedRules) {
            if (evaluateConditions(rule.conditions, account, entity)) {
                matchedRule = rule;
                break;
            }
        }

        if (!matchedRule) {
            return Response.json({ 
                message: 'No matching auto-classification rules found',
                classified: false 
            });
        }

        // Update the account with the classification result
        const updateData = {
            reportability_status: matchedRule.classification_result,
            reportability_reason: matchedRule.classification_reason
        };
        
        // If entity_classification_result is set and account is entity type, update it
        if (matchedRule.entity_classification_result && account.account_holder_type === "entity") {
            updateData.entity_classification = matchedRule.entity_classification_result;
        }
        
        await base44.asServiceRole.entities.Account.update(accountId, updateData);

        // Create classification history entry
        await base44.asServiceRole.entities.AccountClassificationHistory.create({
            tenant_id: account.tenant_id,
            account_id: accountId,
            classification_date: new Date().toISOString(),
            reportability_status: matchedRule.classification_result,
            classification_reason: matchedRule.classification_reason,
            classification_source: "auto_classification",
            performed_by: "system",
            account_holder_name: account.account_holder_name,
            account_number: account.account_number,
            account_balance: account.year_end_cash_value
        });

        return Response.json({
            success: true,
            classified: true,
            classification_result: matchedRule.classification_result,
            classification_reason: matchedRule.classification_reason,
            rule_name: matchedRule.rule_name
        });

    } catch (error) {
        console.error('Auto-classification error:', error);
        return Response.json({ 
            error: error.message,
            classified: false 
        }, { status: 500 });
    }
});

// Helper function to evaluate conditions
function evaluateConditions(conditions, account, entity = null) {
    if (!conditions || conditions.length === 0) {
        return false;
    }

    let result = true;
    let currentLogicOperator = "AND";

    for (let i = 0; i < conditions.length; i++) {
        const condition = conditions[i];
        
        // Handle related entity fields
        let fieldValue;
        if (condition.field.startsWith('entity.')) {
            if (!entity) return false;
            const entityField = condition.field.replace('entity.', '');
            fieldValue = entity[entityField];
        } else {
            fieldValue = account[condition.field];
        }
        
        const conditionResult = evaluateSingleCondition(condition, fieldValue);

        if (i === 0) {
            result = conditionResult;
        } else {
            if (currentLogicOperator === "AND") {
                result = result && conditionResult;
            } else {
                result = result || conditionResult;
            }
        }

        currentLogicOperator = condition.logic_operator || "AND";
    }

    return result;
}

function evaluateSingleCondition(condition, fieldValue) {
    const { operator, value } = condition;
    
    // Handle is_empty and is_not_empty operators
    if (operator === "is_empty") {
        return fieldValue === null || fieldValue === undefined || fieldValue === "";
    }
    if (operator === "is_not_empty") {
        return fieldValue !== null && fieldValue !== undefined && fieldValue !== "";
    }
    
    // Handle date-based operators
    if (operator && operator.includes('ago')) {
        if (!fieldValue) return false;
        
        const fieldDate = new Date(fieldValue);
        const now = new Date();
        const diffMs = now - fieldDate;
        
        const thresholdValue = parseFloat(value);
        
        if (operator === "days_ago_greater_than") {
            const daysDiff = diffMs / (1000 * 60 * 60 * 24);
            return daysDiff > thresholdValue;
        }
        if (operator === "days_ago_less_than") {
            const daysDiff = diffMs / (1000 * 60 * 60 * 24);
            return daysDiff < thresholdValue;
        }
        if (operator === "months_ago_greater_than") {
            const monthsDiff = diffMs / (1000 * 60 * 60 * 24 * 30);
            return monthsDiff > thresholdValue;
        }
        if (operator === "months_ago_less_than") {
            const monthsDiff = diffMs / (1000 * 60 * 60 * 24 * 30);
            return monthsDiff < thresholdValue;
        }
        if (operator === "years_ago_greater_than") {
            const yearsDiff = diffMs / (1000 * 60 * 60 * 24 * 365);
            return yearsDiff > thresholdValue;
        }
        if (operator === "years_ago_less_than") {
            const yearsDiff = diffMs / (1000 * 60 * 60 * 24 * 365);
            return yearsDiff < thresholdValue;
        }
    }
    
    // Handle null/undefined field values
    if (fieldValue === null || fieldValue === undefined) {
        return operator === "not_equals";
    }

    switch (operator) {
        case "equals":
            return String(fieldValue).toLowerCase() === String(value).toLowerCase();
        
        case "not_equals":
            return String(fieldValue).toLowerCase() !== String(value).toLowerCase();
        
        case "greater_than":
            return Number(fieldValue) > Number(value);
        
        case "less_than":
            return Number(fieldValue) < Number(value);
        
        case "greater_than_or_equal":
            return Number(fieldValue) >= Number(value);
        
        case "less_than_or_equal":
            return Number(fieldValue) <= Number(value);
        
        case "contains":
            return String(fieldValue).toLowerCase().includes(String(value).toLowerCase());
        
        case "in":
            const inValues = String(value).split(',').map(v => v.trim().toLowerCase());
            return inValues.includes(String(fieldValue).toLowerCase());
        
        case "not_in":
            const notInValues = String(value).split(',').map(v => v.trim().toLowerCase());
            return !notInValues.includes(String(fieldValue).toLowerCase());
        
        default:
            return false;
    }
}