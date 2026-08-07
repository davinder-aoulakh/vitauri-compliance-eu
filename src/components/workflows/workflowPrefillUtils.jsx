import { base44 } from "@/api/base44Client";

/**
 * Evaluates computed_comparison prefill config against entity data.
 */
export const evaluateComputedComparison = (cfg, entityData) => {
  // Guard: if config is incomplete, return null instead of defaulting to NO
  if (!cfg || (!cfg.field_one && !cfg.field_two)) return null;
  if (!cfg.comparison_operator) return null;
  if (cfg.threshold_value === undefined || cfg.threshold_value === null) return null;

  const v1 = Number(entityData[cfg.field_one]) || 0;
  const v2 = Number(entityData[cfg.field_two]) || 0;
  const computed = { add: v1+v2, subtract: v1-v2, multiply: v1*v2, divide: v2 ? v1/v2 : 0 }[cfg.computation_operator] ?? v1+v2;
  const t = Number(cfg.threshold_value) || 0;
  const condMet = { greater_than: computed>t, less_than: computed<t, equals: computed===t, greater_than_or_equal: computed>=t, less_than_or_equal: computed<=t, not_equals: computed!==t }[cfg.comparison_operator] ?? false;
  return (condMet === (cfg.prefill_if_true !== false)) ? 'YES' : 'NO';
};

/**
 * Computes initial prefill answers for all workflow steps given entity data.
 */
export const computePrefillAnswers = async (workflow, entityData, entityType) => {
  const initialAnswers = {};
  console.log(`[computePrefillAnswers] entityType=${entityType}, checking ${workflow.steps.length} steps`);
  for (const step of workflow.steps) {
    if (!step.mapped_field) continue;
    console.log(`[computePrefillAnswers] step "${step.step_title}" mapped_field:`, step.mapped_field?.entity_type, step.mapped_field?.field_name, '| matching entityType:', entityType, '| match:', step.mapped_field.entity_type === entityType);
    // entity_type null = match any entity type; otherwise must match
    // Exception: fi_type steps always run on Account pass too (value lives in type_of_financial_institution on Account)
    const isFiTypeStep = step.mapped_field.field_name === 'fi_type';
    const entityTypeMatches = !step.mapped_field.entity_type || step.mapped_field.entity_type === entityType;
    if (!step.mapped_field || (!entityTypeMatches && !(isFiTypeStep && entityType === 'Account')) || !step.mapped_field.field_name) continue;
    const fieldName = step.mapped_field.field_name;
    // fi_type is the workflow config name, but Account entity stores this as type_of_financial_institution
    const resolvedFieldName = (fieldName === 'fi_type' && entityType === 'Account') ? 'type_of_financial_institution' : fieldName;
    const fieldValue = entityData[resolvedFieldName] ?? entityData[fieldName];
    console.log(`[computePrefillAnswers] step "${step.step_title}" fieldName="${fieldName}" fieldValue="${fieldValue}" question_type="${step.question_type}"`);
    if (fieldValue === undefined || fieldValue === null || fieldValue === "") { console.log(`[computePrefillAnswers] Skipping - field value is empty`); continue; }

    if (step.question_type === 'yes_no' && step.mapped_field.prefill_config) {
      const prefillType = step.mapped_field.prefill_config.prefill_type;
      if (prefillType === 'country_crs') {
        try {
          const crsCountries = await base44.entities.CrsCountryInfo.filter({ $or: [{ country_name: fieldValue }, { country_code: fieldValue }] });
          initialAnswers[step.step_id] = (crsCountries.length > 0 && crsCountries[0].is_crs_country === true) ? 'YES' : 'NO';
        } catch (e) { /* skip */ }
      } else if (prefillType === 'enum_match') {
        const matchValues = step.mapped_field.prefill_config.match_values || [];
        // Special case: is_pre_existing=true means the account IS pre-existing.
        // The workflow YES option = "New account", NO option = "Pre-existing account".
        // So is_pre_existing=true → prefill 'NO' (pre-existing path).
        // is_pre_existing=false → prefill 'YES' (new account path).
        if (fieldName === 'is_pre_existing') {
          initialAnswers[step.step_id] = fieldValue === true ? 'NO' : 'YES';
        } else {
          initialAnswers[step.step_id] = matchValues.includes(String(fieldValue)) ? 'YES' : 'NO';
        }
      } else if (prefillType === 'computed_comparison') {
        let result = evaluateComputedComparison(step.mapped_field.prefill_config, entityData);

        // Fallback: if config is incomplete, use year_end_cash_value vs 1,000,000 (CRS standard rule)
        if (result === null) {
          const balance = Number(entityData['year_end_cash_value']) || 0;
          if (balance > 0) {
            result = balance < 1000000 ? 'YES' : 'NO';
          }
        }

        if (result !== null) {
          initialAnswers[step.step_id] = result;
        }
        // null = no balance data, leave step editable
      }
    } else if (step.question_type === 'yes_no' && typeof fieldValue === 'boolean') {
      // For fields that default to false (e.g. entity_managed_by_asset_manager), only prefill
      // and lock the answer when the value is explicitly true. A false value on such fields may
      // simply mean "no data was provided" (e.g. bulk import omitted this column), so we must
      // not lock the user out of answering manually.
      const fieldName = step.mapped_field?.field_name;
      const falseDefaultFields = ['entity_managed_by_asset_manager'];
      if (falseDefaultFields.includes(fieldName) && fieldValue === false) {
        // Skip — treat missing/false as "no data provided"; leave step unlocked
        console.log(`[computePrefillAnswers] Skipping lock for "${fieldName}" because value is false (no data provided)`);
        continue;
      }
      initialAnswers[step.step_id] = fieldValue ? 'YES' : 'NO';
    } else if (step.question_type === 'single_choice') {
      const strVal = String(fieldValue);

      // ── Determine if this is the FI Type step ────────────────────────────────
      // The FI type step maps to fi_type (Entity) or type_of_financial_institution (Account).
      // IMPORTANT: For the FI type step, we ONLY read from Account.type_of_financial_institution.
      // We must SKIP the Entity pass entirely for this step — Entity.fi_type uses different
      // values (e.g. 'investment_entity') that do NOT map 1:1 to workflow option values
      // and would cause false prefills (e.g. 'investment_entity' matching 'type_a' incorrectly).
      const isFiTypeStep = fieldName === 'fi_type' || resolvedFieldName === 'type_of_financial_institution';
      if (isFiTypeStep && entityType === 'Entity') {
        // Skip entirely — FI type prefill only runs on the Account pass
        console.log(`[computePrefillAnswers] Skipping FI type step on Entity pass — only Account.type_of_financial_institution is used`);
        continue;
      }

      // ── Exception entity types: skip FI type prefill entirely ────────────────
      // These 6 types go through the exception sub-path, not the FI type classification tree.
      const EXCEPTION_ENTITY_TYPES = new Set([
        'DGA', 'NONPROFIT', 'STAK', 'holding', 'treasury', 'realestate',
        'N.V. or B.V. acting with one 100% shareholder/director (100% DGA)',
        'N.V. or B.V. acting with one 100% shareholder/director (DGA)',
        'Non-Profit Organization',
        'Stichting (Foundation) or other Non-Profit Organization',
        'Stichting Administratiekantoor (STAK)',
        'Holding Company',
        'Treasury Center',
        'Real Estate Fund',
      ]);
      if (isFiTypeStep && entityData.account_holder_entity_type && EXCEPTION_ENTITY_TYPES.has(entityData.account_holder_entity_type) && !entityData.type_of_financial_institution) {
        console.log(`[computePrefillAnswers] Skipping FI type prefill — account_holder_entity_type "${entityData.account_holder_entity_type}" is an exception type and no type_of_financial_institution is set`);
        continue;
      }

      const options = step.options || [];
      if (options.length > 0) {
        let matched = null;

        if (isFiTypeStep) {
          // ── FI Type step: use ONLY the explicit map, no generic fallbacks ───
          // Account.type_of_financial_institution → workflow option value.
          //
          // Investment workflow options:           type_a, type_b, custodial_institution, depository_institution, specified_insurance_company
          // Insurance & Depository workflow options: type_a, custodial_institution, depository_institution, specified_insurance_company, none
          //
          // Rule: investment_entity_type_b → type_b if that option exists, otherwise → none
          const FI_TYPE_MAP = {
            'investment_entity_type_a':    'type_a',
            'investment_entity_type_b':    'type_b',
            'custodial_institution':       'custodial_institution',
            'depository_institution':      'depository_institution',
            'specified_insurance_company': 'specified_insurance_company',
          };
          const mappedVal = FI_TYPE_MAP[strVal];
          if (mappedVal) {
            // Check if the mapped value exists in THIS workflow's step options
            const byMap = options.find(o => o.value === mappedVal);
            if (byMap) {
              matched = byMap;
            } else {
              // Mapped value not available in this workflow (e.g. type_b in Insurance & Depository)
              // Fall back to 'none' per business rule
              matched = options.find(o => o.value === 'none') || null;
            }
          }
          // If strVal is not in FI_TYPE_MAP at all → no prefill, step stays editable
          console.log(`[computePrefillAnswers] FI type step: account value="${strVal}" mappedVal=${mappedVal} → option=${matched?.value || 'NO_MATCH (step left editable)'}`);
        } else {
          // ── Non-FI-type step: generic option matching ─────────────────────
          const strLower = strVal.toLowerCase();
          matched = options.find(o => o.value === strVal)
            || options.find(o => o.label === strVal)
            || options.find(o => o.value?.toLowerCase() === strLower)
            || options.find(o => o.label?.toLowerCase() === strLower)
            || null;
          console.log(`[computePrefillAnswers] single_choice match for "${strVal}": ${matched?.value || 'NO_MATCH (step left editable)'}`);
        }

        // Only write the prefill answer if we found a valid option match
        if (matched) {
          initialAnswers[step.step_id] = matched.value;
        }
      } else {
        // Options come from referenced data — store raw field value directly
        console.log(`[computePrefillAnswers] single_choice (referenced data) — storing raw value: "${strVal}"`);
        initialAnswers[step.step_id] = strVal;
      }
    } else if (step.question_type === 'multiple_choice' && Array.isArray(fieldValue)) {
      initialAnswers[step.step_id] = fieldValue;
    } else if (step.question_type === 'address_input' && typeof fieldValue === 'object') {
      initialAnswers[step.step_id] = fieldValue;
    } else {
      initialAnswers[step.step_id] = String(fieldValue);
    }
  }
  return initialAnswers;
};