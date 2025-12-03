import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, ArrowRight, ArrowLeft, Info, FileCheck, Loader2, AlertCircle, Users, Check, Circle, Upload, GitBranch, Brain, Sparkles } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import MultiFieldRenderer from "../workflows/MultiFieldRenderer";
import WorkflowVisualizer from "../workflows/WorkflowVisualizer";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import CountrySelect from "../shared/CountrySelect";
import BeneficiaryInputRenderer from "@/components/accounts/BeneficiaryInputRenderer";
import ControllingPersonInputRenderer from "@/components/accounts/ControllingPersonInputRenderer";
import AIWorkflowHelper from "../ai/AIWorkflowHelper";
import AIClassificationAssistant from "../ai/AIClassificationAssistant";

export default function AccountClassification({ account, onComplete, onCancel }) {
  const [currentNodeId, setCurrentNodeId] = useState(null);
  const [answers, setAnswers] = useState({});  // Always start fresh - don't load previous answers
  const [selectedValue, setSelectedValue] = useState("");
  const [history, setHistory] = useState([]);
  const [user, setUser] = useState(null);
  const [workflow, setWorkflow] = useState(null);
  const [showSummary, setShowSummary] = useState(false);
  const [completedPath, setCompletedPath] = useState([]);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [multiFieldValues, setMultiFieldValues] = useState({});
  const [multiFieldErrors, setMultiFieldErrors] = useState({});
  const [showFlowchart, setShowFlowchart] = useState(false);
  const [showAIAssistant, setShowAIAssistant] = useState(false);
  const [dateValue, setDateValue] = useState("");
  const [latestAccountData, setLatestAccountData] = useState(null);
  const [addressValues, setAddressValues] = useState({
    street: "",
    city: "",
    state: "",
    postal_code: "",
    country: ""
  });
  const [beneficiariesAdded, setBeneficiariesAdded] = useState(false);
  const [controllingPersonsAdded, setControllingPersonsAdded] = useState(false);

  // Fetch the latest account data to ensure we have up-to-date documents
  const { data: freshAccountData } = useQuery({
    queryKey: ['account-fresh', account?.id],
    queryFn: async () => {
      if (!account?.id) return null;
      const accounts = await base44.entities.Account.filter({ id: account.id });
      return accounts[0] || null;
    },
    enabled: !!account?.id,
    staleTime: 0, // Always fetch fresh data
  });

  // Use fresh data if available, otherwise fall back to prop
  useEffect(() => {
    if (freshAccountData) {
      setLatestAccountData(freshAccountData);
    }
  }, [freshAccountData]);

  // Fetch published account classification workflows
  const { data: workflows = [], isLoading } = useQuery({
    queryKey: ['account-workflows'],
    queryFn: () => base44.entities.Workflow.filter({ 
      workflow_type: 'account_reportability',
      status: 'published'
    }),
    enabled: !!account
  });

  // Fetch CRS countries for condition evaluation - now includes both name and code lookup
  const { data: crsCountryMap = {} } = useQuery({
    queryKey: ['crs-country-map-for-evaluation'],
    queryFn: async () => {
      const countries = await base44.entities.CrsCountryInfo.list();
      const map = {};
      countries.forEach(c => {
        // Map by country name (lowercase)
        if (c.country_name) {
          map[c.country_name.toLowerCase()] = {
            code: c.country_code?.toUpperCase(),
            isCrs: c.is_crs_country
          };
        }
        // Map by country code (lowercase)
        if (c.country_code) {
          map[c.country_code.toLowerCase()] = {
            code: c.country_code?.toUpperCase(),
            isCrs: c.is_crs_country
          };
        }
      });
      return map;
    },
    staleTime: Infinity,
    enabled: !!account
  });

  // Evaluate if a workflow's trigger conditions match the account data
  const evaluateTriggerConditions = (triggerConfig, accountData) => {
    if (!triggerConfig?.enabled) return false;
    
    const conditions = triggerConfig.conditions || [];
    const computedConditions = triggerConfig.computed_conditions || [];
    
    // If no conditions at all, return true (enabled but no filters)
    if (conditions.length === 0 && computedConditions.length === 0) return true;

    const getFieldValue = (fieldPath) => {
      if (!fieldPath) return null;
      
      if (fieldPath.includes('.')) {
        const parts = fieldPath.split('.');
        let value = accountData;
        for (const part of parts) {
          value = value?.[part];
          if (value === undefined) return null;
        }
        return value;
      }
      
      return accountData?.[fieldPath];
    };

    let result = true;

    // Evaluate regular conditions
    for (let idx = 0; idx < conditions.length; idx++) {
      const condition = conditions[idx];
      const fieldValue = getFieldValue(condition.field);
      const comparisonValue = condition.value;
      let conditionMet = false;

      switch (condition.operator) {
        case "equals":
          conditionMet = String(fieldValue).toLowerCase() === String(comparisonValue).toLowerCase();
          break;
        case "not_equals":
          conditionMet = String(fieldValue).toLowerCase() !== String(comparisonValue).toLowerCase();
          break;
        case "greater_than":
        case ">":
          conditionMet = parseFloat(fieldValue) > parseFloat(comparisonValue);
          break;
        case "less_than":
        case "<":
          conditionMet = parseFloat(fieldValue) < parseFloat(comparisonValue);
          break;
        case "greater_than_or_equal":
        case ">=":
          conditionMet = parseFloat(fieldValue) >= parseFloat(comparisonValue);
          break;
        case "less_than_or_equal":
        case "<=":
          conditionMet = parseFloat(fieldValue) <= parseFloat(comparisonValue);
          break;
        case "contains":
          conditionMet = String(fieldValue).toLowerCase().includes(String(comparisonValue).toLowerCase());
          break;
        case "in":
          const inValues = String(comparisonValue).split(",").map(v => v.trim().toLowerCase());
          conditionMet = inValues.includes(String(fieldValue).toLowerCase());
          break;
        case "not_in":
          const notInValues = String(comparisonValue).split(",").map(v => v.trim().toLowerCase());
          conditionMet = !notInValues.includes(String(fieldValue).toLowerCase());
          break;
        default:
          conditionMet = false;
      }

      if (idx === 0) {
        result = conditionMet;
      } else {
        const logicOp = conditions[idx - 1]?.logic_operator || "AND";
        if (logicOp === "AND") {
          result = result && conditionMet;
        } else if (logicOp === "OR") {
          result = result || conditionMet;
        }
      }
    }

    // Evaluate computed conditions (e.g., year_end_cash_value + gross_payments > 1000000)
    for (let idx = 0; idx < computedConditions.length; idx++) {
      const compCondition = computedConditions[idx];
      let compResult = false;
      
      try {
        const expression = compCondition.expression;
        
        // Replace field names with their numeric values
        const fieldRegex = /\b([a-z_]+[a-z0-9_]*)\b/gi;
        let computedExpression = expression.replace(fieldRegex, (match) => {
          // Skip operators and keywords
          if (['AND', 'OR', 'true', 'false', 'null'].includes(match)) return match;
          const value = getFieldValue(match);
          return isNaN(parseFloat(value)) ? 0 : parseFloat(value);
        });
        
        // Safely evaluate the arithmetic expression
        const computedValue = new Function(`return ${computedExpression}`)();
        const compareValue = parseFloat(compCondition.value);
        
        switch (compCondition.operator) {
          case "greater_than":
          case ">":
            compResult = computedValue > compareValue;
            break;
          case "less_than":
          case "<":
            compResult = computedValue < compareValue;
            break;
          case "greater_than_or_equal":
          case ">=":
            compResult = computedValue >= compareValue;
            break;
          case "less_than_or_equal":
          case "<=":
            compResult = computedValue <= compareValue;
            break;
          case "equals":
          case "=":
            compResult = computedValue === compareValue;
            break;
          default:
            compResult = false;
        }
      } catch (error) {
        console.error("Error evaluating computed condition:", error);
        compResult = false;
      }

      // Combine with previous result
      if (conditions.length === 0 && idx === 0) {
        result = compResult;
      } else {
        const logicOp = compCondition.logic_operator || "AND";
        if (logicOp === "OR") {
          result = result || compResult;
        } else {
          result = result && compResult;
        }
      }
    }

    return result;
  };

  useEffect(() => {
    if (account) {
      loadUser();
    }
  }, [account]);

  useEffect(() => {
    if (workflows.length > 0 && !workflow && account) {
      const matchingWorkflows = workflows.filter(w => {
        if (w.trigger_conditions?.enabled) {
          return evaluateTriggerConditions(w.trigger_conditions, account);
        }
        return false;
      });

      let selectedWorkflow = null;

      if (matchingWorkflows.length > 0) {
        const sortedWorkflows = matchingWorkflows.sort((a, b) => {
          const priorityA = a.trigger_conditions?.priority || 0;
          const priorityB = b.trigger_conditions?.priority || 0;
          if (priorityB !== priorityA) return priorityB - priorityA;
          return parseFloat(b.version || "1.0") - parseFloat(a.version || "1.0");
        });
        selectedWorkflow = sortedWorkflows[0];
      } else {
        const isIndividual = account?.account_holder_type === "individual";
        const fallbackWorkflows = workflows.filter(w => {
          const nameMatch = isIndividual 
            ? w.workflow_name?.toLowerCase().includes("individual")
            : w.workflow_name?.toLowerCase().includes("entity");
          return nameMatch;
        });
        
        if (fallbackWorkflows.length > 0) {
          const sortedFallback = fallbackWorkflows.sort((a, b) => 
            parseFloat(b.version || "1.0") - parseFloat(a.version || "1.0")
          );
          selectedWorkflow = sortedFallback[0];
        }
      }

      if (selectedWorkflow) {
        setWorkflow(selectedWorkflow);
        if (selectedWorkflow.steps && selectedWorkflow.steps.length > 0) {
          setCurrentNodeId(selectedWorkflow.steps[0].step_id);
        }
      }
    }
  }, [workflows, workflow, account]);

  useEffect(() => {
    if (account && !answers._account_data_loaded) {
      setAnswers(prev => ({
        ...prev,
        _account_data_loaded: true,
        _is_pre_existing: account.is_pre_existing,
        _account_holder_is_alive: account.account_holder_is_alive,
        _account_holder_type: account.account_holder_type
      }));
    }
  }, [account]);

  const loadUser = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
    } catch (error) {
      console.error("Error loading user:", error);
    }
  };

  const evaluateConditionalLogic = (logic, currentAnswers) => {
    if (!logic.conditions || logic.conditions.length === 0) return false;

    // Check if there's a trigger condition
    if (logic.trigger_field && logic.trigger_value) {
      const triggerAnswer = currentAnswers[logic.trigger_field];
      if (String(triggerAnswer) !== String(logic.trigger_value)) {
        return false;
      }
    }

    const getFieldValue = (fieldPath) => {
      if (fieldPath.includes('.')) {
        const parts = fieldPath.split('.');
        const stepAnswer = currentAnswers[parts[0]];
        if (stepAnswer && typeof stepAnswer === 'object') {
          return stepAnswer[parts[1]];
        }
        if (parts[0] === 'account_holder_address' || parts[0] === 'current_address') {
          return account?.[parts[0]]?.[parts[1]];
        }
        return null;
      }

      if (currentAnswers[fieldPath] !== undefined) {
        return currentAnswers[fieldPath];
      }

      if (fieldPath === '_is_pre_existing' || fieldPath === 'is_pre_existing') {
        return account?.is_pre_existing;
      } else if (fieldPath === '_account_holder_is_alive' || fieldPath === 'account_holder_is_alive') {
        return account?.account_holder_is_alive;
      } else if (fieldPath === '_account_holder_type' || fieldPath === 'account_holder_type') {
        return account?.account_holder_type;
      } else if (fieldPath === 'country_of_residence') {
        return account?.country_of_residence;
      } else if (fieldPath === 'place_of_birth') {
        return account?.place_of_birth;
      }

      if (account?.[fieldPath] !== undefined) {
        return account[fieldPath];
      }

      return null;
    };

    let result = true;

    logic.conditions.forEach((condition, idx) => {
      let fieldValue = getFieldValue(condition.field);
      let comparisonValue = condition.value;
      if (condition.value_type === 'field_reference') {
        comparisonValue = getFieldValue(condition.value);
      }

      let conditionMet = false;

      switch (condition.operator) {
        case "=":
          conditionMet = String(fieldValue).toLowerCase() === String(comparisonValue).toLowerCase();
          break;
        case "!=":
          conditionMet = String(fieldValue).toLowerCase() !== String(comparisonValue).toLowerCase();
          break;
        case "in":
          const inValues = String(comparisonValue).split(",").map(v => v.trim().toLowerCase());
          conditionMet = inValues.includes(String(fieldValue).toLowerCase());
          break;
        case "not_in":
          const notInValues = String(comparisonValue).split(",").map(v => v.trim().toLowerCase());
          conditionMet = !notInValues.includes(String(fieldValue).toLowerCase());
          break;
        case "contains":
          conditionMet = String(fieldValue).toLowerCase().includes(String(comparisonValue).toLowerCase());
          break;
        case ">":
          conditionMet = parseFloat(fieldValue) > parseFloat(comparisonValue);
          break;
        case "<":
          conditionMet = parseFloat(fieldValue) < parseFloat(comparisonValue);
          break;
        case ">=":
          conditionMet = parseFloat(fieldValue) >= parseFloat(comparisonValue);
          break;
        case "<=":
          conditionMet = parseFloat(fieldValue) <= parseFloat(comparisonValue);
          break;
        case "is_crs":
          // Check if country is a CRS participating country - now supports both name and code
          const countryLookup = crsCountryMap[String(fieldValue).toLowerCase()];
          conditionMet = countryLookup?.isCrs === true;
          break;
        case "is_not_crs":
          // Check if country is NOT a CRS participating country
          const countryLookupNot = crsCountryMap[String(fieldValue).toLowerCase()];
          conditionMet = countryLookupNot?.isCrs === false;
          break;
        default:
          conditionMet = false;
      }

      if (idx === 0) {
        result = conditionMet;
      } else {
        if (condition.logic_operator === "AND") {
          result = result && conditionMet;
        } else if (condition.logic_operator === "OR") {
          result = result || conditionMet;
        }
      }
    });

    return result;
  };

  // Build step map - must be before any conditional returns that use it
  const stepMap = {};
  if (workflow?.steps) {
    workflow.steps.forEach(step => {
      stepMap[step.step_id] = step;
    });
  }

  const isActionNode = (step) => {
    if (!step) return false;
    
    const inputTypes = ["text_input", "number_input", "date_input", "file_upload", "multi_field_input", "address_input", "beneficiary_input"];
    if (inputTypes.includes(step.question_type)) {
      if (step.default_next_step) return false;
      if (step.question_type === "text_input") return true;
      return false;
    }
    
    // Check for selection count branching on multiple_choice
    if (step.question_type === "multiple_choice" && step.conditional_logic?.use_selection_count) {
      if (step.conditional_logic.selection_count_next_step || step.conditional_logic.selection_count_else_step) {
        return false;
      }
    }
    
    // Check for conditional logic with next steps
    if (step.conditional_logic?.conditions?.length > 0) {
      if (step.conditional_logic.next_step || step.conditional_logic.else_step) {
        return false;
      }
    }
    
    if (!step.options || step.options.length === 0) {
      return true;
    }
    return !step.options.some(opt => opt.next_step);
  };

  const handleNext = () => {
    const currentNode = stepMap[currentNodeId];
    if (!currentNode) return;

    const newAnswers = { ...answers };

    if (currentNode.question_type === "single_choice" || 
        currentNode.question_type === "yes_no" ||
        currentNode.question_type === "multiple_choice") {
      if (!selectedValue) return;
      newAnswers[currentNodeId] = selectedValue;
    } else if (currentNode.question_type === "date_input" || 
               currentNode.question_type === "number_input") {
      if (!selectedValue) return;
      newAnswers[currentNodeId] = selectedValue;
    } else if (currentNode.question_type === "file_upload") {
      if (!selectedValue) return;
      newAnswers[currentNodeId] = selectedValue;
    } else if (currentNode.question_type === "multi_field_input") {
      const errors = {};
      const multiFields = currentNode.multi_fields || [];

      multiFields.forEach(field => {
        if (field.is_required && !multiFieldValues[field.field_id]) {
          errors[field.field_id] = `${field.display_label} is required`;
        }
      });

      if (Object.keys(errors).length > 0) {
        setMultiFieldErrors(errors);
        return;
      }

      setMultiFieldErrors({});
      newAnswers[currentNodeId] = multiFieldValues;
    } else if (currentNode.question_type === "address_input") {
      // Validate required country field
      if (!addressValues.country) {
        alert("Country is required");
        return;
      }
      newAnswers[currentNodeId] = {
        ...addressValues,
        _address_config: currentNode.address_config || { target_field: "current_address", track_changes: true }
      };
    } else if (currentNode.question_type === "beneficiary_input") {
      if (!beneficiariesAdded) {
        alert("Please add at least one beneficiary");
        return;
      }
      newAnswers[currentNodeId] = selectedValue;
    } else if (currentNode.question_type === "controlling_person_input") {
      if (!controllingPersonsAdded) {
        alert("Please add at least one controlling person");
        return;
      }
      newAnswers[currentNodeId] = selectedValue;
    }

    setAnswers(newAnswers);
    const newHistory = [...history, currentNodeId];
    setHistory(newHistory);

    // Determine next step - CONDITIONAL LOGIC FIRST (highest priority)
    let nextNodeId = null;

    // Check selection count branching for multiple_choice first
    if (currentNode.question_type === "multiple_choice" && currentNode.conditional_logic?.use_selection_count) {
      const selectedOptions = selectedValue ? selectedValue.split(',').filter(Boolean) : [];
      const selectionCount = selectedOptions.length;
      const countOperator = currentNode.conditional_logic.selection_count_operator || "=";
      const countValue = currentNode.conditional_logic.selection_count_value || 0;

      let countConditionMet = false;
      switch (countOperator) {
        case "=": countConditionMet = selectionCount === countValue; break;
        case "!=": countConditionMet = selectionCount !== countValue; break;
        case ">": countConditionMet = selectionCount > countValue; break;
        case "<": countConditionMet = selectionCount < countValue; break;
        case ">=": countConditionMet = selectionCount >= countValue; break;
        case "<=": countConditionMet = selectionCount <= countValue; break;
        default: countConditionMet = false;
      }

      if (countConditionMet) {
        nextNodeId = currentNode.conditional_logic.selection_count_next_step;
      } else {
        nextNodeId = currentNode.conditional_logic.selection_count_else_step;
      }
    }

    // Check conditional logic if no selection count branching matched
    // IMPORTANT: Only evaluate if trigger condition is met (or no trigger is defined)
    if (!nextNodeId && currentNode.conditional_logic?.conditions?.length > 0) {
      const logic = currentNode.conditional_logic;
      
      // Check if there's a trigger condition - only evaluate advanced logic if trigger matches
      let shouldEvaluateAdvancedLogic = true;
      if (logic.trigger_field && logic.trigger_value) {
        // Trigger is defined - only evaluate if the current answer matches the trigger
        const currentAnswer = newAnswers[currentNodeId];
        shouldEvaluateAdvancedLogic = String(currentAnswer) === String(logic.trigger_value);
      }
      
      if (shouldEvaluateAdvancedLogic) {
        const conditionMet = evaluateConditionalLogic(logic, newAnswers);
        if (conditionMet) {
          nextNodeId = logic.next_step;
        } else {
          nextNodeId = logic.else_step;
        }
      }
      // If trigger doesn't match, fall through to check option's next_step
    }

    // If no next step from conditional logic, check selected option
    if (!nextNodeId && selectedValue && currentNode.options && currentNode.options.length > 0) {
      const selectedOption = currentNode.options.find(opt => 
        opt.value === selectedValue || opt.label === selectedValue
      );
      if (selectedOption?.next_step) {
        nextNodeId = selectedOption.next_step;
      }
    }
    
    // If still no next step, check default_next_step
    if (!nextNodeId && currentNode.default_next_step) {
      nextNodeId = currentNode.default_next_step;
    }

    // Validate next step exists
    if (nextNodeId && !stepMap[nextNodeId]) {
      console.warn(`Next step "${nextNodeId}" not found in workflow, showing summary`);
      nextNodeId = null;
    }

    if (!nextNodeId || isActionNode(currentNode)) {
      setCompletedPath([...newHistory, currentNodeId]);
      setShowSummary(true);
      return;
    }

    setCurrentNodeId(nextNodeId);
    
    // Restore values if navigating to a step that already has an answer
    const existingAnswer = newAnswers[nextNodeId];
    if (existingAnswer && typeof existingAnswer === 'object' && existingAnswer._address_config) {
      // Restore address values
      const { _address_config, ...savedAddress } = existingAnswer;
      setAddressValues(savedAddress);
      setSelectedValue("");
    } else if (existingAnswer && typeof existingAnswer === 'object' && !existingAnswer.file_url) {
      // Restore multi-field values
      setMultiFieldValues(existingAnswer);
      setSelectedValue("");
      setAddressValues({ street: "", city: "", state: "", postal_code: "", country: "" });
    } else {
      setSelectedValue(existingAnswer || "");
      setAddressValues({ street: "", city: "", state: "", postal_code: "", country: "" });
      setMultiFieldValues({});
    }
    setDateValue("");
    setMultiFieldErrors({});
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
    const newAnswers = { ...answers };
    delete newAnswers[currentNodeId];

    setAnswers(newAnswers);
    setHistory(history.slice(0, -1));
    setCurrentNodeId(previousNodeId);
    
    // Restore previous step's values
    const previousAnswer = answers[previousNodeId];
    if (previousAnswer && typeof previousAnswer === 'object' && previousAnswer._address_config) {
      // Restore address values
      const { _address_config, ...savedAddress } = previousAnswer;
      setAddressValues(savedAddress);
      setSelectedValue("");
      setMultiFieldValues({});
    } else if (previousAnswer && typeof previousAnswer === 'object' && !previousAnswer.file_url) {
      // Restore multi-field values
      setMultiFieldValues(previousAnswer);
      setSelectedValue("");
      setAddressValues({ street: "", city: "", state: "", postal_code: "", country: "" });
    } else {
      setSelectedValue(previousAnswer || "");
      setAddressValues({ street: "", city: "", state: "", postal_code: "", country: "" });
      setMultiFieldValues({});
    }
  };

  const completeClassification = async () => {
    const finalNode = stepMap[history[history.length - 1]] || stepMap[currentNodeId];
    const finalAnswers = answers;

    const cleanedAnswers = { ...finalAnswers };
    delete cleanedAnswers._account_data_loaded;
    delete cleanedAnswers._is_pre_existing;
    delete cleanedAnswers._account_holder_is_alive;
    delete cleanedAnswers._account_holder_type;

    let reportabilityStatus = "pending_review";
    let reason = finalNode?.help_text || finalNode?.step_title || "Classification completed";

    if (finalNode?.step_title?.toLowerCase().includes("reportable") || 
        finalNode?.help_text?.toLowerCase().includes("reportable")) {
      if (finalNode.step_title?.toLowerCase().includes("non-reportable") || 
          finalNode.help_text?.toLowerCase().includes("non-reportable")) {
        reportabilityStatus = "non_reportable";
      } else if (finalNode.step_title?.toLowerCase().includes("pending") || 
                 finalNode.help_text?.toLowerCase().includes("pending")) {
        reportabilityStatus = "pending_review";
      } else {
        reportabilityStatus = "reportable";
      }
    }

    const fileUploadAnswer = Object.values(cleanedAnswers).find(ans => 
      ans && typeof ans === 'object' && ans.file_url
    );

    const classificationData = {
      classification_answers: cleanedAnswers,
      reportability_status: reportabilityStatus,
      reportability_reason: reason,
      self_certification_obtained: finalNode?.step_title?.toLowerCase().includes("self-certification obtained") || !!fileUploadAnswer
    };

    // Execute post-completion actions from all completed steps
    const allCompletedSteps = [...completedPath];
    for (const stepId of allCompletedSteps) {
      const step = stepMap[stepId];
      if (step?.post_completion_actions?.length > 0) {
        for (const action of step.post_completion_actions) {
          if (action.target_entity_type === "Account") {
            let newValue = action.value;
            
            // Determine the value based on source
            if (action.value_source === "from_step_answer") {
              newValue = cleanedAnswers[action.value] || action.value;
            } else if (action.value_source === "from_workflow_outcome") {
              if (action.value === "reportability_status") {
                newValue = reportabilityStatus;
              }
            }
            // static_value uses action.value directly
            
            // Apply the update to classificationData
            if (action.field_to_update && newValue) {
              classificationData[action.field_to_update] = newValue;
            }
          }
        }
      }
    }
    
    // Also check the final node for post-completion actions
    if (finalNode?.post_completion_actions?.length > 0) {
      for (const action of finalNode.post_completion_actions) {
        if (action.target_entity_type === "Account") {
          let newValue = action.value;
          
          if (action.value_source === "from_step_answer") {
            newValue = cleanedAnswers[action.value] || action.value;
          } else if (action.value_source === "from_workflow_outcome") {
            if (action.value === "reportability_status") {
              newValue = reportabilityStatus;
            }
          }
          
          if (action.field_to_update && newValue) {
            classificationData[action.field_to_update] = newValue;
          }
        }
      }
    }

    // Append new document to the documents array instead of overwriting
    // Use the latest account data to ensure we have up-to-date documents
    if (fileUploadAnswer) {
      const currentAccount = latestAccountData || account;
      const existingDocuments = currentAccount.documents || [];
      const newDocument = {
        id: `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        document_url: fileUploadAnswer.file_url,
        document_name: fileUploadAnswer.file_name,
        document_type: "self_certification",
        upload_date: fileUploadAnswer.upload_date || new Date().toISOString(),
        uploaded_by_email: user?.email || "Unknown",
        uploaded_by_name: user?.full_name || "Unknown User",
        notes: "Uploaded via classification workflow"
      };
      classificationData.documents = [...existingDocuments, newDocument];
      classificationData.self_certification_obtained = true;
    }

    // Handle address input - update account address and create audit log
    const addressAnswer = Object.values(cleanedAnswers).find(ans => 
      ans && typeof ans === 'object' && ans._address_config
    );

    if (addressAnswer) {
      const { _address_config, ...newAddress } = addressAnswer;
      const targetField = _address_config.target_field || "current_address";
      const currentAccount = latestAccountData || account;
      const previousAddress = currentAccount[targetField] || {};

      // Update the address field
      classificationData[targetField] = newAddress;

      // Create audit log entry if tracking is enabled
      if (_address_config.track_changes !== false) {
        try {
          await base44.entities.AuditLog.create({
            tenant_id: account.tenant_id,
            action_type: "account_updated",
            actor_email: user?.email || "unknown",
            actor_role: user?.user_role || "unknown",
            target_entity_type: "Account",
            target_entity_id: account.id,
            changes: {
              field: targetField,
              previous_value: previousAddress,
              new_value: newAddress
            },
            timestamp: new Date().toISOString()
          });
        } catch (error) {
          console.error("Error creating address change audit log:", error);
        }
      }
    }

    try {
      await base44.entities.AccountClassificationHistory.create({
        tenant_id: account.tenant_id,
        account_id: account.id,
        classification_date: new Date().toISOString(),
        reportability_status: reportabilityStatus,
        classification_reason: reason,
        reportable_jurisdictions: [],
        workflow_answers: cleanedAnswers,
        indicia_found: [],
        self_certification_status: classificationData.self_certification_obtained ? "obtained" : "not_obtained",
        performed_by: user?.email || "unknown",
        account_holder_name: account.account_holder_name,
        account_number: account.account_number,
        account_balance: account.account_balance
      });
    } catch (error) {
      console.error("Error saving classification history:", error);
    }

    onComplete(classificationData);
  };

  const renderNode = () => {
    const currentNode = stepMap[currentNodeId];
    if (!currentNode) return null;

    if (currentNode.question_type === "yes_no") {
      const options = currentNode.options || [
        { value: "YES", label: "Yes" },
        { value: "NO", label: "No" }
      ];
      
      return (
        <div className="space-y-3">
          <RadioGroup value={selectedValue} onValueChange={setSelectedValue}>
            {options.map((option) => (
              <div 
                key={option.value}
                className="flex items-center space-x-3 p-4 rounded-lg border-2 border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50 transition-all cursor-pointer"
                onClick={() => setSelectedValue(option.value)}
              >
                <RadioGroupItem value={option.value} id={option.value} />
                <Label 
                  htmlFor={option.value}
                  className="flex-1 cursor-pointer font-medium text-slate-900"
                >
                  {option.label}
                </Label>
                {option.value === selectedValue && (
                  <CheckCircle2 className="w-5 h-5 text-indigo-600" />
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
          <Select value={selectedValue} onValueChange={setSelectedValue}>
            <SelectTrigger className="w-full h-12">
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
      // Parse selected values - stored as comma-separated string
      const selectedOptions = selectedValue ? selectedValue.split(',').filter(Boolean) : [];

      const handleCheckboxChange = (optionValue, checked) => {
        let newSelected;
        if (checked) {
          newSelected = [...selectedOptions, optionValue];
        } else {
          newSelected = selectedOptions.filter(v => v !== optionValue);
        }
        setSelectedValue(newSelected.join(','));
      };

      return (
        <div className="space-y-3">
          {currentNode.options?.map((option) => (
            <div 
              key={option.value}
              className={`flex items-center space-x-3 p-4 rounded-lg border-2 transition-all cursor-pointer ${
                selectedOptions.includes(option.value)
                  ? 'border-indigo-400 bg-indigo-50'
                  : 'border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50'
              }`}
              onClick={() => handleCheckboxChange(option.value, !selectedOptions.includes(option.value))}
            >
              <Checkbox 
                checked={selectedOptions.includes(option.value)}
                onCheckedChange={(checked) => handleCheckboxChange(option.value, checked)}
                id={`option-${option.value}`}
              />
              <Label 
                htmlFor={`option-${option.value}`}
                className="flex-1 cursor-pointer font-medium text-slate-900"
              >
                {option.label}
              </Label>
              {selectedOptions.includes(option.value) && (
                <CheckCircle2 className="w-5 h-5 text-indigo-600" />
              )}
            </div>
          ))}
          {selectedOptions.length > 0 && (
            <p className="text-sm text-slate-600 mt-2">
              {selectedOptions.length} option(s) selected
            </p>
          )}
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

    if (currentNode.question_type === "date_input") {
      return (
        <div className="space-y-3">
          <Input
            type="date"
            value={dateValue}
            onChange={(e) => {
              setDateValue(e.target.value);
              setSelectedValue(e.target.value);
            }}
            className="w-full h-12"
          />
        </div>
      );
    }

    if (currentNode.question_type === "number_input") {
      return (
        <div className="space-y-3">
          <Input
            type="number"
            value={selectedValue}
            onChange={(e) => setSelectedValue(e.target.value)}
            placeholder="Enter a number..."
            className="w-full h-12"
          />
        </div>
      );
    }

    if (currentNode.question_type === "file_upload") {
      const handleFileUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploadingFile(true);
        try {
          const { file_url } = await base44.integrations.Core.UploadFile({ file });

          const uploadMetadata = {
            file_url,
            file_name: file.name,
            upload_date: new Date().toISOString(),
            uploaded_by: user?.email
          };

          setSelectedValue(uploadMetadata);
        } catch (error) {
          console.error("Error uploading file:", error);
          alert("Failed to upload file. Please try again.");
        } finally {
          setUploadingFile(false);
        }
      };

      return (
        <div className="space-y-3">
          <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:border-indigo-400 hover:bg-indigo-50/30 transition-all">
            <input
              type="file"
              onChange={handleFileUpload}
              className="hidden"
              id="file-upload"
              accept=".pdf,.jpg,.jpeg,.png"
              disabled={uploadingFile}
            />
            <label htmlFor="file-upload" className="cursor-pointer">
              {uploadingFile ? (
                <>
                  <Loader2 className="w-12 h-12 mx-auto mb-4 text-indigo-600 animate-spin" />
                  <p className="text-sm font-medium text-slate-700 mb-1">Uploading...</p>
                </>
              ) : selectedValue?.file_url ? (
                <>
                  <CheckCircle2 className="w-12 h-12 mx-auto mb-4 text-green-600" />
                  <p className="text-sm font-medium text-green-900 mb-1">
                    {selectedValue.file_name}
                  </p>
                  <p className="text-xs text-green-700">
                    Uploaded successfully
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="mt-3"
                    onClick={(e) => {
                      e.preventDefault();
                      document.getElementById('file-upload').click();
                    }}
                  >
                    Upload Different File
                  </Button>
                </>
              ) : (
                <>
                  <Upload className="w-12 h-12 mx-auto mb-4 text-slate-400" />
                  <p className="text-sm font-medium text-slate-700 mb-1">
                    Click to upload self-certification document
                  </p>
                  <p className="text-xs text-slate-500">
                    PDF, JPG, or PNG (Max 10MB)
                  </p>
                </>
              )}
            </label>
          </div>
        </div>
      );
    }

    if (currentNode.question_type === "multi_field_input") {
      return (
        <div className="space-y-3">
          <MultiFieldRenderer
            fields={currentNode.multi_fields || []}
            values={multiFieldValues}
            onChange={setMultiFieldValues}
            errors={multiFieldErrors}
          />
        </div>
      );
    }

    if (currentNode.question_type === "address_input") {
      const targetField = currentNode.address_config?.target_field || "current_address";
      const currentAccount = latestAccountData || account;
      const existingAddress = currentAccount[targetField] || {};

      return (
        <div className="space-y-4">
          {/* Show existing address if available */}
          {(existingAddress.street || existingAddress.city || existingAddress.country) && (
            <Alert className="bg-slate-50 border-slate-200">
              <Info className="w-4 h-4 text-slate-600" />
              <AlertDescription className="text-sm text-slate-700">
                <strong>Current {targetField === "current_address" ? "Address" : "Account Holder Address"}:</strong>
                <br />
                {existingAddress.street && <span>{existingAddress.street}<br /></span>}
                {(existingAddress.city || existingAddress.state || existingAddress.postal_code) && (
                  <span>
                    {[existingAddress.city, existingAddress.state, existingAddress.postal_code].filter(Boolean).join(", ")}
                    <br />
                  </span>
                )}
                {existingAddress.country && <span>{existingAddress.country}</span>}
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 gap-4">
            <div>
              <Label htmlFor="address_street" className="text-sm font-medium text-slate-700">Street Address</Label>
              <Input
                id="address_street"
                value={addressValues.street}
                onChange={(e) => setAddressValues({ ...addressValues, street: e.target.value })}
                placeholder="123 Main Street"
                className="mt-1.5"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="address_city" className="text-sm font-medium text-slate-700">City</Label>
                <Input
                  id="address_city"
                  value={addressValues.city}
                  onChange={(e) => setAddressValues({ ...addressValues, city: e.target.value })}
                  placeholder="City"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="address_state" className="text-sm font-medium text-slate-700">State/Province</Label>
                <Input
                  id="address_state"
                  value={addressValues.state}
                  onChange={(e) => setAddressValues({ ...addressValues, state: e.target.value })}
                  placeholder="State/Province"
                  className="mt-1.5"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="address_postal" className="text-sm font-medium text-slate-700">Postal Code</Label>
                <Input
                  id="address_postal"
                  value={addressValues.postal_code}
                  onChange={(e) => setAddressValues({ ...addressValues, postal_code: e.target.value })}
                  placeholder="Postal Code"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="address_country" className="text-sm font-medium text-slate-700">Country *</Label>
                <div className="mt-1.5">
                  <CountrySelect
                    value={addressValues.country}
                    onValueChange={(value) => setAddressValues({ ...addressValues, country: value })}
                    placeholder="Select country..."
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (currentNode.question_type === "beneficiary_input") {
      return (
        <BeneficiaryInputRenderer
          account={latestAccountData || account}
          tenant={null}
          onBeneficiariesAdded={(savedBeneficiaries) => {
            setBeneficiariesAdded(true);
            setSelectedValue({ beneficiaries_count: savedBeneficiaries.length, beneficiaries: savedBeneficiaries });
          }}
        />
      );
    }

    if (currentNode.question_type === "controlling_person_input") {
      return (
        <ControllingPersonInputRenderer
          account={latestAccountData || account}
          onControllingPersonsAdded={(savedPersons) => {
            setControllingPersonsAdded(true);
            setSelectedValue({ controlling_persons_count: savedPersons.length, controlling_persons: savedPersons });
          }}
        />
      );
    }

    return null;
    };

  // Early returns - MUST be after all hooks and function definitions
  if (!account) {
    return (
      <div className="p-12 text-center">
        <Alert className="bg-red-50 border-red-200">
          <AlertCircle className="w-4 h-4 text-red-600" />
          <AlertDescription className="text-red-900">
            No account data provided. Please select an account to classify.
          </AlertDescription>
        </Alert>
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
    const accountType = account?.account_holder_type === "individual" ? "individual" : "entity";
    return (
      <div className="p-12 text-center">
        <Alert className="bg-amber-50 border-amber-200">
          <AlertCircle className="w-4 h-4 text-amber-600" />
          <AlertDescription className="text-amber-900">
            No published {accountType} account reportability workflow found. Please contact your administrator to publish the workflow.
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

  const isEntityWorkflow = account?.account_holder_type === "entity";
  const currentStepIndex = history.length;
  const totalSteps = completedPath.length || history.length + 1;
  const progress = Math.round((currentStepIndex / totalSteps) * 100);

  // Summary Screen
  if (showSummary) {
    const finalNode = stepMap[completedPath[completedPath.length - 1]];
    const isReportable = finalNode?.step_title?.toLowerCase().includes("reportable") && 
                         !finalNode?.step_title?.toLowerCase().includes("non-reportable");

    return (
      <div className="space-y-6">
        <div className="text-center">
          <div className={`w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center ${
            isReportable ? 'bg-amber-100' : 'bg-green-100'
          }`}>
            {isReportable ? (
              <AlertCircle className="w-10 h-10 text-amber-600" />
            ) : (
              <CheckCircle2 className="w-10 h-10 text-green-600" />
            )}
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Classification Complete</h2>
          <p className="text-slate-600">
            Review your answers and confirm the reportability status for account <strong>{account.account_number}</strong>
          </p>
        </div>

        {account.account_holder_type === "individual" && (
          <Alert className="bg-blue-50 border-blue-200">
            <Info className="w-4 h-4 text-blue-600" />
            <AlertDescription className="text-sm text-blue-900">
              <strong>Account Context:</strong>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Account Type: {account.is_pre_existing ? "Pre-existing (opened before Jan 1, 2018)" : "New Account (Jan 1, 2018 or later)"}</li>
                <li>Account Holder Status: {account.account_holder_is_alive ? "Alive" : "Deceased"}</li>
              </ul>
            </AlertDescription>
          </Alert>
        )}

        <Card className={`border-2 ${
          isReportable 
            ? 'bg-amber-50 border-amber-200' 
            : 'bg-green-50 border-green-200'
        }`}>
          <CardHeader className="border-b border-slate-200">
            <CardTitle className="text-lg flex items-center gap-2">
              <FileCheck className="w-5 h-5" />
              Reportability Assessment Result
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700">Status:</span>
                <Badge className={`text-sm ${
                  isReportable 
                    ? 'bg-amber-600 text-white' 
                    : 'bg-green-600 text-white'
                }`}>
                  {isReportable ? 'Reportable' : 'Non-Reportable'}
                </Badge>
              </div>
              <div className="flex items-start justify-between">
                <span className="text-sm font-medium text-slate-700">Reason:</span>
                <span className="text-sm text-slate-900 text-right max-w-md">
                  {finalNode?.help_text || finalNode?.step_title || "Classification completed"}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg">
          <CardHeader className="border-b bg-slate-50">
            <CardTitle className="text-lg flex items-center gap-2">
              <FileCheck className="w-5 h-5" />
              Complete Answer Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4">
              {completedPath.map((stepId, idx) => {
                const step = stepMap[stepId];
                const answer = answers[stepId];
                if (!step || !answer) return null;

                const answerLabel = step.options?.find(o => o.value === answer)?.label || 
                  (typeof answer === 'object' && answer !== null 
                    ? (answer.file_name || JSON.stringify(answer)) 
                    : String(answer || ''));

                return (
                  <div key={stepId} className="flex items-start gap-4 pb-4 border-b border-slate-100 last:border-0 last:pb-0">
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
                      <Badge variant="secondary" className="bg-indigo-50 text-indigo-700">
                        {answerLabel}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 mb-1">Account Reportability Assessment</h2>
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
              onClick={() => setShowAIAssistant(true)}
              className="text-purple-600 hover:text-purple-700 hover:bg-purple-50"
            >
              <Sparkles className="w-4 h-4 mr-1" />
              AI Assist
            </Button>
          </div>
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

      <Dialog open={showAIAssistant} onOpenChange={setShowAIAssistant}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>AI Classification Assistant</DialogTitle>
          </DialogHeader>
          <AIClassificationAssistant
            record={latestAccountData || account}
            recordType="account"
            existingClassification={account?.reportability_status}
            onApplySuggestion={(suggestion) => {
              setShowAIAssistant(false);
              onComplete({
                ...suggestion,
                classification_answers: answers
              });
            }}
          />
        </DialogContent>
      </Dialog>

      <div className="space-y-2">
        <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
          <div 
            className="bg-gradient-to-r from-indigo-500 to-indigo-600 h-3 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>Started</span>
          <span className="font-medium text-indigo-600">{Object.keys(answers).filter(k => !k.startsWith('_')).length} questions answered</span>
          <span>Summary</span>
        </div>
      </div>

      <Alert className={isEntityWorkflow ? "bg-purple-50 border-purple-200" : "bg-blue-50 border-blue-200"}>
        {isEntityWorkflow ? (
          <>
            <Users className="w-4 h-4 text-purple-600" />
            <AlertDescription className="text-sm text-purple-900">
              <strong>Entity Account:</strong> This workflow determines if the entity is a Financial Institution, Active NFE, or Passive NFE requiring controlling persons identification.
            </AlertDescription>
          </>
        ) : (
          <>
            <Info className="w-4 h-4 text-blue-600" />
            <AlertDescription className="text-sm text-blue-900">
              <strong>Individual Account:</strong> This workflow follows CRS due diligence procedures for individual accounts.
              {account.is_pre_existing !== undefined && (
                <span className="block mt-1">
                  Account Type: <strong>{account.is_pre_existing ? "Pre-existing (before 2018)" : "New (2018+)"}</strong>
                </span>
              )}
              {account.account_holder_is_alive !== undefined && (
                <span className="block mt-1">
                  Holder Status: <strong>{account.account_holder_is_alive ? "Alive" : "Deceased"}</strong>
                </span>
              )}
            </AlertDescription>
          </>
        )}
      </Alert>

      <div className="flex items-center gap-2 flex-wrap">
        {history.map((stepId, idx) => {
          const step = stepMap[stepId];
          
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
            <span className="text-white text-xs font-bold">{history.length + 1}</span>
          </div>
          <span className="text-xs font-medium whitespace-nowrap text-indigo-700">
            {currentNode?.step_title?.substring(0, 15) || `Step ${history.length + 1}`}
            {currentNode?.step_title?.length > 15 && '...'}
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
                {currentNode.regulatory_reference && (
                  <p className="text-xs text-slate-500 italic mb-3 flex items-center gap-2">
                    <FileCheck className="w-3 h-3" />
                    Reference: {currentNode.regulatory_reference}
                  </p>
                )}
              </div>
            </div>

            <div className="pl-16">
              {renderNode()}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AI Workflow Helper */}
      <AIWorkflowHelper
        currentStep={currentNode}
        workflow={workflow}
        answers={answers}
        accountData={latestAccountData || account}
        onSuggestedAnswer={(value) => setSelectedValue(value)}
      />

      {Object.keys(answers).filter(k => !k.startsWith('_')).length > 0 && (
        <Card className="bg-slate-50 border-slate-200">
          <CardContent className="p-4">
            <details className="cursor-pointer">
              <summary className="text-sm font-semibold text-slate-700 flex items-center gap-2 hover:text-indigo-600 transition-colors">
                <FileCheck className="w-4 h-4" />
                View Previous Answers ({Object.keys(answers).filter(k => !k.startsWith('_')).length})
              </summary>
              <div className="mt-3 space-y-2 pl-6">
                {Object.entries(answers).filter(([key]) => !key.startsWith('_')).map(([key, value]) => {
                  const step = stepMap[key];
                  if (!step) return null;
                  return (
                    <div key={key} className="flex items-center justify-between text-sm py-2 border-b border-slate-200 last:border-0">
                      <span className="text-slate-600 text-xs">
                        {step.step_title || key}
                      </span>
                      <Badge variant="outline" className="capitalize text-xs">
                        {step.options?.find(o => o.value === value)?.label || 
                          (typeof value === 'object' && value !== null 
                            ? (value.file_name || JSON.stringify(value)) 
                            : String(value || ''))}
                      </Badge>
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
            !selectedValue && 
            !(currentNode.question_type === "multi_field_input" && Object.keys(multiFieldValues).length > 0) &&
            !(currentNode.question_type === "address_input" && addressValues.country) &&
            !(currentNode.question_type === "beneficiary_input" && beneficiariesAdded) &&
            !(currentNode.question_type === "controlling_person_input" && controllingPersonsAdded)
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