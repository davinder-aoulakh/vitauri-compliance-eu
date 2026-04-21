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
      initialAnswers[step.step_id] = fieldValue ? 'YES' : 'NO';
    } else if (step.question_type === 'single_choice') {
      const strVal = String(fieldValue);
      // If options are static, try to match by value then by label
      const options = step.options || [];
      if (options.length > 0) {
        const byValue = options.find(o => o.value === strVal);
        const byLabel = options.find(o => o.label === strVal);
        const matched = byValue || byLabel;
        console.log(`[computePrefillAnswers] single_choice (static options) match for "${strVal}": → using ${matched?.value || strVal}`);
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