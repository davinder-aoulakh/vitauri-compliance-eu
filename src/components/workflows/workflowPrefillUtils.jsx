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
    if (!step.mapped_field || step.mapped_field.entity_type !== entityType || !step.mapped_field.field_name) continue;
    const fieldName = step.mapped_field.field_name;
    const fieldValue = entityData[fieldName];
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
      // Explicit mapping for type_of_financial_institution → workflow option values
      const FI_TYPE_MAP = {
        'investment_entity_type_a': 'type_a',
        'investment_entity_type_b': 'type_b',
        'custodial_institution': 'custodial_institution',
        'depository_institution': 'depository_institution',
        'specified_insurance_company': 'specified_insurance_company',
      };
      // If options are static, try explicit map first, then exact value/label match, then case-insensitive
      const options = step.options || [];
      if (options.length > 0) {
        const strLower = strVal.toLowerCase();
        // Use explicit map if available (prevents false partial matches)
        const mappedVal = FI_TYPE_MAP[strVal];
        const byExplicitMap = mappedVal ? options.find(o => o.value === mappedVal) : null;
        const byValue = options.find(o => o.value === strVal);
        const byLabel = options.find(o => o.label === strVal);
        const byValueCI = options.find(o => o.value?.toLowerCase() === strLower);
        const byLabelCI = options.find(o => o.label?.toLowerCase() === strLower);
        // NOTE: no partial/contains matching — it causes false positives (e.g. "type_b" matching "type_a" substring)
        const matched = byExplicitMap || byValue || byLabel || byValueCI || byLabelCI;
        console.log(`[computePrefillAnswers] single_choice options:`, options.map(o => `${o.value}="${o.label}"`).join(', '));
        console.log(`[computePrefillAnswers] single_choice match for "${strVal}": mappedVal=${mappedVal} → using ${matched?.value || strVal}`);
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