import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowRight, ArrowLeft, CheckCircle2, Loader2, Info, FileCheck, Check, GitBranch, Sparkles, Upload, X, Calendar } from "lucide-react";
import { base44 } from "@/api/base44Client";
import WorkflowVisualizer from "./WorkflowVisualizer";
import AIWorkflowHelper from "../ai/AIWorkflowHelper";
import BeneficiaryInputRenderer from "../accounts/BeneficiaryInputRenderer";
import ControllingPersonInputRenderer from "../accounts/ControllingPersonInputRenderer";
import MultiFieldRenderer from "./MultiFieldRenderer";

export default function WorkflowRunner({ workflow, initialData, onComplete, onCancel, accountId, entityId }) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [mappedEntityData, setMappedEntityData] = useState(null);
  const [mappedEntityType, setMappedEntityType] = useState(null);
  const [mappedEntityId, setMappedEntityId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [showFlowchart, setShowFlowchart] = useState(false);
  const [showAIHelper, setShowAIHelper] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState({});
  const [dragActive, setDragActive] = useState({});

  const currentStep = workflow.steps[currentStepIndex];
  const isLastStep = currentStepIndex === workflow.steps.length - 1;

  const handleAnswer = (stepId, answer) => {
    console.log('\n📝 [HANDLE ANSWER CALLED]');
    console.log('   Step ID:', stepId);
    console.log('   New answer:', answer);
    console.log('   Previous answers:', answers);
    
    setAnswers(prev => {
      const updated = { ...prev, [stepId]: answer };
      console.log('   Updated answers:', updated);
      return updated;
    });
  };

  useEffect(() => {
    const loadMappedEntityData = async () => {
      if (!workflow || (!accountId && !entityId)) return;

      let entityType = null;
      let entityData = null;
      let id = null;

      if (accountId) {
        entityType = "Account";
        id = accountId;
        const accounts = await base44.entities.Account.filter({ id: accountId });
        entityData = accounts[0];
      } else if (entityId) {
        entityType = "Entity";
        id = entityId;
        const entities = await base44.entities.Entity.filter({ id: entityId });
        entityData = entities[0];
      }

      if (entityData) {
        setMappedEntityData(entityData);
        setMappedEntityType(entityType);
        setMappedEntityId(id);
        
        const initialAnswers = {};
        
        for (const step of workflow.steps) {
          if (step.mapped_field && step.mapped_field.entity_type === entityType && step.mapped_field.field_name) {
            const fieldName = step.mapped_field.field_name;
            let fieldValue = entityData[fieldName];
            console.log(`[PREFILL - WorkflowRunner] Step "${step.step_title}": field=${fieldName}, value="${fieldValue}", question_type="${step.question_type}"`);

            if (fieldValue !== undefined && fieldValue !== null && fieldValue !== "") {
              if (step.question_type === 'yes_no' && step.mapped_field.prefill_config) {
                const prefillType = step.mapped_field.prefill_config.prefill_type;
                
                if (prefillType === 'country_crs') {
                  try {
                    const crsCountries = await base44.entities.CrsCountryInfo.filter({
                      $or: [
                        { country_name: fieldValue },
                        { country_code: fieldValue }
                      ]
                    });
                    const isCrsCountry = crsCountries.length > 0 && crsCountries[0].is_crs_country === true;
                    initialAnswers[step.step_id] = isCrsCountry ? 'YES' : 'NO';
                    console.log(`[PREFILL] country_crs: ${fieldValue} -> ${isCrsCountry ? 'YES' : 'NO'}`);
                  } catch (error) {
                    console.error("Error checking CRS status for pre-fill:", error);
                  }
                } else if (prefillType === 'enum_match') {
                  const matchValues = step.mapped_field.prefill_config.match_values || [];
                  const isMatch = matchValues.includes(String(fieldValue));
                  initialAnswers[step.step_id] = isMatch ? 'YES' : 'NO';
                  console.log(`[PREFILL] enum_match: fieldValue="${fieldValue}", matchValues=${JSON.stringify(matchValues)}, isMatch=${isMatch} -> ${isMatch ? 'YES' : 'NO'}`);
                }
              } 
              else if (step.question_type === 'yes_no' && typeof fieldValue === 'boolean') {
                initialAnswers[step.step_id] = fieldValue ? 'YES' : 'NO';
                console.log(`[PREFILL] Boolean -> Yes/No: ${fieldValue} -> ${fieldValue ? 'YES' : 'NO'}`);
              } else if (step.question_type === 'single_choice') {
                // Pre-fill dropdown with entity field value
                initialAnswers[step.step_id] = String(fieldValue);
                console.log(`[PREFILL] Single choice pre-filled with: ${fieldValue}`);
              } else if (step.question_type === 'multiple_choice' && Array.isArray(fieldValue)) {
                initialAnswers[step.step_id] = fieldValue;
              } else if (step.question_type === 'address_input' && typeof fieldValue === 'object') {
                initialAnswers[step.step_id] = fieldValue;
              } else {
                initialAnswers[step.step_id] = String(fieldValue);
              }
            }
          }
        }
        
        setAnswers(prev => ({ ...prev, ...initialAnswers }));
      }
    };

    loadMappedEntityData();
  }, [workflow, accountId, entityId]);

  const handleNext = async () => {
    const answer = answers[currentStep.step_id];
    
    console.log(`\n========== HANDLE NEXT from Step ${currentStepIndex + 1}: ${currentStep.step_title} ==========`);
    console.log(`Current answer:`, answer);
    console.log(`Current step question_type:`, currentStep.question_type);
    console.log(`Is answer an array:`, Array.isArray(answer));
    console.log(`Has conditional_logic:`, !!currentStep.conditional_logic);
    console.log(`Full conditional_logic object:`, JSON.stringify(currentStep.conditional_logic, null, 2));
    console.log(`Has condition_groups:`, !!currentStep.conditional_logic?.condition_groups?.length);
    console.log(`use_selection_count flag:`, currentStep.conditional_logic?.use_selection_count);
    console.log(`selection_count_value:`, currentStep.conditional_logic?.selection_count_value);
    console.log(`selection_count_operator:`, currentStep.conditional_logic?.selection_count_operator);
    console.log(`selection_count_next_step:`, currentStep.conditional_logic?.selection_count_next_step);
    console.log(`selection_count_else_step:`, currentStep.conditional_logic?.selection_count_else_step);
    
    if (currentStep.question_type === 'address_input' && answer && accountId) {
      try {
        const addressConfig = currentStep.address_config || {};
        const targetField = addressConfig.target_field || 'current_address';
        
        const addressUpdate = {
          [targetField]: {
            street: answer.street,
            city: answer.city,
            state: answer.state,
            postal_code: answer.postal_code,
            country: answer.country
          }
        };
        
        await base44.entities.Account.update(accountId, addressUpdate);
        console.log(`[ADDRESS INPUT] Updated ${targetField} on account`);
        
        if (answer.tin && answer.country) {
          const currentAccount = await base44.entities.Account.filter({ id: accountId });
          const existingTaxResidencies = currentAccount[0]?.tax_residencies || [];
          
          const existingIndex = existingTaxResidencies.findIndex(
            tr => tr.country?.toLowerCase() === answer.country.toLowerCase()
          );
          
          let updatedTaxResidencies;
          if (existingIndex !== -1) {
            updatedTaxResidencies = [...existingTaxResidencies];
            updatedTaxResidencies[existingIndex] = {
              ...updatedTaxResidencies[existingIndex],
              country: answer.country,
              tin: answer.tin
            };
          } else {
            updatedTaxResidencies = [
              ...existingTaxResidencies,
              {
                country: answer.country,
                tin: answer.tin,
                tin_unavailable_reason: null
              }
            ];
          }
          
          await base44.entities.Account.update(accountId, {
            tax_residencies: updatedTaxResidencies
          });
          
          console.log(`[ADDRESS INPUT] Updated tax_residencies with TIN for ${answer.country}`);
        }
        
        const updatedAccounts = await base44.entities.Account.filter({ id: accountId });
        if (updatedAccounts[0]) {
          setMappedEntityData(updatedAccounts[0]);
        }
      } catch (error) {
        console.error('[ADDRESS INPUT] Error updating address and tax residencies:', error);
        alert('Failed to update address and tax residency: ' + error.message);
      }
    }
    
    if (currentStep.post_completion_actions && currentStep.post_completion_actions.length > 0) {
      const afterStepActions = currentStep.post_completion_actions.filter(
        action => (action.execution_timing || "after_step") === "after_step"
      );
      if (afterStepActions.length > 0) {
        console.log(`\n[POST-COMPLETION ACTIONS] Executing ${afterStepActions.length} "after_step" action(s) for step: ${currentStep.step_title}`);
        await executePostCompletionActions(afterStepActions);
      }
    }
    
    setHistory(prev => [...prev, currentStep.step_id]);
    
    if (currentStep.question_type === 'multiple_choice' && 
        currentStep.conditional_logic?.multi_choice_routing_groups && 
        currentStep.conditional_logic.multi_choice_routing_groups.length > 0 && 
        Array.isArray(answer)) {
      console.log('🔀 [MULTI-CHOICE ROUTING GROUPS]');
      console.log('   Selected options:', answer);
      
      for (const group of currentStep.conditional_logic.multi_choice_routing_groups) {
        console.log(`   📋 Evaluating group: ${group.group_name || group.group_id}`);
        let groupMatches = group.group_operator === 'AND';
        
        for (const condition of group.conditions) {
          let conditionMet = false;
          
          if (condition.condition_type === 'selected_options') {
            conditionMet = answer.some(selectedOpt => condition.option_values?.includes(selectedOpt));
            console.log(`      - Selected options check: ${conditionMet}`);
          } else if (condition.condition_type === 'selection_count') {
            const count = answer.length;
            switch (condition.count_operator) {
              case '=': conditionMet = count === condition.count_value; break;
              case '!=': conditionMet = count !== condition.count_value; break;
              case '>': conditionMet = count > condition.count_value; break;
              case '<': conditionMet = count < condition.count_value; break;
              case '>=': conditionMet = count >= condition.count_value; break;
              case '<=': conditionMet = count <= condition.count_value; break;
            }
            console.log(`      - Selection count check (${count} ${condition.count_operator} ${condition.count_value}): ${conditionMet}`);
          } else if (condition.condition_type === 'field_comparison') {
            conditionMet = await evaluateSingleCondition(condition, answers);
            console.log(`      - Field comparison: ${conditionMet}`);
          }
          
          if (group.group_operator === 'AND') {
            groupMatches = groupMatches && conditionMet;
            if (!groupMatches) break;
          } else {
            groupMatches = groupMatches || conditionMet;
            if (groupMatches) break;
          }
        }
        
        if (groupMatches) {
          console.log(`   ✅ Group matched! Navigating to: ${group.next_step}`);
          const nextIndex = workflow.steps.findIndex(s => s.step_id === group.next_step);
          if (nextIndex !== -1) {
            setCurrentStepIndex(nextIndex);
            return;
          }
        }
      }
      
      // If no groups matched, check for false_step on last group or use default
      console.log('   ⚠️ No routing groups matched');
      const lastGroup = currentStep.conditional_logic.multi_choice_routing_groups[currentStep.conditional_logic.multi_choice_routing_groups.length - 1];
      if (lastGroup?.false_step) {
        console.log(`   → Using last group's false_step: ${lastGroup.false_step}`);
        const nextIndex = workflow.steps.findIndex(s => s.step_id === lastGroup.false_step);
        if (nextIndex !== -1) {
          setCurrentStepIndex(nextIndex);
          return;
        }
      }
      if (currentStep.conditional_logic.multi_choice_default_step) {
        console.log(`   → Using default step: ${currentStep.conditional_logic.multi_choice_default_step}`);
        const nextIndex = workflow.steps.findIndex(s => s.step_id === currentStep.conditional_logic.multi_choice_default_step);
        if (nextIndex !== -1) {
          setCurrentStepIndex(nextIndex);
          return;
        }
      }
    }
    
    if (currentStep.question_type === 'multiple_choice' && 
        currentStep.conditional_logic?.option_values && 
        currentStep.conditional_logic.option_values.length > 0 && 
        Array.isArray(answer)) {
      console.log('🔍 [MULTI-CHOICE OPTION-BASED BRANCHING]');
      console.log('   Selected options:', answer);
      console.log('   Checking against option_values:', currentStep.conditional_logic.option_values);
      const matchFound = answer.some(selectedOpt => currentStep.conditional_logic.option_values.includes(selectedOpt));
      const nextStepId = matchFound 
        ? currentStep.conditional_logic.option_values_next_step 
        : currentStep.conditional_logic.option_values_else_step;
      
      console.log(`   ✅ Match found: ${matchFound}, Next step: ${nextStepId}`);
      
      if (nextStepId) {
        const nextIndex = workflow.steps.findIndex(s => s.step_id === nextStepId);
        console.log(`   🎯 Looking for step "${nextStepId}" -> found at index: ${nextIndex}`);
        if (nextIndex !== -1) {
          console.log(`   ➡️  Navigating to step index ${nextIndex + 1}: "${workflow.steps[nextIndex].step_title}"`);
          setCurrentStepIndex(nextIndex);
          return;
        } else {
          console.error(`   ❌ ERROR: Next step "${nextStepId}" NOT FOUND in workflow!`);
        }
      } else {
        console.log('   ⚠️  No next step defined, continuing to other branching logic...');
      }
    }
    
    console.log('\n🔍 [CHECKING SELECTION COUNT CONDITIONS]');
    console.log('   Is multiple_choice?', currentStep.question_type === 'multiple_choice');
    console.log('   Is answer array?', Array.isArray(answer));
    console.log('   use_selection_count flag:', currentStep.conditional_logic?.use_selection_count);
    console.log('   selection_count_value:', currentStep.conditional_logic?.selection_count_value);
    console.log('   Has next_step:', !!currentStep.conditional_logic?.selection_count_next_step);
    console.log('   Has else_step:', !!currentStep.conditional_logic?.selection_count_else_step);
    
    if (currentStep.question_type === 'multiple_choice' && 
        Array.isArray(answer) &&
        currentStep.conditional_logic?.use_selection_count &&
        currentStep.conditional_logic?.selection_count_value !== undefined &&
        currentStep.conditional_logic?.selection_count_value !== null) {
      console.log('🔢 [MULTI-CHOICE COUNT-BASED BRANCHING DETECTED]');
      console.log('   Full conditional_logic:', JSON.stringify(currentStep.conditional_logic, null, 2));
      console.log('   Has use_selection_count:', !!currentStep.conditional_logic?.use_selection_count);
      console.log('   Has selection_count_next_step:', !!currentStep.conditional_logic?.selection_count_next_step);
      console.log('   Has selection_count_else_step:', !!currentStep.conditional_logic?.selection_count_else_step);
      
      if (currentStep.conditional_logic?.selection_count_next_step || currentStep.conditional_logic?.selection_count_else_step) {
      const selectionCount = answer.length;
      const targetCount = currentStep.conditional_logic.selection_count_value || 0;
      const operator = currentStep.conditional_logic.selection_count_operator || '=';
      
      console.log(`   📊 Selection count: ${selectionCount}`);
      console.log(`   🎯 Target count: ${targetCount}`);
      console.log(`   🔧 Operator: "${operator}"`);
      
      let conditionMet = false;
      switch (operator) {
        case '=':
        case 'equals':
          conditionMet = selectionCount === targetCount;
          break;
        case '!=':
        case 'not_equals':
          conditionMet = selectionCount !== targetCount;
          break;
        case '>':
        case 'greater_than':
          conditionMet = selectionCount > targetCount;
          break;
        case '<':
        case 'less_than':
          conditionMet = selectionCount < targetCount;
          break;
        case '>=':
        case 'greater_than_or_equal':
          conditionMet = selectionCount >= targetCount;
          break;
        case '<=':
        case 'less_than_or_equal':
          conditionMet = selectionCount <= targetCount;
          break;
        default:
          console.error(`   ❌ Unknown operator: "${operator}"`);
      }
      
      console.log(`   ${conditionMet ? '✅' : '❌'} Condition met: ${conditionMet} (${selectionCount} ${operator} ${targetCount})`);
      
      const nextStepId = conditionMet 
        ? currentStep.conditional_logic.selection_count_next_step 
        : currentStep.conditional_logic.selection_count_else_step;
      
      console.log(`   📍 Next step ID: "${nextStepId}" (${conditionMet ? 'TRUE path' : 'FALSE path'})`);
      console.log(`   🔍 selection_count_next_step: "${currentStep.conditional_logic.selection_count_next_step}"`);
      console.log(`   🔍 selection_count_else_step: "${currentStep.conditional_logic.selection_count_else_step}"`);
      
      if (nextStepId) {
        const nextIndex = workflow.steps.findIndex(s => s.step_id === nextStepId);
        console.log(`   🎯 Looking for step "${nextStepId}" in workflow -> found at index: ${nextIndex}`);
        if (nextIndex !== -1) {
          const nextStepTitle = workflow.steps[nextIndex].step_title;
          console.log(`   ➡️  SUCCESS: Navigating to step index ${nextIndex + 1}: "${nextStepTitle}"`);
          setCurrentStepIndex(nextIndex);
          return;
        } else {
          console.error(`   ❌ ERROR: Next step "${nextStepId}" NOT FOUND in workflow steps!`);
          console.error(`   📋 Available step IDs:`, workflow.steps.map(s => s.step_id));
        }
      } else {
        console.warn(`   ⚠️  WARNING: No next step defined for count-based branching!`);
      }
      } else {
        console.log('   ℹ️  Count-based branching config exists but no routing steps defined');
      }
    }
    
    if (currentStep.conditional_logic) {
      console.log('[EVALUATING CONDITIONAL LOGIC]');
      console.log('Full conditional_logic:', JSON.stringify(currentStep.conditional_logic, null, 2));
      const nextStepId = await evaluateConditionalLogic(currentStep.conditional_logic, answer, answers);
      console.log(`Conditional logic returned next step: ${nextStepId}`);
      if (nextStepId) {
        const nextIndex = workflow.steps.findIndex(s => s.step_id === nextStepId);
        if (nextIndex !== -1) {
          console.log(`Navigating to step index ${nextIndex + 1}: ${workflow.steps[nextIndex].step_title}`);
          setCurrentStepIndex(nextIndex);
          return;
        } else {
          console.log(`WARNING: Next step ID "${nextStepId}" not found in workflow steps!`);
        }
      } else {
        console.log('Conditional logic returned null/empty next step');
      }
    }

    if (currentStep.question_type === 'yes_no' || currentStep.question_type === 'single_choice') {
      console.log('[CHECKING OPTION-BASED NEXT STEP]');
      const selectedOption = currentStep.options?.find(opt => opt.value === answer);
      console.log(`Selected option:`, selectedOption);
      if (selectedOption?.next_step) {
        const nextIndex = workflow.steps.findIndex(s => s.step_id === selectedOption.next_step);
        if (nextIndex !== -1) {
          console.log(`Navigating to step index ${nextIndex + 1} via option next_step`);
          setCurrentStepIndex(nextIndex);
          return;
        }
      }
    }

    if (currentStep.default_next_step) {
      console.log(`[DEFAULT NEXT STEP]: ${currentStep.default_next_step}`);
      const nextIndex = workflow.steps.findIndex(s => s.step_id === currentStep.default_next_step);
      if (nextIndex !== -1) {
        console.log(`Navigating to step index ${nextIndex + 1} via default_next_step`);
        setCurrentStepIndex(nextIndex);
        return;
      }
    }

    console.log('[SEQUENTIAL NAVIGATION]');
    if (currentStepIndex < workflow.steps.length - 1) {
      console.log(`Going to next step in sequence: ${currentStepIndex + 2}`);
      setCurrentStepIndex(currentStepIndex + 1);
    } else {
      console.log('Last step reached, completing workflow');
      handleComplete();
    }
    console.log(`========== END HANDLE NEXT ==========\n`);
  };

  const handleBack = () => {
    if (history.length > 0) {
      setHistory(prev => prev.slice(0, -1));
    }
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
    }
  };

  const getFieldValue = (fieldPath, allAnswers) => {
    if (!fieldPath) return undefined;
    
    if (fieldPath.includes('.')) {
      const [stepId, subField] = fieldPath.split('.');
      const stepAnswer = allAnswers[stepId];
      
      if (stepAnswer && typeof stepAnswer === 'object' && !Array.isArray(stepAnswer)) {
        const value = stepAnswer[subField];
        console.log(`getFieldValue("${fieldPath}") - stepAnswer[${subField}]:`, value);
        return value;
      }
      console.log(`getFieldValue("${fieldPath}") - stepAnswer not an object or undefined:`, stepAnswer);
      return undefined;
    }
    
    const value = allAnswers[fieldPath];
    console.log(`getFieldValue("${fieldPath}") - direct lookup:`, value);
    return value;
  };

  const evaluateSingleCondition = async (condition, allAnswers) => {
    console.log('    --- Evaluating Single Condition ---');
    console.log('    Condition Object:', JSON.stringify(condition, null, 2));
    console.log(`    Field: ${condition.field}, Operator: ${condition.operator}, Value: ${condition.value}, Value Type: ${condition.value_type}`);
    
    const fieldAnswer = getFieldValue(condition.field, allAnswers);
    console.log(`    Field Answer for "${condition.field}":`, fieldAnswer);
    console.log(`    Field Answer Type:`, typeof fieldAnswer);
    
    let comparisonValue = condition.value;
    if (condition.value_type === 'field_reference') {
      console.log(`    Value Type is field_reference, looking up: ${condition.value}`);
      comparisonValue = getFieldValue(condition.value, allAnswers);
      console.log(`    Resolved field reference value:`, comparisonValue);
    } else {
      console.log(`    Value Type is static, using value: ${comparisonValue}`);
    }
    
    let met = false;

    const isArrayAnswer = Array.isArray(fieldAnswer);
    
    switch (condition.operator) {
      case '=':
        if (isArrayAnswer) {
          met = fieldAnswer.includes(comparisonValue);
        } else {
          // Handle boolean vs string comparison
          if (typeof fieldAnswer === 'boolean' && typeof comparisonValue === 'string') {
            met = fieldAnswer === (comparisonValue === 'true');
          } else {
            met = fieldAnswer === comparisonValue;
          }
        }
        break;
      case '!=':
        if (isArrayAnswer) {
          met = !fieldAnswer.includes(comparisonValue);
        } else {
          // Handle boolean vs string comparison
          if (typeof fieldAnswer === 'boolean' && typeof comparisonValue === 'string') {
            met = fieldAnswer !== (comparisonValue === 'true');
          } else {
            met = fieldAnswer !== comparisonValue;
          }
        }
        break;
      case '>':
        met = Number(fieldAnswer) > Number(comparisonValue);
        break;
      case '<':
        met = Number(fieldAnswer) < Number(comparisonValue);
        break;
      case '>=':
        met = Number(fieldAnswer) >= Number(comparisonValue);
        break;
      case '<=':
        met = Number(fieldAnswer) <= Number(comparisonValue);
        break;
      case 'contains':
        if (isArrayAnswer) {
          met = fieldAnswer.some(opt => String(opt).includes(String(comparisonValue)));
        } else {
          met = String(fieldAnswer || '').includes(String(comparisonValue));
        }
        break;
      case 'in':
        if (isArrayAnswer) {
          const comparisonList = String(comparisonValue).split(',').map(v => v.trim());
          met = fieldAnswer.some(opt => comparisonList.includes(String(opt)));
        } else {
          met = String(comparisonValue).split(',').map(v => v.trim()).includes(String(fieldAnswer));
        }
        break;
      case 'not_in':
        if (isArrayAnswer) {
          const comparisonList = String(comparisonValue).split(',').map(v => v.trim());
          met = !fieldAnswer.some(opt => comparisonList.includes(String(opt)));
        } else {
          met = !String(comparisonValue).split(',').map(v => v.trim()).includes(String(fieldAnswer));
        }
        break;
      case 'is_crs':
        console.log('    [IS_CRS OPERATOR] - checking fieldAnswer:', fieldAnswer);
        if (fieldAnswer) {
          try {
            const crsCountries = await base44.entities.CrsCountryInfo.filter({
              $or: [
                { country_name: fieldAnswer },
                { country_code: fieldAnswer }
              ]
            });
            console.log('    [IS_CRS] CRS Countries found:', crsCountries);
            met = crsCountries.length > 0 && crsCountries[0].is_crs_country === true;
            console.log('    [IS_CRS] Result - met:', met);
          } catch (error) {
            console.error("    [IS_CRS] Error checking CRS country status:", error);
            met = false;
          }
        } else {
          console.log('    [IS_CRS] No fieldAnswer provided, met = false');
          met = false;
        }
        break;
      case 'is_not_crs':
        if (fieldAnswer) {
          try {
            const crsCountries = await base44.entities.CrsCountryInfo.filter({
              $or: [
                { country_name: fieldAnswer },
                { country_code: fieldAnswer }
              ]
            });
            met = crsCountries.length === 0 || crsCountries[0].is_crs_country === false;
          } catch (error) {
            console.error("Error checking CRS country status:", error);
            met = true;
          }
        } else {
          met = true;
        }
        break;
      default:
        met = false;
    }

    console.log(`    >>> Condition Result: ${met}`);
    console.log('    --- End Single Condition ---\n');
    return met;
  };

  const evaluateConditionalLogic = async (logic, currentAnswer, allAnswers) => {
    console.log('\n========== EVALUATING CONDITIONAL LOGIC ==========');
    console.log('Full Logic Object:', JSON.stringify(logic, null, 2));
    console.log('All Current Answers:', JSON.stringify(allAnswers, null, 2));
    console.log('Trigger Field:', logic?.trigger_field);
    console.log('Trigger Value:', logic?.trigger_value);
    console.log('Has condition_groups:', !!logic?.condition_groups?.length);
    console.log('Number of condition_groups:', logic?.condition_groups?.length || 0);

    if (logic?.condition_groups && logic.condition_groups.length > 0) {
      console.log('\n========== EVALUATING CONDITION GROUPS ==========');
      console.log(`Total condition_groups: ${logic.condition_groups.length}`);
      console.log('Overall Logic Operator:', logic.overall_logic_operator);
      console.log('Overall True Step:', logic.overall_true_step);
      console.log('Overall False Step:', logic.overall_false_step);
      console.log('🔍 TRIGGER CHECK - trigger_field:', logic.trigger_field);
      console.log('🔍 TRIGGER CHECK - trigger_value:', logic.trigger_value);
      console.log('🔍 TRIGGER CHECK - currentAnswer:', currentAnswer);
      
      if (logic.trigger_field && logic.trigger_value) {
        const triggerStepAnswer = allAnswers[logic.trigger_field];
        console.log(`🔍 TRIGGER STEP ANSWER for "${logic.trigger_field}":`, triggerStepAnswer);
        
        if (triggerStepAnswer !== logic.trigger_value) {
          console.log(`⚠️ TRIGGER NOT MET: Expected "${logic.trigger_value}", got "${triggerStepAnswer}"`);
          console.log(`⚠️ Skipping advanced conditional logic - trigger not satisfied`);
          console.log('========== END CONDITION GROUPS EVALUATION (TRIGGER NOT MET) ==========\n');
          return null;
        } else {
          console.log(`✅ TRIGGER MET: "${triggerStepAnswer}" === "${logic.trigger_value}"`);
        }
      }
      
      const groupResults = [];

      for (let i = 0; i < logic.condition_groups.length; i++) {
        const group = logic.condition_groups[i];
        console.log(`\n--- EVALUATING GROUP ${i + 1}: ${group.group_name || group.group_id} ---`);
        console.log(`Group ID: ${group.group_id}`);
        console.log(`Group Operator: ${group.group_operator}`);
        console.log(`Number of conditions in group: ${group.conditions?.length || 0}`);
        console.log(`Group True Step: ${group.true_step}`);
        console.log(`Group False Step: ${group.false_step}`);

        if (!group.conditions || group.conditions.length === 0) {
          console.log(`WARNING: Group ${group.group_name} has no conditions! Treating as FALSE.`);
          groupResults.push({ group, result: false });
          continue;
        }

        let groupResult = group.group_operator === 'AND' ? true : false;

        for (let j = 0; j < group.conditions.length; j++) {
          const condition = group.conditions[j];
          console.log(`\n  Condition ${j + 1}/${group.conditions.length}:`);
          console.log(`  - Field: ${condition.field}`);
          console.log(`  - Operator: ${condition.operator}`);
          console.log(`  - Value: ${condition.value}`);
          console.log(`  - Value Type: ${condition.value_type}`);
          
          const conditionMet = await evaluateSingleCondition(condition, allAnswers);
          console.log(`  - Result: ${conditionMet}`);
          
          if (group.group_operator === 'AND') {
            groupResult = groupResult && conditionMet;
            console.log(`  - Running AND: groupResult = ${groupResult}`);
            if (!groupResult) {
              console.log(`  - Short-circuit AND (group failed)`);
              break;
            }
          } else {
            groupResult = groupResult || conditionMet;
            console.log(`  - Running OR: groupResult = ${groupResult}`);
            if (groupResult) {
              console.log(`  - Short-circuit OR (group succeeded)`);
              break;
            }
          }
        }

        console.log(`\n>>> GROUP ${i + 1} FINAL RESULT: ${groupResult}`);
        groupResults.push({ group, result: groupResult });
      }

      console.log('\n--- ALL GROUP RESULTS ---');
      groupResults.forEach(({ group, result }, idx) => {
        console.log(`Group ${idx + 1} (${group.group_name}): ${result}`);
      });

      if (logic.overall_logic_operator) {
        console.log(`\n--- COMBINING GROUPS with ${logic.overall_logic_operator} ---`);
        let finalResult = logic.overall_logic_operator === 'AND' ? true : false;

        for (let i = 0; i < groupResults.length; i++) {
          const { result } = groupResults[i];
          if (logic.overall_logic_operator === 'AND') {
            finalResult = finalResult && result;
            console.log(`After group ${i + 1}: finalResult = ${finalResult} (AND logic)`);
            if (!finalResult) {
              console.log('Short-circuit AND - stopping evaluation');
              break;
            }
          } else {
            finalResult = finalResult || result;
            console.log(`After group ${i + 1}: finalResult = ${finalResult} (OR logic)`);
            if (finalResult) {
              console.log('Short-circuit OR - stopping evaluation');
              break;
            }
          }
        }

        console.log(`\n>>> FINAL OVERALL RESULT: ${finalResult}`);
        const nextStep = finalResult ? logic.overall_true_step : logic.overall_false_step;
        console.log(`>>> RETURNING NEXT STEP: ${nextStep} (${finalResult ? 'TRUE' : 'FALSE'} path)`);
        
        const nextStepObj = workflow.steps.find(s => s.step_id === nextStep);
        if (nextStepObj) {
          console.log(`>>> Next step title: ${nextStepObj.step_title}`);
        } else {
          console.log(`>>> WARNING: Next step "${nextStep}" not found in workflow!`);
        }
        
        console.log('========== END CONDITION GROUPS EVALUATION ==========\n');
        return nextStep;
      } else {
        console.log('\n--- NO OVERALL OPERATOR - using first group result ---');
        const firstGroup = groupResults[0];
        const nextStep = firstGroup.result ? firstGroup.group.true_step : firstGroup.group.false_step;
        console.log(`First group result: ${firstGroup.result}`);
        console.log(`Returning next step: ${nextStep}`);
        console.log('========== END CONDITION GROUPS EVALUATION ==========\n');
        return nextStep;
      }
    }

    console.log('\n--- EVALUATING LEGACY SIMPLE CONDITIONS ---');
    if (!logic?.conditions || logic.conditions.length === 0) {
      console.log('No simple conditions found, returning else_step:', logic.else_step);
      console.log('========== END CONDITIONAL LOGIC EVALUATION ==========\n');
      return logic.else_step;
    }

    console.log(`Evaluating ${logic.conditions.length} simple conditions`);
    let conditionsMet = true;
    for (let i = 0; i < logic.conditions.length; i++) {
      const condition = logic.conditions[i];
      console.log(`\nSimple Condition ${i + 1}/${logic.conditions.length}:`);
      const met = await evaluateSingleCondition(condition, allAnswers);
      
      if (condition.logic_operator === 'AND' && !met) {
        console.log('AND condition failed, conditionsMet = false');
        conditionsMet = false;
        break;
      }
      if (condition.logic_operator === 'OR' && met) {
        console.log('OR condition met, conditionsMet = true');
        conditionsMet = true;
        break;
      }
    }

    console.log('\n>>> Final conditionsMet:', conditionsMet);
    const resultStep = conditionsMet ? logic.next_step : logic.else_step;
    console.log(`>>> Returning: ${resultStep} (${conditionsMet ? 'next_step' : 'else_step'})`);
    console.log('========== END CONDITIONAL LOGIC EVALUATION ==========\n');
    
    return resultStep;
  };

  const executePostCompletionActions = async (actions) => {
    if (!actions || actions.length === 0) {
      console.log('[POST-COMPLETION ACTIONS] No actions to execute');
      return;
    }

    console.log(`\n🎬 [POST-COMPLETION ACTIONS] Starting execution of ${actions.length} action(s)`);
    console.log('[POST-COMPLETION ACTIONS] Actions:', JSON.stringify(actions, null, 2));

    for (let i = 0; i < actions.length; i++) {
      const action = actions[i];
      console.log(`\n📌 [ACTION ${i + 1}/${actions.length}] Processing:`, action);
      
      try {
        let targetEntityId = null;
        let targetEntityType = action.target_entity_type;

        console.log(`   Target Entity Type: ${targetEntityType}`);
        console.log(`   Available IDs - accountId: ${accountId}, entityId: ${entityId}`);

        if (targetEntityType === "Account" && accountId) {
          targetEntityId = accountId;
          console.log(`   ✓ Using Account ID: ${targetEntityId}`);
        } else if (targetEntityType === "Entity" && entityId) {
          targetEntityId = entityId;
          console.log(`   ✓ Using Entity ID: ${targetEntityId}`);
        } else if (targetEntityType === "ControllingPerson") {
          // For ControllingPerson, we need to get the ID from the workflow answer
          // Check if there's a controlling_person_input step
          console.log(`   ℹ️  ControllingPerson target detected`);
          console.log(`   All answers:`, answers);
          
          // Look for controlling_person_input step answer
          const cpInputStep = workflow.steps.find(s => s.question_type === 'controlling_person_input');
          if (cpInputStep) {
            const cpAnswer = answers[cpInputStep.step_id];
            console.log(`   Found controlling_person_input step: ${cpInputStep.step_id}`);
            console.log(`   Answer:`, cpAnswer);
            
            if (cpAnswer?.savedPersons && cpAnswer.savedPersons.length > 0) {
              // Get the most recently added controlling person
              const latestPerson = cpAnswer.savedPersons[cpAnswer.savedPersons.length - 1];
              targetEntityId = latestPerson.id;
              console.log(`   ✓ Using ControllingPerson ID from latest person: ${targetEntityId}`);
            } else {
              console.warn(`   ⚠️  No saved controlling persons found in answer`);
            }
          } else {
            // Try to get from initialData if passed
            if (initialData?.controllingPersonId) {
              targetEntityId = initialData.controllingPersonId;
              console.log(`   ✓ Using ControllingPerson ID from initialData: ${targetEntityId}`);
            } else {
              console.warn(`   ⚠️  No controlling_person_input step found and no initialData.controllingPersonId`);
            }
          }
        }

        if (!targetEntityId || !targetEntityType) {
          console.error(`   ❌ [ACTION ${i + 1}] FAILED: No valid target entity found`);
          console.error(`   - targetEntityType: ${targetEntityType}`);
          console.error(`   - targetEntityId: ${targetEntityId}`);
          continue;
        }

        console.log(`   ✅ Target identified: ${targetEntityType} (ID: ${targetEntityId})`);


        let valueToUpdate = null;
        
        console.log(`   Value Source: ${action.value_source}`);
        console.log(`   Raw Value: ${action.value}`);
        
        if (action.value_source === "static_value") {
          valueToUpdate = action.value;
          console.log(`   → Static value: ${valueToUpdate}`);
        } else if (action.value_source === "from_step_answer") {
          const sourceStepId = action.value;
          valueToUpdate = answers[sourceStepId];
          console.log(`   → From step answer (${sourceStepId}): ${valueToUpdate}`);
          
          if (valueToUpdate === 'YES') {
            valueToUpdate = true;
            console.log(`   → Converted 'YES' to true`);
          }
          if (valueToUpdate === 'NO') {
            valueToUpdate = false;
            console.log(`   → Converted 'NO' to false`);
          }
        } else if (action.value_source === "from_workflow_outcome") {
          const resultStep = workflow.steps.find(s => s.question_type === 'result');
          valueToUpdate = resultStep?.result_description || action.value;
          console.log(`   → From workflow outcome: ${valueToUpdate}`);
        }
        
        console.log(`   Final value to update: ${valueToUpdate} (type: ${typeof valueToUpdate})`);


        if (action.condition) {
          console.log(`   📋 Evaluating condition:`, action.condition);
          const conditionField = action.condition.field;
          const conditionOperator = action.condition.operator;
          const conditionValue = action.condition.value;
          
          const fieldValue = answers[conditionField];
          console.log(`   Condition: ${conditionField} (value: ${fieldValue}) ${conditionOperator} ${conditionValue}`);
          
          let conditionMet = false;
          switch (conditionOperator) {
            case '=':
              conditionMet = fieldValue === conditionValue;
              break;
            case '!=':
              conditionMet = fieldValue !== conditionValue;
              break;
            case 'contains':
              conditionMet = String(fieldValue || '').includes(String(conditionValue));
              break;
            case 'in':
              conditionMet = String(conditionValue).split(',').map(v => v.trim()).includes(String(fieldValue));
              break;
            case 'not_in':
              conditionMet = !String(conditionValue).split(',').map(v => v.trim()).includes(String(fieldValue));
              break;
            default:
              conditionMet = false;
          }
          
          console.log(`   Condition result: ${conditionMet ? '✅ MET' : '❌ NOT MET'}`);
          
          if (!conditionMet) {
            console.log(`   ⏭️  Skipping action due to unmet condition`);
            continue;
          }
        }


        const fieldToUpdate = action.field_to_update;
        const updateData = { [fieldToUpdate]: valueToUpdate };

        console.log(`   🔄 Preparing update:`);
        console.log(`   - Entity Type: ${targetEntityType}`);
        console.log(`   - Entity ID: ${targetEntityId}`);
        console.log(`   - Field: ${fieldToUpdate}`);
        console.log(`   - Value: ${valueToUpdate}`);
        console.log(`   - Update Data:`, updateData);

        if (targetEntityType === "Account") {
          console.log(`   🚀 Executing Account.update...`);
          await base44.entities.Account.update(targetEntityId, updateData);
          console.log(`   ✅ Account.${fieldToUpdate} updated successfully`);
          
          const updatedAccounts = await base44.entities.Account.filter({ id: targetEntityId });
          if (updatedAccounts[0]) {
            setMappedEntityData(updatedAccounts[0]);
            console.log(`   🔄 Refreshed account data in state`);
          }
        } else if (targetEntityType === "Entity") {
          console.log(`   🚀 Executing Entity.update...`);
          await base44.entities.Entity.update(targetEntityId, updateData);
          console.log(`   ✅ Entity.${fieldToUpdate} updated successfully`);
          
          const updatedEntities = await base44.entities.Entity.filter({ id: targetEntityId });
          if (updatedEntities[0]) {
            setMappedEntityData(updatedEntities[0]);
            console.log(`   🔄 Refreshed entity data in state`);
          }
        } else if (targetEntityType === "ControllingPerson") {
          console.log(`   🚀 Executing ControllingPerson.update...`);
          await base44.entities.ControllingPerson.update(targetEntityId, updateData);
          console.log(`   ✅ ControllingPerson.${fieldToUpdate} updated successfully`);
          
          // If account is associated, also check if we need to sync the account
          if (accountId) {
            console.log(`   🔄 Syncing account controlling persons count...`);
            try {
              await base44.functions.invoke('syncAccountControllingPersons', { accountId: accountId });
              console.log(`   ✅ Account sync completed`);
              
              const updatedAccounts = await base44.entities.Account.filter({ id: accountId });
              if (updatedAccounts[0]) {
                setMappedEntityData(updatedAccounts[0]);
                console.log(`   🔄 Refreshed account data in state`);
              }
            } catch (syncError) {
              console.error(`   ⚠️  Account sync failed:`, syncError);
            }
          }
        }
        
        console.log(`   ✅ [ACTION ${i + 1}] Completed successfully\n`);

      } catch (error) {
        console.error(`   ❌ [ACTION ${i + 1}] FAILED with error:`, error);
        console.error(`   Error message:`, error.message);
        console.error(`   Full error:`, error);
        console.error(`   Action that failed:`, action);
      }
    }
    
    console.log(`\n🎬 [POST-COMPLETION ACTIONS] All actions completed\n`);
  };

  const isActionNode = (step) => {
    if (!step) return false;
    
    // A step is an action node if it has any routing mechanism
    return !!(
      step.conditional_logic?.condition_groups?.length > 0 ||
      step.conditional_logic?.conditions?.length > 0 ||
      step.conditional_logic?.multi_choice_routing_groups?.length > 0 ||
      step.options?.some(opt => opt.next_step) ||
      step.default_next_step
    );
  };

  const handleComplete = async () => {
    setLoading(true);
    
    console.log(`[POST-COMPLETION ACTIONS] Checking for "after_workflow" actions across all steps`);
    for (const step of workflow.steps) {
      if (step.post_completion_actions && step.post_completion_actions.length > 0) {
        const afterWorkflowActions = step.post_completion_actions.filter(
          action => action.execution_timing === "after_workflow"
        );
        if (afterWorkflowActions.length > 0) {
          console.log(`[POST-COMPLETION ACTIONS] Executing ${afterWorkflowActions.length} "after_workflow" action(s) from step: ${step.step_title}`);
          await executePostCompletionActions(afterWorkflowActions);
        }
      }
    }
    
    const completionData = Object.entries(answers).map(([stepId, answer]) => {
      const step = workflow.steps.find(s => s.step_id === stepId);
      return {
        step_id: stepId,
        step_title: step?.step_title,
        answer: answer,
        result_status: step?.result_status,
        result_description: step?.result_description
      };
    });

    const updates = {};
    for (const [stepId, answer] of Object.entries(answers)) {
      const step = workflow.steps.find(s => s.step_id === stepId);
      if (step?.mapped_field && step.mapped_field.entity_type === mappedEntityType && step.mapped_field.field_name) {
        const fieldName = step.mapped_field.field_name;
        let valueToUpdate = answer;

        if (step.question_type === 'yes_no') {
          valueToUpdate = (answer === 'YES');
        } else if (step.question_type === 'number_input') {
          valueToUpdate = Number(answer);
        } else if (step.question_type === 'date_input' && answer) {
          valueToUpdate = answer.includes('T') ? answer.split('T')[0] : answer;
        } else if (step.question_type === 'file_upload') {
          // For file_upload, we might want to store just the file URLs or a specific identifier
          // For now, storing the whole answer object from file_upload, or handling files specifically
          // This assumes the backend handles the new file_upload answer structure correctly
          valueToUpdate = answer.files || []; // Store only the files array if it exists, else empty
        }

        updates[fieldName] = valueToUpdate;
      }
    }

    try {
      if (Object.keys(updates).length > 0 && mappedEntityType && mappedEntityId) {
        if (mappedEntityType === "Account") {
          await base44.entities.Account.update(mappedEntityId, updates);
        } else if (mappedEntityType === "Entity") {
          await base44.entities.Entity.update(mappedEntityId, updates);
        }
      }
      onComplete(completionData);
    } catch (error) {
      console.error("Error updating mapped entity fields:", error);
      alert("Workflow completed, but failed to update mapped fields: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const renderQuestionInput = () => {
    const answer = answers[currentStep.step_id];

    switch (currentStep.question_type) {
      case 'yes_no':
        const yesNoOptions = currentStep.options || [
          { value: "YES", label: "Yes" },
          { value: "NO", label: "No" }
        ];
        
        return (
          <div className="space-y-3">
            <RadioGroup value={answer} onValueChange={(value) => handleAnswer(currentStep.step_id, value)}>
              {yesNoOptions.map((option) => (
                <div 
                  key={option.value}
                  className="flex items-center space-x-3 p-4 rounded-lg border-2 border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50 transition-all cursor-pointer"
                  onClick={() => handleAnswer(currentStep.step_id, option.value)}
                >
                  <RadioGroupItem value={option.value} id={option.value} />
                  <Label 
                    htmlFor={option.value}
                    className="flex-1 cursor-pointer font-medium text-slate-900"
                  >
                    {option.label}
                  </Label>
                  {option.value === answer && (
                    <CheckCircle2 className="w-5 h-5 text-indigo-600" />
                  )}
                </div>
              ))}
            </RadioGroup>
          </div>
        );

      case 'single_choice':
        return (
          <div className="space-y-4">
            <Select
              value={answer}
              onValueChange={(value) => handleAnswer(currentStep.step_id, value)}
            >
              <SelectTrigger className="w-full h-12">
                <SelectValue placeholder="Select an option..." />
              </SelectTrigger>
              <SelectContent>
                {currentStep.options?.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );

      case 'multiple_choice':
        const selectedOptions = answer ? (Array.isArray(answer) ? answer : answer.split(',').filter(Boolean)) : [];
        
        console.log('🎯 [MULTIPLE CHOICE RENDER]');
        console.log('   Step ID:', currentStep.step_id);
        console.log('   Answer value:', answer);
        console.log('   Selected options array:', selectedOptions);
        console.log('   Available options:', currentStep.options?.map(o => ({ value: o.value, label: o.label })));
        
        return (
          <div className="space-y-3">
            {currentStep.options?.map((option, index) => {
              const isSelected = selectedOptions.includes(option.value);
              
              console.log(`   Option ${index + 1}: value="${option.value}", label="${option.label}", isSelected=${isSelected}`);
              
              return (
                <div 
                  key={option.value}
                  className={`flex items-center space-x-3 p-4 rounded-lg border-2 transition-all cursor-pointer ${
                    isSelected
                      ? 'border-indigo-400 bg-indigo-50'
                      : 'border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50'
                  }`}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    console.log(`\n🖱️ [CLICK EVENT] Option ${index + 1} clicked`);
                    console.log('   Clicked option value:', option.value);
                    console.log('   Current selectedOptions before change:', selectedOptions);
                    console.log('   isSelected before change:', isSelected);
                    
                    const newValues = isSelected
                      ? selectedOptions.filter(v => v !== option.value)
                      : [...selectedOptions, option.value];
                    
                    console.log('   New values array:', newValues);
                    console.log('   Calling handleAnswer with:', { stepId: currentStep.step_id, newValues });
                    
                    handleAnswer(currentStep.step_id, newValues);
                  }}
                >
                  <Checkbox 
                    checked={isSelected}
                    onCheckedChange={() => {}}
                  />
                  <span className="flex-1 cursor-pointer font-medium text-slate-900">
                    {option.label}
                  </span>
                  {isSelected && (
                    <CheckCircle2 className="w-5 h-5 text-indigo-600" />
                  )}
                </div>
              );
            })}
            {selectedOptions.length > 0 && (
              <p className="text-sm text-slate-600 mt-2">
                {selectedOptions.length} option(s) selected
              </p>
            )}
          </div>
        );

      case 'text_input':
        return (
          <Input
            value={answer || ""}
            onChange={(e) => handleAnswer(currentStep.step_id, e.target.value)}
            placeholder={currentStep.help_text || "Enter your answer..."}
          />
        );

      case 'textarea':
        return (
          <Textarea
            value={answer || ""}
            onChange={(e) => handleAnswer(currentStep.step_id, e.target.value)}
            placeholder={currentStep.help_text || "Enter your answer..."}
            rows={4}
          />
        );

      case 'number_input':
        return (
          <Input
            type="number"
            value={answer || ""}
            onChange={(e) => handleAnswer(currentStep.step_id, e.target.value)}
            placeholder={currentStep.help_text || "Enter a number..."}
          />
        );

      case 'date_input':
        let dateValue = '';
        if (answer) {
          if (typeof answer === 'string') {
            dateValue = answer.includes('T') ? answer.split('T')[0] : answer;
          }
        }
        
        return (
          <Input
            key={`${currentStep.step_id}-${dateValue}`}
            type="date"
            value={dateValue}
            onChange={(e) => handleAnswer(currentStep.step_id, e.target.value)}
          />
        );

      case 'file_upload':
        const fileConfig = currentStep.file_upload_config || {};
        const requireDateReceived = fileConfig.require_date_received || false;
        
        // Answer structure: { files: [], date_received: "" }
        const fileAnswer = answer || { files: [], date_received: "" };
        const uploadedFiles = fileAnswer.files || [];
        const dateReceived = fileAnswer.date_received || "";
        const isUploading = uploadingFiles[currentStep.step_id];
        const isDragging = dragActive[currentStep.step_id];

        const handleFileChange = async (files) => {
          if (!files || files.length === 0) return;

          setUploadingFiles(prev => ({ ...prev, [currentStep.step_id]: true }));

          try {
            const uploadPromises = Array.from(files).map(async (file) => {
              const { file_url } = await base44.integrations.Core.UploadFile({ file });
              return {
                name: file.name,
                url: file_url,
                size: file.size,
                type: file.type
              };
            });

            const newFiles = await Promise.all(uploadPromises);
            const currentFiles = Array.isArray(fileAnswer.files) ? fileAnswer.files : [];
            handleAnswer(currentStep.step_id, { 
              ...fileAnswer,
              files: [...currentFiles, ...newFiles]
            });
          } catch (error) {
            console.error("File upload error:", error);
            alert("Failed to upload file(s). Please try again.");
          } finally {
            setUploadingFiles(prev => ({ ...prev, [currentStep.step_id]: false }));
          }
        };

        const handleDrag = (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(prev => ({ ...prev, [currentStep.step_id]: true }));
          } else if (e.type === "dragleave") {
            setDragActive(prev => ({ ...prev, [currentStep.step_id]: false }));
          }
        };

        const handleDrop = (e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragActive(prev => ({ ...prev, [currentStep.step_id]: false }));
          
          if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFileChange(e.dataTransfer.files);
          }
        };

        const removeFile = (index) => {
          const currentFiles = Array.isArray(fileAnswer.files) ? fileAnswer.files : [];
          const newFiles = currentFiles.filter((_, i) => i !== index);
          handleAnswer(currentStep.step_id, {
            ...fileAnswer,
            files: newFiles
          });
        };

        const handleDateReceivedChange = (date) => {
          handleAnswer(currentStep.step_id, {
            ...fileAnswer,
            date_received: date
          });
        };

        return (
          <div className="space-y-4">
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-all ${
                isDragging
                  ? 'border-indigo-500 bg-indigo-50'
                  : 'border-slate-300 hover:border-indigo-400 hover:bg-slate-50'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <input
                type="file"
                id={`file-upload-${currentStep.step_id}`}
                className="hidden"
                onChange={(e) => handleFileChange(e.target.files)}
                multiple
                disabled={isUploading}
              />
              
              <Upload className={`w-12 h-12 mx-auto mb-4 ${isDragging ? 'text-indigo-600' : 'text-slate-400'}`} />
              
              {isUploading ? (
                <div className="space-y-2">
                  <Loader2 className="w-8 h-8 mx-auto animate-spin text-indigo-600" />
                  <p className="text-sm font-medium text-slate-700">Uploading files...</p>
                </div>
              ) : (
                <>
                  <p className="text-sm font-medium text-slate-700 mb-2">
                    {isDragging ? 'Drop files here' : 'Drag and drop files here'}
                  </p>
                  <p className="text-xs text-slate-500 mb-4">or</p>
                  <label
                    htmlFor={`file-upload-${currentStep.step_id}`}
                    className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 cursor-pointer transition-colors"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Choose Files
                  </label>
                </>
              )}
            </div>

            {uploadedFiles.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-700">
                  Uploaded Files ({uploadedFiles.length})
                </p>
                {uploadedFiles.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <FileCheck className="w-5 h-5 text-green-600 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">{file.name}</p>
                        {file.size && (
                          <p className="text-xs text-slate-500">
                            {(file.size / 1024).toFixed(1)} KB
                          </p>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(index)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {requireDateReceived && (
              <div className="mt-4">
                <Label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Date Received
                  <span className="text-red-600">*</span>
                </Label>
                <Input
                  type="date"
                  value={dateReceived}
                  onChange={(e) => handleDateReceivedChange(e.target.value)}
                  className="mt-1.5"
                  placeholder="Select date received"
                />
              </div>
            )}
          </div>
        );

      case 'address_input':
        const addressData = answer || {
          street: "",
          city: "",
          state: "",
          postal_code: "",
          country: "",
          tin: ""
        };

        const handleAddressChange = (field, value) => {
          handleAnswer(currentStep.step_id, {
            ...addressData,
            [field]: value
          });
        };

        const uploadedDocument = (() => {
          for (const [stepId, answerValue] of Object.entries(answers)) {
            const step = workflow.steps.find(s => s.step_id === stepId);
            if (step?.question_type === 'file_upload') {
              const files = answerValue?.files || answerValue; // Handle both new and old format
              if (Array.isArray(files) && files.length > 0) {
                return files[0]; // Get the first uploaded file
              }
            }
          }
          return null;
        })();

        const isImage = uploadedDocument?.type?.startsWith('image/');
        const isPDF = uploadedDocument?.type === 'application/pdf' || uploadedDocument?.url?.endsWith('.pdf');

        return (
          <div className="space-y-4">
            {uploadedDocument && (
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <FileCheck className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 space-y-3">
                      <div>
                        <p className="text-sm font-semibold text-blue-900 mb-1">Self-Certification Document</p>
                        <p className="text-xs text-blue-700">{uploadedDocument.name}</p>
                      </div>
                      
                      {isImage && (
                        <div className="border-2 border-blue-300 rounded-lg overflow-hidden bg-white">
                          <img 
                            src={uploadedDocument.url} 
                            alt="Self-certification document" 
                            className="w-full h-auto max-h-96 object-contain"
                          />
                        </div>
                      )}
                      
                      {isPDF && (
                        <div className="border-2 border-blue-300 rounded-lg overflow-hidden bg-white">
                          <iframe 
                            src={`https://docs.google.com/viewer?url=${encodeURIComponent(uploadedDocument.url)}&embedded=true`}
                            className="w-full h-96"
                            title="Self-certification document"
                          />
                        </div>
                      )}
                      
                      <a 
                        href={uploadedDocument.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-sm text-blue-700 hover:text-blue-900 hover:underline"
                      >
                        <FileCheck className="w-4 h-4" />
                        Open in new tab
                      </a>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <div>
              <Label className="text-sm font-medium text-slate-700">
                Street Address <span className="text-red-600">*</span>
              </Label>
              <Input
                value={addressData.street || ""}
                onChange={(e) => handleAddressChange("street", e.target.value)}
                placeholder="123 Main Street"
                className="mt-1.5"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-slate-700">
                  City <span className="text-red-600">*</span>
                </Label>
                <Input
                  value={addressData.city || ""}
                  onChange={(e) => handleAddressChange("city", e.target.value)}
                  placeholder="City"
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label className="text-sm font-medium text-slate-700">
                  State/Province <span className="text-red-600">*</span>
                </Label>
                <Input
                  value={addressData.state || ""}
                  onChange={(e) => handleAddressChange("state", e.target.value)}
                  placeholder="State/Province"
                  className="mt-1.5"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-slate-700">
                  Postal Code <span className="text-red-600">*</span>
                </Label>
                <Input
                  value={addressData.postal_code || ""}
                  onChange={(e) => handleAddressChange("postal_code", e.target.value)}
                  placeholder="Postal Code"
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label className="text-sm font-medium text-slate-700">
                  Country <span className="text-red-600">*</span>
                </Label>
                <Input
                  value={addressData.country || ""}
                  onChange={(e) => handleAddressChange("country", e.target.value)}
                  placeholder="Country"
                  className="mt-1.5"
                />
              </div>
            </div>

            <div>
              <Label className="text-sm font-medium text-slate-700">
                Tax Identification Number (TIN)
              </Label>
              <Input
                value={addressData.tin || ""}
                onChange={(e) => handleAddressChange("tin", e.target.value)}
                placeholder="Enter TIN"
                className="mt-1.5"
              />
            </div>
          </div>
        );

      case 'beneficiary_input':
        return (
          <BeneficiaryInputRenderer
            account={mappedEntityData}
            tenant={{ id: mappedEntityData?.tenant_id }}
            initialBeneficiaries={answer?.draftBeneficiaries}
            savedBeneficiaries={answer?.savedBeneficiaries}
            onBeneficiariesChange={(beneficiaries) => {
              handleAnswer(currentStep.step_id, { 
                ...answer,
                draftBeneficiaries: beneficiaries 
              });
            }}
            onBeneficiariesAdded={async (savedBeneficiaries) => {
              handleAnswer(currentStep.step_id, { 
                ...answer,
                savedBeneficiaries: savedBeneficiaries,
                draftBeneficiaries: savedBeneficiaries
              });
              
              // Update account beneficiaries count
              if (accountId) {
                try {
                  await base44.entities.Account.update(accountId, {
                    beneficiaries_count: savedBeneficiaries.length
                  });
                  const updatedAccounts = await base44.entities.Account.filter({ id: accountId });
                  if (updatedAccounts[0]) {
                    setMappedEntityData(updatedAccounts[0]);
                  }
                } catch (error) {
                  console.error("Error updating beneficiaries count:", error);
                }
              }
            }}
          />
        );

      case 'controlling_person_input':
        return (
          <ControllingPersonInputRenderer
            account={mappedEntityData}
            initialPersons={answer?.draftPersons}
            savedPersons={answer?.savedPersons}
            onPersonsChange={(persons) => {
              handleAnswer(currentStep.step_id, { 
                ...answer,
                draftPersons: persons 
              });
            }}
            onControllingPersonsAdded={async (savedPersons) => {
              handleAnswer(currentStep.step_id, { 
                ...answer,
                savedPersons: savedPersons,
                draftPersons: savedPersons
              });
              
              // Sync controlling persons count and classification status
              if (accountId) {
                try {
                  await base44.functions.invoke('syncAccountControllingPersons', { accountId: accountId });
                  const updatedAccounts = await base44.entities.Account.filter({ id: accountId });
                  if (updatedAccounts[0]) {
                    setMappedEntityData(updatedAccounts[0]);
                  }
                } catch (error) {
                  console.error("Error syncing controlling persons:", error);
                }
              }
            }}
          />
        );

      case 'multi_field_input':
        const multiFieldAnswer = answer || {};
        const multiFieldErrors = {};
        
        return (
          <MultiFieldRenderer
            fields={currentStep.multi_fields || []}
            values={multiFieldAnswer}
            onChange={(newValues) => handleAnswer(currentStep.step_id, newValues)}
            errors={multiFieldErrors}
          />
        );

      case 'info':
        return null;

      case 'result':
        return (
          <Alert className={`${
            currentStep.result_status === 'reportable' ? 'bg-green-50 border-green-200' :
            currentStep.result_status === 'non_reportable' ? 'bg-slate-50 border-slate-200' :
            'bg-blue-50 border-blue-200'
          }`}>
            <CheckCircle2 className="w-4 h-4" />
            <AlertDescription>
              <strong>Result:</strong> {currentStep.result_description}
            </AlertDescription>
          </Alert>
        );

      default:
        return <p className="text-slate-500">Unsupported question type</p>;
    }
  };

  const canProceed = () => {
    if (currentStep.question_type === 'info' || currentStep.question_type === 'result') {
      return true;
    }
    if (!currentStep.required) {
      return true;
    }
    const answer = answers[currentStep.step_id];
    
    if (currentStep.question_type === 'address_input') {
      if (!answer || typeof answer !== 'object') return false;
      return !!(answer.street && answer.city && answer.state && answer.postal_code && answer.country);
    }

    // Special validation for file_upload with date_received
    if (currentStep.question_type === 'file_upload') {
      const fileConfig = currentStep.file_upload_config || {};
      const requireDateReceived = fileConfig.require_date_received || false;
      
      if (!answer) return false;
      
      // Handle both old format (array) and new format (object with files + date_received)
      const files = answer.files || answer;
      const hasFiles = Array.isArray(files) && files.length > 0;
      
      if (!hasFiles) return false;
      
      // If date is required, check it exists and is not empty
      if (requireDateReceived) {
        return !!(answer.date_received && answer.date_received.trim());
      }
      
      return true;
    }

    if (currentStep.question_type === 'beneficiary_input') {
      return answer?.savedBeneficiaries && answer.savedBeneficiaries.length > 0;
    }

    if (currentStep.question_type === 'controlling_person_input') {
      return answer?.savedPersons && answer.savedPersons.length > 0;
    }

    if (currentStep.question_type === 'multi_field_input') {
      if (!answer || typeof answer !== 'object') return false;
      const requiredFields = currentStep.multi_fields?.filter(f => f.is_required) || [];
      return requiredFields.every(field => {
        const value = answer[field.field_id];
        return value !== undefined && value !== null && value !== '';
      });
    }
    
    return answer !== undefined && answer !== null && answer !== '';
  };

  const progress = Math.round(((currentStepIndex + 1) / workflow.steps.length) * 100);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
            {workflow.workflow_name} v{workflow.version}
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowFlowchart(true)}
            className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
          >
            <GitBranch className="w-4 h-4 mr-1" />
            Flowchart
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAIHelper(true)}
            className="text-purple-600 hover:text-purple-700 hover:bg-purple-50"
          >
            <Sparkles className="w-4 h-4 mr-1" />
            AI Assist
          </Button>
        </div>
        <div className="text-right">
          <p className="text-sm font-medium text-slate-700">
            Step {currentStepIndex + 1}
          </p>
          <p className="text-xs text-slate-500">{progress}% Complete</p>
        </div>
      </div>

      <Dialog open={showFlowchart} onOpenChange={setShowFlowchart}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Workflow Flowchart: {workflow.workflow_name}</DialogTitle>
          </DialogHeader>
          <WorkflowVisualizer workflow={workflow} />
        </DialogContent>
      </Dialog>

      <Dialog open={showAIHelper} onOpenChange={setShowAIHelper}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>AI Workflow Assistant</DialogTitle>
          </DialogHeader>
          <AIWorkflowHelper
            currentStep={currentStep}
            workflow={workflow}
            answers={answers}
            recordData={initialData}
            onSuggestedAnswer={(value) => {
              handleAnswer(currentStep.step_id, value);
            }}
          />
        </DialogContent>
      </Dialog>

      {workflow.display_workflow_introduction && (
        <Alert className="bg-blue-50 border-blue-200">
          <Info className="w-4 h-4 text-blue-600" />
          <AlertDescription>
            <div className="space-y-2">
              {workflow.workflow_introduction_text && (
                <p className="text-sm text-blue-900 font-medium">
                  {workflow.workflow_introduction_text}
                </p>
              )}
              {workflow.workflow_introduction_fields && workflow.workflow_introduction_fields.length > 0 && mappedEntityData && (
                <div className="space-y-1 mt-2">
                  {workflow.workflow_introduction_fields.map((field, idx) => {
                    const isComputedCondition = field.field_type === "computed_condition";

                    if (isComputedCondition) {
                      const value1 = Number(mappedEntityData[field.computation_field_1]) || 0;
                      const value2 = Number(mappedEntityData[field.computation_field_2]) || 0;
                      
                      let computedResult = 0;
                      switch (field.computation_operator) {
                        case "add":
                          computedResult = value1 + value2;
                          break;
                        case "subtract":
                          computedResult = value1 - value2;
                          break;
                        case "multiply":
                          computedResult = value1 * value2;
                          break;
                        case "divide":
                          computedResult = value2 !== 0 ? value1 / value2 : 0;
                          break;
                        default:
                          computedResult = value1 + value2;
                      }

                      const threshold = Number(field.threshold_value) || 0;
                      let conditionMet = false;
                      switch (field.comparison_operator) {
                        case "greater_than":
                          conditionMet = computedResult > threshold;
                          break;
                        case "less_than":
                          conditionMet = computedResult < threshold;
                          break;
                        case "equals":
                          conditionMet = computedResult === threshold;
                          break;
                        case "greater_than_or_equal":
                          conditionMet = computedResult >= threshold;
                          break;
                        case "less_than_or_equal":
                          conditionMet = computedResult <= threshold;
                          break;
                        case "not_equals":
                          conditionMet = computedResult !== threshold;
                          break;
                        default:
                          conditionMet = computedResult > threshold;
                      }

                      const displayText = conditionMet ? field.true_text : field.false_text;
                      
                      return (
                        <div key={idx} className="text-sm text-blue-800">
                          {field.display_label && <strong>{field.display_label}: </strong>}
                          {displayText || 'N/A'}
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
                      }
                      
                      return (
                        <p key={idx} className="text-sm text-blue-800">
                          <strong>{field.display_label}:</strong> {fieldValue || 'N/A'}
                        </p>
                      );
                    }
                  })}
                </div>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
          <div 
            className="bg-gradient-to-r from-indigo-500 to-indigo-600 h-3 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>Started</span>
          <span className="font-medium text-indigo-600">{Object.keys(answers).length} questions answered</span>
          <span>Summary</span>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {history.map((stepId, idx) => {
          const step = workflow.steps.find(s => s.step_id === stepId);
          
          return (
            <React.Fragment key={stepId}>
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg border-2 transition-all bg-green-50 border-green-200">
                <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 bg-green-600">
                  <Check className="w-4 h-4 text-white" />
                </div>
                <span className="text-xs font-medium whitespace-nowrap text-green-700">
                  {step?.step_title?.substring(0, 15) || `Step ${idx + 1}`}
                  {step?.step_title?.length > 15 && '...'}
                </span>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
            </React.Fragment>
          );
        })}
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg border-2 transition-all bg-indigo-50 border-indigo-300">
          <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 bg-indigo-600">
            <span className="text-white text-xs font-bold">{currentStepIndex + 1}</span>
          </div>
          <span className="text-xs font-medium whitespace-nowrap text-indigo-700">
            {currentStep?.step_title?.substring(0, 15) || `Step ${currentStepIndex + 1}`}
            {currentStep?.step_title?.length > 15 && '...'}
          </span>
        </div>
      </div>

      <Card className="border-2 border-indigo-100 bg-gradient-to-br from-white to-indigo-50/30 shadow-lg">
        <CardContent className="p-6">
          <div className="space-y-5">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-700 flex items-center justify-center flex-shrink-0 shadow-lg">
                <span className="text-white font-bold text-lg">{currentStepIndex + 1}</span>
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-slate-900 mb-3">
                  {currentStep.step_title}
                </h3>
                {currentStep.question_text && (
                  <p className="text-slate-700 mb-3 leading-relaxed">{currentStep.question_text}</p>
                )}
                {currentStep.help_text && (
                  <Alert className="bg-blue-50 border-blue-200 mb-4">
                    <Info className="w-4 h-4 text-blue-600" />
                    <AlertDescription className="text-sm text-blue-900">
                      {currentStep.help_text}
                    </AlertDescription>
                  </Alert>
                )}
                {currentStep.regulatory_reference && (
                  <p className="text-xs text-slate-500 italic mb-3 flex items-center gap-2">
                    <FileCheck className="w-3 h-3" />
                    Reference: {currentStep.regulatory_reference}
                  </p>
                )}
              </div>
            </div>

            <div className="pl-16">
              {renderQuestionInput()}
            </div>
          </div>
        </CardContent>
      </Card>

      {Object.keys(answers).length > 0 && (
        <Card className="bg-slate-50 border-slate-200">
          <CardContent className="p-4">
            <details className="cursor-pointer">
              <summary className="text-sm font-semibold text-slate-700 flex items-center gap-2 hover:text-indigo-600 transition-colors">
                <FileCheck className="w-4 h-4" />
                View Previous Answers ({Object.keys(answers).length})
              </summary>
              <div className="mt-3 space-y-2 pl-6">
                {Object.entries(answers).map(([key, value]) => {
                  const step = workflow.steps.find(s => s.step_id === key);
                  if (!step) return null;
                  
                  let displayValue = '';
                  if (Array.isArray(value)) {
                    displayValue = value.join(', ');
                  } else if (typeof value === 'object' && value !== null) {
                    // For file_upload, show number of files and date received if available
                    if (step.question_type === 'file_upload') {
                      const filesCount = value.files?.length || 0;
                      const dateReceivedText = value.date_received ? ` (Received: ${value.date_received})` : '';
                      displayValue = `${filesCount} file(s) uploaded${dateReceivedText}`;
                    } else if (key === currentStep.step_id && currentStep.question_type === 'address_input') {
                      // For current step address input, show basic address
                      displayValue = `${value.street || ''}, ${value.city || ''}, ${value.country || ''}`;
                    } else if (key === currentStep.step_id && (currentStep.question_type === 'beneficiary_input' || currentStep.question_type === 'controlling_person_input')) {
                      displayValue = 'Data entered'; // Or a more specific summary if desired
                    } else {
                      displayValue = 'Data entered';
                    }
                  } else {
                    displayValue = step.options?.find(o => o.value === value)?.label || String(value || '');
                  }
                  
                  return (
                    <div key={key} className="flex items-start justify-between gap-4 text-sm py-2 border-b border-slate-200 last:border-0">
                      <span className="text-slate-600 text-xs flex-shrink-0 max-w-[40%]">
                        {step.step_title || key}
                      </span>
                      <span className="text-xs text-right text-slate-800 break-words">
                        {displayValue}
                      </span>
                    </div>
                  );
                })}
              </div>
            </details>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-between gap-3 pt-4 border-t">
        <Button
          type="button"
          variant="outline"
          onClick={history.length === 0 ? onCancel : handleBack}
          disabled={loading}
          size="lg"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          {history.length === 0 ? "Cancel" : "Previous"}
        </Button>

        <Button
          type="button"
          onClick={isLastStep || currentStep.question_type === 'result' ? handleComplete : handleNext}
          disabled={!canProceed() || loading}
          size="lg"
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-8"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : isLastStep || currentStep.question_type === 'result' ? (
            <>
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Complete
            </>
          ) : (
            <>
              Next Question
              <ArrowRight className="w-4 h-4 ml-2" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}