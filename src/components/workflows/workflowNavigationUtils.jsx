/**
 * Utility functions for workflow navigation and step evaluation
 * Extracted from AccountClassification for better testability and reusability
 */

/**
 * Determines if a workflow step is an action node (terminal step with no branching)
 * @param {Object} step - The workflow step to evaluate
 * @returns {boolean} Whether this is an action node
 */
export const isActionNode = (step) => {
  if (!step) return false;

  const inputTypes = ["text_input", "number_input", "date_input", "file_upload", "multi_field_input", "address_input", "beneficiary_input", "controlling_person_input"];
  
  if (inputTypes.includes(step.question_type)) {
    if (step.default_next_step) {
      return false;
    }
    if (step.question_type === "text_input") {
      return true;
    }
    return false;
  }

  if (step.question_type === "multiple_choice" && step.conditional_logic?.option_values?.length > 0) {
    if (step.conditional_logic.option_values_next_step || step.conditional_logic.option_values_else_step) {
      return false;
    }
  }

  if (step.question_type === "multiple_choice") {
    if (step.conditional_logic?.selection_count_next_step || step.conditional_logic?.selection_count_else_step) {
      return false;
    }
  }

  if (step.conditional_logic?.multi_choice_routing_groups?.length > 0) {
    return false;
  }

  if (step.conditional_logic?.condition_groups?.length > 0) {
    return false;
  }

  if (step.conditional_logic?.conditions?.length > 0) {
    if (step.conditional_logic.next_step || step.conditional_logic.else_step) {
      return false;
    }
  }

  if (!step.options || step.options.length === 0) {
    return true;
  }

  const hasOptionNextSteps = step.options.some(opt => opt.next_step);
  return !hasOptionNextSteps;
};