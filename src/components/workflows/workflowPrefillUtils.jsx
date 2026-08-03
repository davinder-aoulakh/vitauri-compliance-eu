import { base44 } from "@/api/base44Client";

/**
 * Evaluates computed_comparison prefill config against entity data.
 */
export const evaluateComputedComparison = (cfg, entityData) => {
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
        initialAnswers[step.step_id] = matchValues.includes(String(fieldValue)) ? 'YES' : 'NO';
      } else if (prefillType === 'computed_comparison') {
        initialAnswers[step.step_id] = evaluateComputedComparison(step.mapped_field.prefill_config, entityData);
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
      // If this is a FI type step and the account has one of the 6 exception entity types,
      // skip prefill — the exception path handles classification, not the FI type step.
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
      const isFiTypeStep2 = fieldName === 'fi_type' || resolvedFieldName === 'type_of_financial_institution';
      if (isFiTypeStep2 && entityData.account_holder_entity_type && EXCEPTION_ENTITY_TYPES.has(entityData.account_holder_entity_type)) {
        console.log(`[computePrefillAnswers] Skipping FI type prefill — account_holder_entity_type "${entityData.account_holder_entity_type}" is an exception type`);
        continue;
      }

      // Explicit mapping: account type_of_financial_institution values → workflow option values
      const FI_TYPE_MAP = {
        'investment_entity_type_a': 'type_a',
        'investment_entity_type_b': 'type_b',
        'custodial_institution': 'custodial_institution',
        'depository_institution': 'depository_institution',
        'specified_insurance_company': 'specified_insurance_company',
      };
      const options = step.options || [];
      if (options.length > 0) {
        const strLower = strVal.toLowerCase();
        // Step 1: Use explicit FI type map to get the ideal target value
        const mappedVal = FI_TYPE_MAP[strVal];
        // Step 2: Check if that mapped value actually exists as an option in THIS workflow step
        const byExplicitMap = mappedVal ? options.find(o => o.value === mappedVal) : null;
        // Step 3: If the mapped value doesn't exist in this workflow's options (e.g. type_b not listed),
        //         fall back to "none" option if available — per business rule
        const noneOption = options.find(o => o.value === 'none');
        const fallbackToNone = mappedVal && !byExplicitMap && noneOption ? noneOption : null;
        // Step 4: Standard exact/case-insensitive matching for non-FI-type fields
        const byValue = options.find(o => o.value === strVal);
        const byLabel = options.find(o => o.label === strVal);
        const byValueCI = options.find(o => o.value?.toLowerCase() === strLower);
        const byLabelCI = options.find(o => o.label?.toLowerCase() === strLower);
        // NOTE: no partial/contains matching — it causes false positives
        const matched = byExplicitMap || fallbackToNone || byValue || byLabel || byValueCI || byLabelCI;
        console.log(`[computePrefillAnswers] single_choice options:`, options.map(o => `${o.value}="${o.label}"`).join(', '));
        console.log(`[computePrefillAnswers] single_choice match for "${strVal}": mappedVal=${mappedVal} byExplicitMap=${byExplicitMap?.value} fallbackToNone=${fallbackToNone?.value} → using ${matched?.value || strVal}`);
        initialAnswers[step.step_id] = matched ? matched.value : strVal;
      } else {
        // Options come from referenced data — store the raw field value directly
        // The value in the entity field should already match ReferencedData.value
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