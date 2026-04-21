import React from "react";

export default function WorkflowIntroFields({ introFields, mappedEntityData }) {
  if (!introFields || introFields.length === 0 || !mappedEntityData) return null;

  return (
    <div className="space-y-1 mt-2">
      {introFields.map((field, idx) => {
        if (field.field_type === "computed_condition") {
          const value1 = Number(mappedEntityData[field.computation_field_1]) || 0;
          const value2 = Number(mappedEntityData[field.computation_field_2]) || 0;
          let computedResult = 0;
          switch (field.computation_operator) {
            case "add": computedResult = value1 + value2; break;
            case "subtract": computedResult = value1 - value2; break;
            case "multiply": computedResult = value1 * value2; break;
            case "divide": computedResult = value2 !== 0 ? value1 / value2 : 0; break;
            default: computedResult = value1 + value2;
          }
          const threshold = Number(field.threshold_value) || 0;
          let conditionMet = false;
          switch (field.comparison_operator) {
            case "greater_than": conditionMet = computedResult > threshold; break;
            case "less_than": conditionMet = computedResult < threshold; break;
            case "equals": conditionMet = computedResult === threshold; break;
            case "greater_than_or_equal": conditionMet = computedResult >= threshold; break;
            case "less_than_or_equal": conditionMet = computedResult <= threshold; break;
            case "not_equals": conditionMet = computedResult !== threshold; break;
            default: conditionMet = computedResult > threshold;
          }
          return (
            <div key={idx} className="text-sm text-blue-800">
              {field.display_label && <strong>{field.display_label}: </strong>}
              {conditionMet ? field.true_text : field.false_text || 'N/A'}
            </div>
          );
        } else {
          let fieldValue = mappedEntityData[field.field_name];
          if (field.value_formatter === 'boolean_alive_deceased' && typeof fieldValue === 'boolean') {
            fieldValue = fieldValue ? 'Alive' : 'Deceased';
          } else if (field.value_formatter === 'pre_existing_new' && typeof fieldValue === 'boolean') {
            fieldValue = fieldValue ? 'Pre-existing (before 2018)' : 'New (after 2018)';
          } else if (field.value_formatter === 'capitalize' && typeof fieldValue === 'string') {
            fieldValue = fieldValue.charAt(0).toUpperCase() + fieldValue.slice(1);
          } else if (field.value_formatter === 'threshold_based_display') {
            const numVal1 = Number(mappedEntityData[field.field_name]) || 0;
            const numVal2 = field.threshold_field_2 ? (Number(mappedEntityData[field.threshold_field_2]) || 0) : 0;
            const numVal = numVal1 + numVal2;
            const threshold = Number(field.threshold_value) || 0;
            let conditionMet = false;
            switch (field.comparison_operator) {
              case 'greater_than': conditionMet = numVal > threshold; break;
              case 'greater_than_or_equal': conditionMet = numVal >= threshold; break;
              case 'less_than': conditionMet = numVal < threshold; break;
              case 'less_than_or_equal': conditionMet = numVal <= threshold; break;
              case 'equals': conditionMet = numVal === threshold; break;
              default: conditionMet = numVal > threshold;
            }
            fieldValue = conditionMet ? (field.true_text || 'High Value') : (field.false_text || 'Low Value');
          }
          return (
            <p key={idx} className="text-sm text-blue-800">
              <strong>{field.display_label}:</strong> {fieldValue !== undefined && fieldValue !== null && fieldValue !== '' ? String(fieldValue) : 'N/A'}
            </p>
          );
        }
      })}
    </div>
  );
}