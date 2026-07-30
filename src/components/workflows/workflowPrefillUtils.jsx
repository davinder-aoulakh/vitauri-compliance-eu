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
 * Wraps a prefilled value with source metadata so WorkflowRunner can lock it.
 * source: "bulk_import" means data came from entity/account fields (populated via bulk import).
 */
const prefilled = (value) => ({ value, source: "bulk_import" });

/**
 * Computes initial prefill answers for all workflow steps given entity data.
 * Returns objects shaped as { value, source } for fields that have data,
 * so WorkflowRunner can distinguish bulk-imported answers from manual ones.
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
          initialAnswers[step.step_id] = prefilled((crsCountries.length > 0 && crsCountries[0].is_crs_country === true) ? 'YES' : 'NO');
        } catch (e) { /* skip */ }
      } else if (prefillType === 'enum_match') {
        const matchValues = step.mapped_field.prefill_config.match_values || [];
        initialAnswers[step.step_id] = prefilled(matchValues.includes(String(fieldValue)) ? 'YES' : 'NO');
      } else if (prefillType === 'computed_comparison') {
        initialAnswers[step.step_id] = prefilled(evaluateComputedComparison(step.mapped_field.prefill_config, entityData));
      }
    } else if (step.question_type === 'yes_no' && typeof fieldValue === 'boolean') {
      initialAnswers[step.step_id] = prefilled(fieldValue ? 'YES' : 'NO');
    } else if (step.question_type === 'single_choice') {
      const strVal = String(fieldValue);
      const options = step.options || [];
      if (options.length > 0) {
        const strLower = strVal.toLowerCase();
        const byValue = options.find(o => o.value === strVal);
        const byLabel = options.find(o => o.label === strVal);
        const byValueCI = options.find(o => o.value?.toLowerCase() === strLower);
        const byLabelCI = options.find(o => o.label?.toLowerCase() === strLower);
        const byValueContains = options.find(o => strLower.includes(o.value?.toLowerCase()) || o.value?.toLowerCase().includes(strLower));
        const byLabelContains = options.find(o => strLower.includes(o.label?.toLowerCase()) || o.label?.toLowerCase().includes(strLower));
        const matched = byValue || byLabel || byValueCI || byLabelCI || byValueContains || byLabelContains;
        console.log(`[computePrefillAnswers] single_choice options:`, options.map(o => `${o.value}="${o.label}"`).join(', '));
        console.log(`[computePrefillAnswers] single_choice (static options) match for "${strVal}": → using ${matched?.value || strVal}`);
        initialAnswers[step.step_id] = prefilled(matched ? matched.value : strVal);
      } else {
        console.log(`[computePrefillAnswers] single_choice (referenced data) — storing raw value: "${strVal}"`);
        initialAnswers[step.step_id] = prefilled(strVal);
      }
    } else if (step.question_type === 'multiple_choice' && Array.isArray(fieldValue)) {
      initialAnswers[step.step_id] = prefilled(fieldValue);
    } else if (step.question_type === 'address_input' && typeof fieldValue === 'object') {
      initialAnswers[step.step_id] = prefilled(fieldValue);
    } else {
      initialAnswers[step.step_id] = prefilled(String(fieldValue));
    }
  }
  return initialAnswers;
};