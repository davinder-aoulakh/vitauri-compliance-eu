import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, ArrowRight, ArrowLeft, Info, FileCheck, Loader2, Check, Circle, AlertCircle, GitBranch, Lock } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import WorkflowVisualizer from "../workflows/WorkflowVisualizer";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import AIWorkflowHelper from "../ai/AIWorkflowHelper";

export default function EntityClassification({ entity, onComplete, onCancel }) {
  const [currentNodeId, setCurrentNodeId] = useState(null);
  const [answers, setAnswers] = useState({});
  const [selectedValue, setSelectedValue] = useState("");
  const [history, setHistory] = useState([]);
  const [user, setUser] = useState(null);
  const [workflow, setWorkflow] = useState(null);
  const [showSummary, setShowSummary] = useState(false);
  const [completedPath, setCompletedPath] = useState([]);
  const [entityStatus, setEntityStatus] = useState(null);
  const [showFlowChart, setShowFlowChart] = useState(false);
  const [prefilledSteps, setPrefilledSteps] = useState(new Set());

  // Fetch published entity classification workflows
  const { data: workflows = [], isLoading } = useQuery({
    queryKey: ['entity-workflows'],
    queryFn: () => base44.entities.Workflow.filter({ 
      workflow_type: 'entity_rfi_classification',
      status: 'published'
    })
  });

  useEffect(() => {
    loadUser();
  }, []);

  useEffect(() => {
    const fetchStatus = async () => {
      if (entity?.id && showSummary) {
        const entities = await base44.entities.Entity.list();
        const currentEntity = entities.find(e => e.id === entity.id);
        setEntityStatus(currentEntity?.rfi_status);
      }
    };
    fetchStatus();
  }, [showSummary, entity?.id]);

  // Query CRS country data for pre-fill logic
  const { data: crsCountries = [] } = useQuery({
    queryKey: ['crs-countries'],
    queryFn: () => base44.entities.CrsCountryInfo.list()
  });

  useEffect(() => {
    if (workflows.length > 0 && !workflow) {
      // Get the latest version
      const sortedWorkflows = workflows.sort((a, b) => 
        parseFloat(b.version || "1.0") - parseFloat(a.version || "1.0")
      );
      const latestWorkflow = sortedWorkflows[0];
      setWorkflow(latestWorkflow);
      
      // Set initial node
      if (latestWorkflow.steps && latestWorkflow.steps.length > 0) {
        setCurrentNodeId(latestWorkflow.steps[0].step_id);
      }
    }
  }, [workflows, workflow]);

  // Pre-fill answers based on mapped fields
  useEffect(() => {
    if (!workflow || !entity) return;
    
    const preFillAnswers = {};
    
    workflow.steps.forEach(step => {
      const mappedField = step.mapped_field;
      if (!mappedField || !mappedField.field_name || !mappedField.prefill_config) return;
      
      // Only pre-fill yes_no questions
      if (step.question_type !== 'yes_no') return;
      
      // Get the value from the entity
      const entityValue = entity[mappedField.field_name];
      if (!entityValue) return;
      
      const prefillConfig = mappedField.prefill_config;
      
      // Handle country_crs pre-fill type
      if (prefillConfig.prefill_type === 'country_crs') {
        const crsCountry = crsCountries.find(c => c.country_name === entityValue || c.country_code === entityValue);
        if (crsCountry) {
          preFillAnswers[step.step_id] = crsCountry.is_crs_country ? 'YES' : 'NO';
        }
      }
      // Handle enum_match pre-fill type
      else if (prefillConfig.prefill_type === 'enum_match' && prefillConfig.match_values) {
        const matchesYes = prefillConfig.match_values.includes(entityValue);
        preFillAnswers[step.step_id] = matchesYes ? 'YES' : 'NO';
      }
    });
    
    if (Object.keys(preFillAnswers).length > 0) {
      setAnswers(prev => ({ ...prev, ...preFillAnswers }));
      setPrefilledSteps(new Set(Object.keys(preFillAnswers)));
    }
  }, [workflow, entity, crsCountries]);

  // Set selectedValue when currentNodeId changes (handles pre-filled answers)
  useEffect(() => {
    if (currentNodeId && answers[currentNodeId]) {
      setSelectedValue(answers[currentNodeId]);
    } else if (workflow && currentNodeId) {
      const currentStep = workflow.steps.find(s => s.step_id === currentNodeId);
      // Initialize as empty array for multiple choice, empty string otherwise
      setSelectedValue(currentStep?.question_type === "multiple_choice" ? [] : "");
    } else {
      setSelectedValue("");
    }
  }, [currentNodeId, answers, workflow]);

  const loadUser = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
    } catch (error) {
      console.error("Error loading user:", error);
    }
  };

  // Guard clause - check if entity exists
  if (!entity) {
    return (
      <div className="p-12 text-center">
        <Alert className="bg-red-50 border-red-200">
          <AlertCircle className="w-4 h-4 text-red-600" />
          <AlertDescription className="text-red-900">
            Entity data is missing. Please close and try again.
          </AlertDescription>
        </Alert>
        <Button onClick={onCancel} className="mt-4" variant="outline">
          Close
        </Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!workflow) {
    return (
      <div className="p-12 text-center">
        <Alert className="bg-amber-50 border-amber-200">
          <AlertDescription className="text-amber-900">
            No published entity classification workflow found. Please contact your administrator.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!currentNodeId && !showSummary) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  // Build step map
  const stepMap = {};
  workflow.steps.forEach(step => {
    stepMap[step.step_id] = step;
  });

  const currentNode = showSummary ? null : stepMap[currentNodeId];
  
  if (!currentNode && !showSummary) {
    return (
      <div className="p-12 text-center">
        <Alert className="bg-red-50 border-red-200">
          <AlertDescription className="text-red-900">
            Workflow configuration error. Current step not found.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const currentStepIndex = history.length;
  const totalSteps = completedPath.length || history.length + 1;
  const progress = Math.round((currentStepIndex / totalSteps) * 100);

  // Determine if current node is an action (end) node
  const isActionNode = (step) => {
    if (!step) return false;
    if (!step.options || step.options.length === 0) {
      return true;
    }
    // Check if step has selection count routing (multiple choice with conditional logic)
    if (step.conditional_logic?.use_selection_count && 
        (step.conditional_logic?.selection_count_next_step || step.conditional_logic?.selection_count_else_step)) {
      return false;
    }
    // Check if step has condition groups (advanced conditional logic)
    if (step.conditional_logic?.condition_groups?.length > 0) {
      return false;
    }
    // Check if any option has a next_step
    return !step.options.some(opt => opt.next_step);
  };

  const handleNext = async () => {
    const newAnswers = { ...answers };
    
    console.log('\n========== HANDLE NEXT (EntityClassification) ==========');
    console.log('Current Node ID:', currentNodeId);
    console.log('Current Node Title:', currentNode.step_title);
    console.log('Selected Value:', selectedValue);
    
    // Store the answer
    if (currentNode.question_type === "single_choice" || currentNode.question_type === "yes_no") {
      if (!selectedValue) return;
      newAnswers[currentNodeId] = selectedValue;
      console.log('Stored answer:', currentNodeId, '=', selectedValue);
    } else if (currentNode.question_type === "multiple_choice") {
      // For multiple choice, selectedValue should be an array
      if (!selectedValue || (Array.isArray(selectedValue) && selectedValue.length === 0)) return;
      newAnswers[currentNodeId] = selectedValue;
      console.log('Stored multiple choice answer:', currentNodeId, '=', selectedValue);
    }

    setAnswers(newAnswers);
    console.log('All answers:', JSON.stringify(newAnswers, null, 2));

    // Execute post-completion actions
    await executePostCompletionActions(currentNode, newAnswers);

    // Determine next step
    let nextNodeId = null;

    console.log('\n🔍 Checking for conditional logic...');
    console.log('Has conditional_logic:', !!currentNode.conditional_logic);
    console.log('Full conditional_logic:', JSON.stringify(currentNode.conditional_logic, null, 2));

    // Multi-choice routing groups - advanced branching for multiple choice questions
    if (!nextNodeId && currentNode.question_type === "multiple_choice" &&
        currentNode.conditional_logic?.multi_choice_routing_groups?.length > 0) {
      console.log('🔀 [MULTI-CHOICE ROUTING GROUPS] Found routing groups');
      const selectedOptions = Array.isArray(newAnswers[currentNodeId]) ? newAnswers[currentNodeId] : [];
      console.log('   Selected options:', selectedOptions);
      
      for (const group of currentNode.conditional_logic.multi_choice_routing_groups) {
        console.log(`   📋 Evaluating group: ${group.group_name || group.group_id}`);
        let groupMatches = group.group_operator === 'AND';
        
        for (const condition of group.conditions) {
          let conditionMet = false;
          
          if (condition.condition_type === 'selected_options') {
            conditionMet = selectedOptions.some(selectedOpt => condition.option_values?.includes(selectedOpt));
            console.log(`      - Selected options check: ${conditionMet}`);
          } else if (condition.condition_type === 'selection_count') {
            const count = selectedOptions.length;
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
            conditionMet = await evaluateSingleCondition(condition, newAnswers);
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
          nextNodeId = group.next_step;
          break;
        }
      }
      
      // If no groups matched, check for false_step on last evaluated group or use default
      if (!nextNodeId) {
        console.log('   ⚠️ No routing groups matched');
        const lastGroup = currentNode.conditional_logic.multi_choice_routing_groups[currentNode.conditional_logic.multi_choice_routing_groups.length - 1];
        if (lastGroup?.false_step) {
          console.log(`   → Using last group's false_step: ${lastGroup.false_step}`);
          nextNodeId = lastGroup.false_step;
        } else if (currentNode.conditional_logic.multi_choice_default_step) {
          console.log(`   → Using default step: ${currentNode.conditional_logic.multi_choice_default_step}`);
          nextNodeId = currentNode.conditional_logic.multi_choice_default_step;
        }
      }
    }
    
    // Check for "By Selected Options" logic (for multiple choice questions)
    if (!nextNodeId && currentNode.question_type === "multiple_choice" && 
        currentNode.conditional_logic?.option_values?.length > 0 &&
        (currentNode.conditional_logic?.option_values_next_step || currentNode.conditional_logic?.option_values_else_step)) {
      console.log('✅ ENTERED option_values logic block');
      
      const selectedOptions = Array.isArray(newAnswers[currentNodeId]) ? newAnswers[currentNodeId] : [];
      const targetOptions = currentNode.conditional_logic.option_values;
      
      console.log('Selected options:', selectedOptions);
      console.log('Target options:', targetOptions);
      
      // Check if ANY of the selected options are in the target options list
      const hasMatch = selectedOptions.some(selected => targetOptions.includes(selected));
      
      console.log(`Match found: ${hasMatch}`);
      
      nextNodeId = hasMatch
        ? currentNode.conditional_logic.option_values_next_step 
        : currentNode.conditional_logic.option_values_else_step;
      
      console.log(`➡️ [OPTION VALUES] ${hasMatch ? 'Matched' : 'No match'}, next step:`, nextNodeId);
    }
    // Check for selection count logic (for multiple choice questions)
    else if (currentNode.question_type === "multiple_choice" && 
        currentNode.conditional_logic?.use_selection_count &&
        (currentNode.conditional_logic?.selection_count_next_step || currentNode.conditional_logic?.selection_count_else_step)) {
      console.log('✅ ENTERED selection count logic block');
      
      const selectedCount = Array.isArray(newAnswers[currentNodeId]) ? newAnswers[currentNodeId].length : 0;
      const operator = currentNode.conditional_logic.selection_count_operator || '=';
      const targetCount = currentNode.conditional_logic.selection_count_value || 0;
      
      console.log(`Selection count: ${selectedCount} ${operator} ${targetCount}`);
      
      let conditionMet = false;
      switch (operator) {
        case '=':
        case 'Equals (=)':
          conditionMet = selectedCount === targetCount;
          break;
        case '!=':
          conditionMet = selectedCount !== targetCount;
          break;
        case '>':
          conditionMet = selectedCount > targetCount;
          break;
        case '<':
          conditionMet = selectedCount < targetCount;
          break;
        case '>=':
          conditionMet = selectedCount >= targetCount;
          break;
        case '<=':
          conditionMet = selectedCount <= targetCount;
          break;
        default:
          conditionMet = selectedCount === targetCount;
          console.log(`⚠️ Unknown or null operator "${operator}", defaulting to equals comparison`);
      }
      
      nextNodeId = conditionMet 
        ? currentNode.conditional_logic.selection_count_next_step 
        : currentNode.conditional_logic.selection_count_else_step;
      
      console.log(`➡️ [SELECTION COUNT] Condition ${conditionMet ? 'MET' : 'NOT MET'}, next step:`, nextNodeId);
    }
    // Check for condition_groups (advanced conditional logic)
    else if (currentNode.conditional_logic?.condition_groups?.length > 0) {
      console.log('✅ Found condition_groups, evaluating...');
      nextNodeId = await evaluateConditionalLogic(currentNode.conditional_logic, newAnswers);
      console.log('➡️ [CONDITION GROUPS] Result:', nextNodeId);
      
      if (nextNodeId) {
        console.log('✅ Condition groups returned next step:', nextNodeId);
      } else {
        console.log('⚠️ Condition groups returned null/undefined');
      }
    }
    // Legacy trigger-based conditional logic
    else if (currentNode.conditional_logic?.conditions?.length > 0 && 
        currentNode.conditional_logic.trigger_field && 
        currentNode.conditional_logic.trigger_value) {
      const logic = currentNode.conditional_logic;
      const currentAnswer = newAnswers[currentNodeId];
      
      console.log("🔍 [LEGACY CONDITIONAL] Checking trigger-based conditional logic");
      console.log("🎯 [TRIGGER] Current answer:", currentAnswer, "Expected trigger:", logic.trigger_value);
      
      if (String(currentAnswer) === String(logic.trigger_value)) {
        console.log("✅ [TRIGGER] Matched - evaluating conditional logic");
        const conditionMet = await evaluateConditionalLogic(logic, newAnswers);
        nextNodeId = conditionMet ? logic.next_step : logic.else_step;
        console.log("➡️ [LEGACY CONDITIONAL] Using conditional logic result:", nextNodeId);
      } else {
        console.log("❌ [TRIGGER] Not matched, skipping legacy conditional logic");
      }
    } else {
      console.log('ℹ️ No conditional logic or condition_groups found');
    }
    
    // If no conditional logic applied, check option's next_step
    if (!nextNodeId && selectedValue && currentNode.options) {
      const selectedOption = currentNode.options.find(opt => 
        opt.value === selectedValue || opt.label === selectedValue
      );
      nextNodeId = selectedOption?.next_step;
      console.log("➡️ [OPTION] Using option's next_step:", nextNodeId);
    }

    console.log('\nFinal nextNodeId:', nextNodeId);
    console.log('Is action node:', isActionNode(currentNode));

    // If this is an action node or no next step, show summary
    const newHistory = [...history, currentNodeId];
    if (!nextNodeId) {
      console.log('🏁 Showing summary - no next step found');
      setCompletedPath(newHistory);
      setShowSummary(true);
      console.log('========== END HANDLE NEXT ==========\n');
      return;
    }

    // Move to next node - add current to history
    console.log(`➡️ Navigating to: ${nextNodeId}`);
    setHistory(newHistory);
    setCurrentNodeId(nextNodeId);
    
    // Check if next node has a pre-filled answer
    const nextNodePreFill = newAnswers[nextNodeId];
    setSelectedValue(nextNodePreFill || "");
    console.log('========== END HANDLE NEXT ==========\n');
  };

  const executePostCompletionActions = async (step, allAnswers) => {
    if (!step.post_completion_actions || step.post_completion_actions.length === 0) {
      return;
    }

    for (const action of step.post_completion_actions) {
      // Check if condition is met (if condition exists)
      if (action.condition) {
        const conditionMet = evaluateActionCondition(action.condition, allAnswers);
        if (!conditionMet) continue;
      }

      // Determine the value to set
      let valueToSet = action.value;
      if (action.value_source === "from_step_answer") {
        // Get answer from specified step
        const answerValue = allAnswers[action.value];
        
        // Find the step to get the label for single/multiple choice questions
        const sourceStep = workflow.steps.find(s => s.step_id === action.value);
        if (sourceStep && sourceStep.options && (sourceStep.question_type === "single_choice" || sourceStep.question_type === "yes_no")) {
          // Find the option that matches the answer value
          const selectedOption = sourceStep.options.find(opt => opt.value === answerValue);
          valueToSet = selectedOption ? selectedOption.label : answerValue;
        } else {
          valueToSet = answerValue;
        }
      } else if (action.value_source === "static_value") {
        valueToSet = action.value;
      }

      // Update the entity/account
      try {
        if (action.target_entity_type === "Entity" && entity?.id) {
          await base44.entities.Entity.update(entity.id, {
            [action.field_to_update]: valueToSet
          });
        }
        // Account updates would go here if needed
      } catch (error) {
        console.error("Error executing post-completion action:", error);
      }
    }
  };

  const evaluateActionCondition = (condition, answers) => {
    const fieldValue = answers[condition.field];
    
    switch (condition.operator) {
      case "=":
        return String(fieldValue) === String(condition.value);
      case "!=":
        return String(fieldValue) !== String(condition.value);
      case "contains":
        return String(fieldValue).includes(condition.value);
      case "in":
        return condition.value.split(",").map(v => v.trim()).includes(String(fieldValue));
      case "not_in":
        return !condition.value.split(",").map(v => v.trim()).includes(String(fieldValue));
      default:
        return true;
    }
  };

  const getFieldValue = (fieldPath, allAnswers) => {
    if (!fieldPath) return undefined;
    
    if (fieldPath.includes('.')) {
      const [stepId, subField] = fieldPath.split('.');
      const stepAnswer = allAnswers[stepId];
      
      if (stepAnswer && typeof stepAnswer === 'object' && !Array.isArray(stepAnswer)) {
        return stepAnswer[subField];
      }
      return undefined;
    }
    
    return allAnswers[fieldPath];
  };

  const evaluateSingleCondition = async (condition, allAnswers) => {
    const fieldAnswer = getFieldValue(condition.field, allAnswers);
    let comparisonValue = condition.value;
    
    if (condition.value_type === 'field_reference') {
      comparisonValue = getFieldValue(condition.value, allAnswers);
    }
    
    let met = false;
    const isArrayAnswer = Array.isArray(fieldAnswer);
    
    switch (condition.operator) {
      case '=':
        if (isArrayAnswer) {
          met = fieldAnswer.includes(comparisonValue);
        } else {
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
        if (fieldAnswer) {
          try {
            const crsResult = await base44.entities.CrsCountryInfo.filter({
              $or: [
                { country_name: fieldAnswer },
                { country_code: fieldAnswer }
              ]
            });
            met = crsResult.length > 0 && crsResult[0].is_crs_country === true;
          } catch (error) {
            console.error("Error checking CRS status:", error);
            met = false;
          }
        } else {
          met = false;
        }
        break;
      case 'is_not_crs':
        if (fieldAnswer) {
          try {
            const crsResult = await base44.entities.CrsCountryInfo.filter({
              $or: [
                { country_name: fieldAnswer },
                { country_code: fieldAnswer }
              ]
            });
            met = crsResult.length === 0 || crsResult[0].is_crs_country === false;
          } catch (error) {
            console.error("Error checking CRS status:", error);
            met = true;
          }
        } else {
          met = true;
        }
        break;
      default:
        met = false;
    }

    return met;
  };

  const evaluateConditionalLogic = async (logic, allAnswers) => {
    console.log('\n========== EVALUATING CONDITIONAL LOGIC (EntityClassification) ==========');
    console.log('Has condition_groups:', !!logic?.condition_groups?.length);
    console.log('Number of condition_groups:', logic?.condition_groups?.length || 0);
    console.log('Full logic object:', JSON.stringify(logic, null, 2));

    // Check for advanced condition_groups
    if (logic?.condition_groups && logic.condition_groups.length > 0) {
      console.log('\n========== EVALUATING CONDITION GROUPS ==========');
      console.log(`Total condition_groups: ${logic.condition_groups.length}`);
      console.log('Overall Logic Operator:', logic.overall_logic_operator);
      console.log('Overall True Step:', logic.overall_true_step);
      console.log('Overall False Step:', logic.overall_false_step);
      console.log('Trigger field:', logic.trigger_field);
      console.log('Trigger value:', logic.trigger_value);
      
      // Check trigger if specified
      if (logic.trigger_field && logic.trigger_value) {
        const triggerAnswer = allAnswers[logic.trigger_field];
        console.log(`Trigger check: field="${logic.trigger_field}", expected="${logic.trigger_value}", actual="${triggerAnswer}"`);
        
        if (triggerAnswer !== logic.trigger_value) {
          console.log('⚠️ TRIGGER NOT MET - skipping condition groups evaluation');
          return null;
        }
        console.log('✅ TRIGGER MET - proceeding with condition groups');
      }
      
      const groupResults = [];

      for (let i = 0; i < logic.condition_groups.length; i++) {
        const group = logic.condition_groups[i];
        console.log(`\n--- GROUP ${i + 1}: ${group.group_name || group.group_id} ---`);
        console.log(`Group Operator: ${group.group_operator}`);
        console.log(`Conditions: ${group.conditions?.length || 0}`);

        if (!group.conditions || group.conditions.length === 0) {
          console.log('WARNING: Group has no conditions, treating as FALSE');
          groupResults.push({ group, result: false });
          continue;
        }

        let groupResult = group.group_operator === 'AND' ? true : false;

        for (let j = 0; j < group.conditions.length; j++) {
          const condition = group.conditions[j];
          console.log(`  Condition ${j + 1}: field="${condition.field}", operator="${condition.operator}", value="${condition.value}"`);
          
          const conditionMet = await evaluateSingleCondition(condition, allAnswers);
          console.log(`  Result: ${conditionMet}`);
          
          if (group.group_operator === 'AND') {
            groupResult = groupResult && conditionMet;
            if (!groupResult) {
              console.log('  Short-circuit AND');
              break;
            }
          } else {
            groupResult = groupResult || conditionMet;
            if (groupResult) {
              console.log('  Short-circuit OR');
              break;
            }
          }
        }

        console.log(`>>> GROUP ${i + 1} RESULT: ${groupResult}`);
        groupResults.push({ group, result: groupResult });
      }

      // Combine groups
      if (logic.overall_logic_operator) {
        console.log(`\n--- COMBINING GROUPS with ${logic.overall_logic_operator} ---`);
        let finalResult = logic.overall_logic_operator === 'AND' ? true : false;
        let matchedGroupIndex = -1;

        for (let i = 0; i < groupResults.length; i++) {
          const { result } = groupResults[i];
          if (logic.overall_logic_operator === 'AND') {
            finalResult = finalResult && result;
            if (!finalResult) break;
          } else {
            const previousResult = finalResult;
            finalResult = finalResult || result;
            if (result && matchedGroupIndex === -1) {
              matchedGroupIndex = i;
              console.log(`✅ First TRUE group at index ${i}`);
            }
            if (finalResult && previousResult === false && result === true) {
              break;
            }
          }
        }

        console.log(`>>> FINAL RESULT: ${finalResult}`);
        
        // For OR logic, use matched group's true_step
        let nextStep;
        if (logic.overall_logic_operator === 'OR' && finalResult && matchedGroupIndex >= 0) {
          nextStep = groupResults[matchedGroupIndex].group.true_step;
          console.log(`>>> OR Logic - Using matched group's true_step: ${nextStep}`);
        } else {
          nextStep = finalResult ? logic.overall_true_step : logic.overall_false_step;
          console.log(`>>> Using overall ${finalResult ? 'true' : 'false'} step: ${nextStep}`);
        }
        
        console.log('========== END CONDITION GROUPS ==========\n');
        return nextStep;
      } else {
        // No overall operator - find first group that evaluates to TRUE
        console.log('\n--- NO OVERALL OPERATOR - Finding first TRUE group ---');
        for (let i = 0; i < groupResults.length; i++) {
          const { group, result } = groupResults[i];
          console.log(`Group ${i + 1} (${group.group_id}): ${result}`);
          if (result) {
            const nextStep = group.true_step;
            console.log(`>>> Using first TRUE group's true_step: ${nextStep}`);
            console.log('========== END CONDITION GROUPS ==========\n');
            return nextStep;
          }
        }
        
        // No groups were true - use first group's false_step as fallback
        const firstGroup = groupResults[0];
        const nextStep = firstGroup.group.false_step;
        console.log('>>> No TRUE groups found, using first group false_step:', nextStep);
        console.log('========== END CONDITION GROUPS ==========\n');
        return nextStep;
      }
    }

    // Legacy simple conditions
    console.log("🔧 [EVALUATE] Starting legacy condition evaluation");
    if (!logic.conditions || logic.conditions.length === 0) {
      console.log("❌ [EVALUATE] No conditions found, returning false");
      return false;
    }

    console.log(`🔢 [EVALUATE] Evaluating ${logic.conditions.length} condition(s)`);
    let result = true;

    logic.conditions.forEach((condition, idx) => {
      console.log(`\n--- Condition ${idx + 1} ---`);
      console.log("📝 [CONDITION] Field:", condition.field);
      console.log("🔍 [CONDITION] Operator:", condition.operator);
      console.log("🎯 [CONDITION] Expected value:", condition.value);
      
      let fieldValue = answers[condition.field];
      console.log("💾 [CONDITION] Direct lookup result:", fieldValue);
      
      if (fieldValue === undefined) {
        console.log("🔎 [CONDITION] Direct lookup failed, searching by step title...");
        const matchingStep = workflow.steps.find(s => s.step_title === condition.field || s.step_id === condition.field);
        if (matchingStep) {
          console.log("✅ [CONDITION] Found matching step:", matchingStep.step_id, matchingStep.step_title);
          fieldValue = answers[matchingStep.step_id];
          console.log("💾 [CONDITION] Value from matched step:", fieldValue);
        } else {
          console.log("❌ [CONDITION] No matching step found for field:", condition.field);
        }
      }
      
      let conditionMet = false;

      switch (condition.operator) {
        case "=":
          conditionMet = String(fieldValue) === String(condition.value);
          console.log(`🔍 [OPERATOR] Equals: '${fieldValue}' === '${condition.value}' = ${conditionMet}`);
          break;
        case "!=":
          conditionMet = String(fieldValue) !== String(condition.value);
          console.log(`🔍 [OPERATOR] Not equals: '${fieldValue}' !== '${condition.value}' = ${conditionMet}`);
          break;
        case "in":
          const inValues = condition.value.split(",").map(v => v.trim());
          conditionMet = inValues.includes(String(fieldValue));
          console.log(`🔍 [OPERATOR] In: '${fieldValue}' in [${inValues.join(', ')}] = ${conditionMet}`);
          break;
        case "not_in":
          const notInValues = condition.value.split(",").map(v => v.trim());
          conditionMet = !notInValues.includes(String(fieldValue));
          console.log(`🔍 [OPERATOR] Not in: '${fieldValue}' not in [${notInValues.join(', ')}] = ${conditionMet}`);
          break;
        case "contains":
          conditionMet = String(fieldValue).includes(condition.value);
          console.log(`🔍 [OPERATOR] Contains: '${fieldValue}'.includes('${condition.value}') = ${conditionMet}`);
          break;
        case ">":
          conditionMet = parseFloat(fieldValue) > parseFloat(condition.value);
          console.log(`🔍 [OPERATOR] Greater than: ${fieldValue} > ${condition.value} = ${conditionMet}`);
          break;
        case "<":
          conditionMet = parseFloat(fieldValue) < parseFloat(condition.value);
          console.log(`🔍 [OPERATOR] Less than: ${fieldValue} < ${condition.value} = ${conditionMet}`);
          break;
        case ">=":
          conditionMet = parseFloat(fieldValue) >= parseFloat(condition.value);
          console.log(`🔍 [OPERATOR] Greater or equal: ${fieldValue} >= ${condition.value} = ${conditionMet}`);
          break;
        case "<=":
          conditionMet = parseFloat(fieldValue) <= parseFloat(condition.value);
          console.log(`🔍 [OPERATOR] Less or equal: ${fieldValue} <= ${condition.value} = ${conditionMet}`);
          break;
        default:
          conditionMet = false;
          console.log(`❌ [OPERATOR] Unknown operator: ${condition.operator}`);
      }

      if (idx === 0) {
        result = conditionMet;
        console.log(`🎯 [LOGIC] First condition, result = ${result}`);
      } else {
        const prevCondition = logic.conditions[idx - 1];
        const prevResult = result;
        console.log(`🔗 [LOGIC] Logic operator from previous condition: "${prevCondition.logic_operator}"`);
        if (prevCondition.logic_operator === "OR") {
          result = result || conditionMet;
          console.log(`🔗 [LOGIC] OR: ${prevResult} || ${conditionMet} = ${result}`);
        } else {
          result = result && conditionMet;
          console.log(`🔗 [LOGIC] AND: ${prevResult} && ${conditionMet} = ${result}`);
        }
      }
    });

    console.log(`\n✅ [FINAL] Final result: ${result}\n`);
    return result;
  };

  const handleBack = () => {
    if (showSummary) {
      setShowSummary(false);
      return;
    }

    if (history.length === 0) {
      onCancel();
      return;
    }

    const previousNodeId = history[history.length - 1];

    // Remove last answer
    const newAnswers = { ...answers };
    delete newAnswers[currentNodeId];

    setAnswers(newAnswers);
    setHistory(history.slice(0, -1));
    setCurrentNodeId(previousNodeId);
    setSelectedValue(answers[previousNodeId] || "");
  };

  const completeClassification = async () => {
    const finalNode = stepMap[history[history.length - 1]] || currentNode;
    const finalAnswers = answers;

    // Fetch the current entity state to get values set by post-completion actions
    const currentEntity = await base44.entities.Entity.list();
    const updatedEntity = currentEntity.find(e => e.id === entity.id);

    // Use entity's current state as source of truth (set by post-completion actions or defaults)
    let rfi_status = updatedEntity?.rfi_status || "non_reporting_fi";
    let fi_type = updatedEntity?.fi_type || "not_applicable";

    // Parse classification from node title/help text (only if not already set by actions)
    if (finalNode.step_title?.toLowerCase().includes("reporting fi") || 
        finalNode.help_text?.toLowerCase().includes("reporting fi")) {
      
      // Only set rfi_status if it wasn't already set by post-completion actions
      if (!updatedEntity?.rfi_status) {
        rfi_status = "reporting_fi";
      }
      
      // Only determine fi_type if it wasn't already set by post-completion actions
      if (!updatedEntity?.fi_type || updatedEntity.fi_type === "not_applicable") {
        const fiTypeValue = finalAnswers.frm_select_fi_type;
        
        const fiTypeMap = {
          "1": "custodial_institution",
          "2": "depository_institution",
          "3a": "investment_entity",
          "3b": "investment_entity",
          "4": "specified_insurance_company"
        };
        
        const fiTypeLabelMap = {
          "Custodial Institution": "custodial_institution",
          "Depository Institution": "depository_institution",
          "Investment Entity (3a)": "investment_entity",
          "Investment Entity (3b)": "investment_entity",
          "Specified Insurance Company": "specified_insurance_company"
        };
        
        fi_type = fiTypeMap[fiTypeValue] || fiTypeLabelMap[fiTypeValue] || "not_applicable";
      }
    }

    // Set reason based on actual rfi_status
    let reason = finalNode.help_text || finalNode.step_title || "Classification completed";
    if (rfi_status === "non_reporting_fi" && reason.toLowerCase().includes("reporting fi")) {
      reason = "Result: Non-Reporting FI - " + reason;
    }

    // Filter answers to only include actually answered questions from completedPath
    const actualAnswers = {};
    completedPath.forEach(stepId => {
      if (finalAnswers[stepId] !== undefined) {
        actualAnswers[stepId] = finalAnswers[stepId];
      }
    });

    const classificationData = {
      classification_answers: actualAnswers,
      classification_completed_date: new Date().toISOString().split('T')[0],
      rfi_status: rfi_status,
      fi_type: fi_type,
      non_reporting_reason: rfi_status === "non_reporting_fi" ? reason : undefined,
      entity_type: finalAnswers.frm_select_legal_entity_type || entity?.entity_type
    };

    // Save classification history record
    try {
      await base44.entities.EntityClassificationHistory.create({
        tenant_id: entity?.tenant_id,
        entity_id: entity?.id,
        classification_date: new Date().toISOString(),
        classification_result: rfi_status,
        classification_reason: reason,
        fi_type: fi_type,
        workflow_answers: actualAnswers,
        performed_by: user?.email || "unknown",
        entity_name: entity?.entity_name || "Unknown Entity",
        entity_type: finalAnswers.frm_select_legal_entity_type || entity?.entity_type
      });
    } catch (error) {
      console.error("Error saving classification history:", error);
    }

    onComplete(classificationData);
  };

  const renderNode = () => {
    const isLocked = prefilledSteps.has(currentNodeId);

    if (currentNode.question_type === "yes_no") {
      const options = currentNode.options || [
        { value: "YES", label: "Yes" },
        { value: "NO", label: "No" }
      ];
      
      return (
        <div className="space-y-3">
          {isLocked && (
            <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <Lock className="w-3.5 h-3.5 flex-shrink-0" />
              <span>This answer was automatically determined from your entity data and cannot be changed.</span>
            </div>
          )}
          <RadioGroup value={selectedValue} onValueChange={isLocked ? undefined : setSelectedValue}>
            {options.map((option) => (
              <div 
                key={option.value}
                className={`flex items-center space-x-3 p-4 rounded-lg border-2 transition-all ${
                  isLocked
                    ? option.value === selectedValue
                      ? 'border-indigo-300 bg-indigo-50/70 cursor-not-allowed opacity-90'
                      : 'border-slate-200 bg-slate-50 cursor-not-allowed opacity-40'
                    : 'border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50 cursor-pointer'
                }`}
                onClick={isLocked ? undefined : () => setSelectedValue(option.value)}
              >
                <RadioGroupItem value={option.value} id={option.value} disabled={isLocked} />
                <Label 
                  htmlFor={option.value}
                  className={`flex-1 font-medium text-slate-900 ${isLocked ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  {option.label}
                </Label>
                {option.value === selectedValue && (
                  isLocked
                    ? <Lock className="w-4 h-4 text-indigo-400" />
                    : <CheckCircle2 className="w-5 h-5 text-indigo-600" />
                )}
              </div>
            ))}
          </RadioGroup>
        </div>
      );
    }

    if (currentNode.question_type === "single_choice") {
      return (
        <div className="space-y-4">
          {isLocked && (
            <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <Lock className="w-3.5 h-3.5 flex-shrink-0" />
              <span>This answer was automatically determined from your entity data and cannot be changed.</span>
            </div>
          )}
          <Select disabled={isLocked} value={selectedValue} onValueChange={isLocked ? undefined : setSelectedValue}>
            <SelectTrigger className={`w-full h-12 ${isLocked ? 'cursor-not-allowed opacity-70 bg-slate-50' : ''}`}>
              <SelectValue placeholder="Select an option..." />
            </SelectTrigger>
            <SelectContent>
              {currentNode.options?.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    }

    if (currentNode.question_type === "multiple_choice") {
      const selectedArray = Array.isArray(selectedValue) ? selectedValue : [];
      
      const handleCheckboxChange = (optionValue, checked) => {
        let newSelection;
        if (checked) {
          newSelection = [...selectedArray, optionValue];
        } else {
          newSelection = selectedArray.filter(v => v !== optionValue);
        }
        setSelectedValue(newSelection);
      };
      
      return (
        <div className="space-y-3">
          {currentNode.options?.map((option) => (
            <div 
              key={option.value}
              className="flex items-start space-x-3 p-4 rounded-lg border-2 border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50 transition-all cursor-pointer"
              onClick={() => handleCheckboxChange(option.value, !selectedArray.includes(option.value))}
            >
              <Checkbox
                id={option.value}
                checked={selectedArray.includes(option.value)}
                onCheckedChange={(checked) => handleCheckboxChange(option.value, checked)}
                className="mt-0.5"
              />
              <Label 
                htmlFor={option.value}
                className="flex-1 cursor-pointer font-medium text-slate-900 leading-relaxed"
              >
                {option.label}
              </Label>
              {selectedArray.includes(option.value) && (
                <CheckCircle2 className="w-5 h-5 text-indigo-600 flex-shrink-0" />
              )}
            </div>
          ))}
        </div>
      );
    }

    if (currentNode.question_type === "text_input") {
      return (
        <Alert className="bg-green-50 border-green-200">
          <CheckCircle2 className="w-4 h-4 text-green-600" />
          <AlertDescription className="text-green-900 font-medium">
            {currentNode.help_text || "Classification complete!"}
          </AlertDescription>
        </Alert>
      );
    }

    return null;
  };

  // Summary Screen
  if (showSummary) {
    const finalNode = stepMap[completedPath[completedPath.length - 1]];
    
    // Only check actual entity status, not text content which can be misleading
    const isReportingFI = entityStatus === "reporting_fi";

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center bg-green-100">
            <CheckCircle2 className="w-10 h-10 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Classification Complete</h2>
          <p className="text-slate-600">
            Review your answers and confirm the classification for <strong>{entity?.entity_name || "this entity"}</strong>
          </p>
        </div>

        {/* Classification Result Preview */}
        <Card className="border-2 bg-green-50 border-green-200">
          <CardHeader className="border-b border-slate-200">
            <CardTitle className="text-lg flex items-center gap-2">
              <FileCheck className="w-5 h-5" />
              Final Classification
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700">Status:</span>
                <Badge className="text-sm bg-green-600 text-white">
                  {isReportingFI ? 'Reporting FI' : 'Non-Reporting FI'}
                </Badge>
              </div>
              <div className="flex items-start justify-between">
                <span className="text-sm font-medium text-slate-700">Reason:</span>
                <span className="text-sm text-slate-900 text-right max-w-md">
                  {finalNode?.help_text || finalNode?.step_title || "Classification completed"}
                </span>
              </div>
              {answers.frm_select_fi_type && (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-700">FI Type:</span>
                  <Badge variant="outline">
                    {stepMap['frm_select_fi_type']?.options?.find(o => o.value === answers.frm_select_fi_type)?.label || answers.frm_select_fi_type}
                  </Badge>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* All Answers Summary */}
        <Card className="border-0 shadow-lg">
          <CardHeader className="border-b bg-slate-50">
            <CardTitle className="text-lg flex items-center gap-2">
              <FileCheck className="w-5 h-5" />
              Complete Answer Summary ({Object.keys(answers).length} questions answered)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4">
              {completedPath.map((stepId, idx) => {
                const step = stepMap[stepId];
                const answer = answers[stepId];

                // Only show steps that have answers
                if (!step || !answer) return null;

                // Handle multiple choice answers (arrays)
                let answerDisplay;
                if (Array.isArray(answer)) {
                 const labels = answer.map(v => step.options?.find(o => o.value === v)?.label || v);
                 answerDisplay = (
                   <div className="flex flex-wrap gap-1">
                     {labels.map((label, idx) => (
                       <Badge key={idx} variant="secondary" className="bg-indigo-50 text-indigo-700">
                         {label}
                       </Badge>
                     ))}
                   </div>
                 );
                } else {
                 const answerLabel = step.options?.find(o => o.value === answer)?.label || answer;
                 answerDisplay = (
                   <Badge variant="secondary" className="bg-indigo-50 text-indigo-700">
                     {answerLabel}
                   </Badge>
                 );
                }

                const isLastStep = idx === completedPath.length - 1;

                return (
                  <div key={stepId}>
                    <div className="flex items-start gap-4 pb-4 border-b border-slate-100 last:border-0 last:pb-0">
                      <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center flex-shrink-0 font-semibold text-sm">
                        {idx + 1}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-slate-900 mb-1">
                          {step.step_title}
                        </p>
                        {step.question_text && (
                          <p className="text-xs text-slate-600 mb-2">{step.question_text}</p>
                        )}
                        {answerDisplay}
                      </div>
                    </div>
                    {isLastStep && (
                      <Alert className="mt-4 bg-green-50 border-green-200">
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                        <AlertDescription className="text-sm text-green-900">
                          <strong>Workflow concluded at this step</strong> - Classification determination complete
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-between gap-3 pt-4 border-t">
          <Button 
            type="button" 
            variant="outline" 
            onClick={handleBack}
            size="lg"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Review Answers
          </Button>
          <Button 
            onClick={completeClassification}
            size="lg"
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-8"
          >
            <CheckCircle2 className="w-5 h-5 mr-2" />
            Complete Classification
          </Button>
        </div>
      </div>
    );
  }

  // Main workflow screen
  return (
    <div className="space-y-6">
      <Dialog open={showFlowChart} onOpenChange={setShowFlowChart}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Workflow Flowchart: {workflow.workflow_name}</DialogTitle>
          </DialogHeader>
          <WorkflowVisualizer workflow={workflow} />
        </DialogContent>
      </Dialog>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
            {workflow.workflow_name} v{workflow.version}
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowFlowChart(true)}
            className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
          >
            <GitBranch className="w-4 h-4 mr-1" />
            Show Flowchart
          </Button>
        </div>
        <div className="text-right">
          <p className="text-sm font-medium text-slate-700">
            Step {currentStepIndex + 1}
          </p>
          <p className="text-xs text-slate-500">{progress}% Complete</p>
        </div>
      </div>

      {/* Enhanced Progress Bar */}
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

      {/* Step Breadcrumb */}
      <div className="flex items-center gap-2 flex-wrap">
        {[...history, currentNodeId].map((stepId, idx) => {
          const step = stepMap[stepId];
          const isCompleted = idx < history.length;
          const isCurrent = idx === history.length;
          
          return (
            <React.Fragment key={stepId}>
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 transition-all ${
                isCompleted 
                  ? 'bg-green-50 border-green-200' 
                  : isCurrent 
                    ? 'bg-indigo-50 border-indigo-300' 
                    : 'bg-slate-50 border-slate-200'
              }`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                  isCompleted 
                    ? 'bg-green-600' 
                    : isCurrent 
                      ? 'bg-indigo-600' 
                      : 'bg-slate-300'
                }`}>
                  {isCompleted ? (
                    <Check className="w-4 h-4 text-white" />
                  ) : (
                    <span className="text-white text-xs font-bold">{idx + 1}</span>
                  )}
                </div>
                <span className={`text-xs font-medium whitespace-nowrap ${
                  isCompleted 
                    ? 'text-green-700' 
                    : isCurrent 
                      ? 'text-indigo-700' 
                      : 'text-slate-500'
                }`}>
                  {step?.step_title?.substring(0, 15) || `Step ${idx + 1}`}
                  {step?.step_title?.length > 15 && '...'}
                </span>
              </div>
              {idx < history.length && (
                <ArrowRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Question Card */}
      <Card className="border-2 border-indigo-100 bg-gradient-to-br from-white to-indigo-50/30 shadow-lg">
        <CardContent className="p-6">
          <div className="space-y-5">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-700 flex items-center justify-center flex-shrink-0 shadow-lg">
                <span className="text-white font-bold text-lg">{currentStepIndex + 1}</span>
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-slate-900 mb-3">
                  {currentNode.step_title}
                </h3>
                {currentNode.question_text && (
                  <p className="text-slate-700 mb-3 leading-relaxed">{currentNode.question_text}</p>
                )}
                {currentNode.help_text && (
                  <Alert className="bg-blue-50 border-blue-200 mb-4">
                    <Info className="w-4 h-4 text-blue-600" />
                    <AlertDescription className="text-sm text-blue-900">
                      {currentNode.help_text}
                    </AlertDescription>
                  </Alert>
                )}

              </div>
            </div>

            {/* Render current node */}
            <div className="pl-16">
              {renderNode()}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Previous Answers Compact View */}
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
                 const step = stepMap[key];
                 if (!step) return null;

                 // Handle multiple choice answers (arrays)
                 if (Array.isArray(value)) {
                   const labels = value.map(v => step.options?.find(o => o.value === v)?.label || v);
                   return (
                     <div key={key} className="flex items-start justify-between text-sm py-2 border-b border-slate-200 last:border-0">
                       <span className="text-slate-600 text-xs">
                         {step.step_title || key}
                       </span>
                       <div className="flex flex-wrap gap-1 justify-end">
                         {labels.map((label, idx) => (
                           <Badge key={idx} variant="outline" className="capitalize text-xs">
                             {label}
                           </Badge>
                         ))}
                       </div>
                     </div>
                   );
                 }

                 return (
                   <div key={key} className="flex items-center justify-between text-sm py-2 border-b border-slate-200 last:border-0">
                     <span className="text-slate-600 text-xs">
                       {step.step_title || key}
                     </span>
                     <Badge variant="outline" className="capitalize text-xs">
                       {step.options?.find(o => o.value === value)?.label || value}
                     </Badge>
                   </div>
                 );
                })}
              </div>
            </details>
          </CardContent>
        </Card>
      )}

      {/* AI Workflow Helper */}
      <AIWorkflowHelper
        currentStep={currentNode}
        workflow={workflow}
        answers={answers}
        entityData={entity}
        onSuggestedAnswer={(value) => setSelectedValue(value)}
      />

      {/* Navigation */}
      <div className="flex justify-between gap-3 pt-4 border-t">
        <Button 
          type="button" 
          variant="outline" 
          onClick={handleBack}
          size="lg"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          {history.length === 0 ? "Cancel" : "Previous"}
        </Button>
        <Button 
          onClick={handleNext}
          disabled={
            !isActionNode(currentNode) && 
            (!selectedValue || (Array.isArray(selectedValue) && selectedValue.length === 0))
          }
          size="lg"
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-8"
        >
          {isActionNode(currentNode) ? "View Summary" : "Next Question"}
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}