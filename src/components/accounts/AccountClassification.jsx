import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, ArrowRight, ArrowLeft, Info, FileCheck, Loader2, AlertCircle, Users, Check, Circle, Upload, GitBranch, Brain, Sparkles, Calendar, Clock } from "lucide-react";
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
import { evaluateSingleCondition, evaluateConditionalLogic } from "../workflows/workflowConditionUtils";
import { isActionNode } from "../workflows/workflowNavigationUtils";
import { getFieldValue as getFieldValueUtil } from "../workflows/workflowFieldUtils";
import { evaluateComputedComparison } from "../workflows/workflowPrefillUtils";
export default function AccountClassification({ account, onComplete, onCancel }) {
  const [currentNodeId, setCurrentNodeId] = useState(null);
  const [answers, setAnswers] = useState({});
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
  const [dragActive, setDragActive] = useState(false);
  const [showDocumentPreview, setShowDocumentPreview] = useState(false);
  const [previewDocument, setPreviewDocument] = useState(null);
  const [dateReceivedValue, setDateReceivedValue] = useState("");

  const { data: freshAccountData, refetch: refetchAccount } = useQuery({
    queryKey: ['account-fresh', account?.id],
    queryFn: async () => {
      if (!account?.id) return null;
      const accounts = await base44.entities.Account.filter({ id: account.id });
      return accounts[0] || null;
    },
    enabled: !!account?.id,
    staleTime: 0,
  });

  useEffect(() => {
    if (freshAccountData) {
      setLatestAccountData(freshAccountData);
    }
  }, [freshAccountData]);

  useEffect(() => {
    const handleAccountUpdate = (event) => {

      refetchAccount();
    };

    window.addEventListener('account-updated', handleAccountUpdate);
    return () => window.removeEventListener('account-updated', handleAccountUpdate);
  }, [refetchAccount]);

  const { data: workflows = [], isLoading } = useQuery({
    queryKey: ['account-workflows'],
    queryFn: () => base44.entities.Workflow.filter({
      workflow_type: 'account_reportability',
      status: 'published'
    }),
    enabled: !!account
  });

  const { data: referencedData = [] } = useQuery({
    queryKey: ['referenced-data-for-triggers'],
    queryFn: () => base44.entities.ReferencedData.list(),
    staleTime: Infinity
  });

  const { data: crsCountryMap = {} } = useQuery({
    queryKey: ['crs-country-map-for-evaluation'],
    queryFn: async () => {
      const countries = await base44.entities.CrsCountryInfo.list();
      const map = {};
      countries.forEach(c => {
        if (c.country_name) {
          map[c.country_name.toLowerCase()] = {
            code: c.country_code?.toUpperCase(),
            isCrs: c.is_crs_country
          };
        }
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

  const { data: linkedEntity } = useQuery({
    queryKey: ['linked-entity', account?.entity_id],
    queryFn: async () => {
      if (!account?.entity_id) return null;
      const entities = await base44.entities.Entity.filter({ id: account.entity_id });
      return entities[0] || null;
    },
    enabled: !!account?.entity_id,
    staleTime: 60000
  });

  const evaluateTriggerConditions = (triggerConfig, accountData, entityData = null) => {
    if (!triggerConfig?.enabled) {
      return false;
    }

    const conditions = triggerConfig.conditions || [];
    const computedConditions = triggerConfig.computed_conditions || [];

    if (conditions.length === 0 && computedConditions.length === 0) {
      return true;
    }

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
      if (accountData?.[fieldPath] !== undefined) return accountData[fieldPath];
      if (accountData?.account_holder_type === "entity" && entityData?.[fieldPath] !== undefined) return entityData[fieldPath];
      return null;
    };

    // Helper to normalize enum values for comparison (supports both value and label matching)
    const normalizeEnumComparison = (fieldName, fieldValue, comparisonValue) => {
      if (!fieldValue || !comparisonValue) return { fieldValue, comparisonValue };

      // Try to find matching referenced data for this field
      const entityType = entityData && fieldName === 'fi_type' ? 'Entity' : 'Account';
      const matchingRefData = referencedData.filter(rd => 
        rd.entity_name === entityType && 
        rd.field_name === fieldName && 
        rd.is_published
      );

      if (matchingRefData.length === 0) {
        // No referenced data, return as-is
        return { fieldValue, comparisonValue };
      }

      // Helper for fuzzy matching (handles case, plural/singular, extra spaces)
      const fuzzyMatch = (str1, str2) => {
        const normalize = (s) => String(s).toLowerCase().trim().replace(/s$/, ''); // Remove trailing 's' for plural
        return normalize(str1) === normalize(str2);
      };

      // Try exact match first, then fuzzy match for fieldValue
      let fieldValueRefData = matchingRefData.find(rd => 
        rd.value.toLowerCase() === String(fieldValue).toLowerCase() ||
        rd.label.toLowerCase() === String(fieldValue).toLowerCase()
      );
      
      if (!fieldValueRefData) {
        // Try fuzzy match
        fieldValueRefData = matchingRefData.find(rd => 
          fuzzyMatch(rd.value, fieldValue) || fuzzyMatch(rd.label, fieldValue)
        );
      }

      const normalizedFieldValue = fieldValueRefData?.label || fieldValue;

      // Try exact match first, then fuzzy match for comparisonValue
      let comparisonValueRefData = matchingRefData.find(rd => 
        rd.value.toLowerCase() === String(comparisonValue).toLowerCase() ||
        rd.label.toLowerCase() === String(comparisonValue).toLowerCase()
      );
      
      if (!comparisonValueRefData) {
        // Try fuzzy match
        comparisonValueRefData = matchingRefData.find(rd => 
          fuzzyMatch(rd.value, comparisonValue) || fuzzyMatch(rd.label, comparisonValue)
        );
      }

      const normalizedComparisonValue = comparisonValueRefData?.label || comparisonValue;

      return { 
        fieldValue: normalizedFieldValue, 
        comparisonValue: normalizedComparisonValue 
      };
    };

    let result = null;
    let currentAndGroup = [];

    // Group conditions by AND/OR operators to properly handle precedence
    // AND has higher precedence than OR, so we evaluate AND groups first
    for (let idx = 0; idx < conditions.length; idx++) {
      const condition = conditions[idx];
      const fieldValue = getFieldValue(condition.field);
      // Normalize enum values for comparison
      const { fieldValue: normalizedFieldValue, comparisonValue: normalizedComparisonValue } = 
        normalizeEnumComparison(condition.field, fieldValue, condition.value);
      
      let conditionMet = false;

      switch (condition.operator) {
        case "equals":
          conditionMet = String(normalizedFieldValue).toLowerCase() === String(normalizedComparisonValue).toLowerCase();
          break;
        case "not_equals":
          conditionMet = String(normalizedFieldValue).toLowerCase() !== String(normalizedComparisonValue).toLowerCase();
          break;
        case "greater_than":
        case ">":
          conditionMet = parseFloat(fieldValue) > parseFloat(normalizedComparisonValue);
          break;
        case "less_than":
        case "<":
          conditionMet = parseFloat(fieldValue) < parseFloat(normalizedComparisonValue);
          break;
        case "greater_than_or_equal":
        case ">=":
          conditionMet = parseFloat(fieldValue) >= parseFloat(normalizedComparisonValue);
          break;
        case "less_than_or_equal":
        case "<=":
          conditionMet = parseFloat(fieldValue) <= parseFloat(normalizedComparisonValue);
          break;
        case "contains":
          conditionMet = String(normalizedFieldValue).toLowerCase().includes(String(normalizedComparisonValue).toLowerCase());
          break;
        case "in":
          const inValues = String(normalizedComparisonValue).split(",").map(v => v.trim().toLowerCase());
          conditionMet = inValues.includes(String(normalizedFieldValue).toLowerCase());
          break;
        case "not_in":
          const notInValues = String(normalizedComparisonValue).split(",").map(v => v.trim().toLowerCase());
          conditionMet = !notInValues.includes(String(normalizedFieldValue).toLowerCase());
          break;
        default:
          conditionMet = false;
      }

      currentAndGroup.push(conditionMet);

      // Check if we need to evaluate the current AND group
      const isLastCondition = idx === conditions.length - 1;
      const nextOperator = !isLastCondition ? conditions[idx]?.logic_operator : null;

      if (nextOperator === "OR" || isLastCondition) {
        const andGroupResult = currentAndGroup.every(val => val === true);
        if (result === null) {
          result = andGroupResult;
        } else {
          result = result || andGroupResult;
        }
        currentAndGroup = [];
      }
    }

    for (let idx = 0; idx < computedConditions.length; idx++) {
      const compCondition = computedConditions[idx];
      let compResult = false;

      try {
        const expression = compCondition.expression;
        const fieldRegex = /\b([a-z_]+[a-z0-9_]*)\b/gi;
        let computedExpression = expression.replace(fieldRegex, (match) => {
          if (['AND', 'OR', 'true', 'false', 'null'].includes(match)) return match;
          const value = getFieldValue(match);
          return isNaN(parseFloat(value)) ? 0 : parseFloat(value);
        });

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
    ("Error evaluating computed condition:", error);
        compResult = false;
      }

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
      if (account.account_holder_type === "entity" && !linkedEntity) return;
      
      const matchingWorkflows = workflows.filter(w => {
        if (w.trigger_conditions?.enabled) {
          return evaluateTriggerConditions(w.trigger_conditions, account, linkedEntity);
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
  }, [workflows, workflow, account, linkedEntity]);

  useEffect(() => {
    if (!currentNodeId) return;

    const currentNode = stepMap[currentNodeId];
    const existingAnswer = answers[currentNodeId];

    if (existingAnswer && typeof existingAnswer === 'object' && existingAnswer._address_config) {
      const { _address_config, ...savedAddress } = existingAnswer;
      setAddressValues(savedAddress);
      setSelectedValue("");
    } else if (existingAnswer && typeof existingAnswer === 'object' && !existingAnswer.file_url) {
      setMultiFieldValues(existingAnswer);
      setSelectedValue("");
    } else if (existingAnswer && typeof existingAnswer === 'object' && existingAnswer.file_url) {
      setSelectedValue(existingAnswer);
      setDateReceivedValue(existingAnswer.date_received || "");
    } else if (existingAnswer) {
      setSelectedValue(existingAnswer);
      setDateValue(existingAnswer);
    }
  }, [currentNodeId, answers]);

  useEffect(() => {
    if (account && !answers._account_data_loaded && workflow) {
      const currentAccount = latestAccountData || account;

      const preFillAnswers = {
        _account_data_loaded: true,
        _is_pre_existing: currentAccount.is_pre_existing,
        _account_holder_is_alive: currentAccount.account_holder_is_alive,
        _account_holder_type: currentAccount.account_holder_type
      };

      workflow.steps.forEach(step => {
        if (step.mapped_field?.entity_type === "Account" && step.mapped_field?.field_name) {
          const fieldName = step.mapped_field.field_name;
          let fieldValue = currentAccount[fieldName];

          if (fieldValue !== undefined && fieldValue !== null && fieldValue !== "") {
            if (step.question_type === 'yes_no' && step.mapped_field.prefill_config) {
              const prefillType = step.mapped_field.prefill_config.prefill_type;

              if (prefillType === 'country_crs') {
                const normalizedCountry = String(fieldValue).toLowerCase();
                const countryInfo = crsCountryMap[normalizedCountry];
                if (countryInfo) {
                  preFillAnswers[step.step_id] = countryInfo.isCrs ? 'YES' : 'NO';
                }
              } else if (prefillType === 'enum_match') {
                const matchValues = step.mapped_field.prefill_config.match_values || [];
                preFillAnswers[step.step_id] = matchValues.includes(String(fieldValue)) ? 'YES' : 'NO';
              } else if (prefillType === 'computed_comparison') {
                preFillAnswers[step.step_id] = evaluateComputedComparison(step.mapped_field.prefill_config, currentAccount);
              }
            }
            else if (step.question_type === 'yes_no' && typeof fieldValue === 'boolean') {
              preFillAnswers[step.step_id] = fieldValue ? 'YES' : 'NO';
            } else if (step.question_type === 'multiple_choice' && Array.isArray(fieldValue)) {
              preFillAnswers[step.step_id] = fieldValue.join(',');
            } else if (step.question_type === 'address_input' && typeof fieldValue === 'object') {
              preFillAnswers[step.step_id] = {
                ...fieldValue,
                _address_config: step.address_config || { target_field: "current_address", track_changes: true }
              };
            } else if (step.question_type === 'date_input') {
              preFillAnswers[step.step_id] = String(fieldValue);
            } else if (step.question_type === 'number_input') {
              preFillAnswers[step.step_id] = String(fieldValue);
            } else {
              preFillAnswers[step.step_id] = String(fieldValue);
            }
          }
        }

        if (step.mapped_field?.entity_type === "Entity" && step.mapped_field?.field_name && linkedEntity) {
          const fieldName = step.mapped_field.field_name;
          let fieldValue = linkedEntity[fieldName];

          if (fieldValue !== undefined && fieldValue !== null && fieldValue !== "") {
            if (step.question_type === 'yes_no' && typeof fieldValue === 'boolean') {
              preFillAnswers[step.step_id] = fieldValue ? 'YES' : 'NO';
            } else if (step.question_type === 'single_choice') {
              const stringValue = String(fieldValue);
              let matchingOption = step.options?.find(opt => opt.value === stringValue);
              if (!matchingOption) {
                matchingOption = step.options?.find(opt => opt.label?.toLowerCase() === stringValue.toLowerCase());
              }
              if (matchingOption) {
                preFillAnswers[step.step_id] = matchingOption.value;
              }
            } else if (step.question_type === 'date_input') {
              preFillAnswers[step.step_id] = String(fieldValue);
            } else if (step.question_type === 'number_input') {
              preFillAnswers[step.step_id] = String(fieldValue);
            } else {
              preFillAnswers[step.step_id] = String(fieldValue);
            }
          }
        }

        if (step.question_type === 'yes_no' && step.mapped_field?.field_name) {
          const fieldName = step.mapped_field.field_name;
          let countryValue = null;

          if (step.mapped_field.entity_type === "Account") {
            if (fieldName === 'current_address.country') {
              countryValue = account?.current_address?.country;
            } else if (fieldName === 'account_holder_address.country') {
              countryValue = account?.account_holder_address?.country;
            } else if (fieldName === 'country_of_residence') {
              countryValue = account?.country_of_residence;
            } else if (fieldName === 'place_of_birth') {
              countryValue = account?.place_of_birth;
            }
          }
          else if (step.mapped_field.entity_type === "Entity" && linkedEntity) {
            if (fieldName === 'country_of_incorporation') {
              countryValue = linkedEntity?.country_of_incorporation;
            } else if (fieldName === 'address.country') {
              countryValue = linkedEntity?.address?.country;
            }
          }

          if (countryValue) {
            const normalizedCountry = String(countryValue).toLowerCase();
            const countryInfo = crsCountryMap[normalizedCountry];

            if (countryInfo) {
              preFillAnswers[step.step_id] = countryInfo.isCrs ? 'YES' : 'NO';
            }
          }
        }
      });

      setAnswers(prev => ({ ...prev, ...preFillAnswers }));
    }
  }, [account, workflow, latestAccountData, crsCountryMap, linkedEntity]);

  const loadUser = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
    } catch (error) {
      console.error("Error loading user:", error);
    }
  };

  // Wrapper to maintain compatibility with existing code - now supports answer overrides for state timing fix
  const evaluateSingleConditionWrapper = (condition, answersOverride = null) => {
    const getFieldValueFn = (field) => getFieldValueUtil(field, account, linkedEntity, answers, answersOverride);
    return evaluateSingleCondition(condition, getFieldValueFn, crsCountryMap);
  };

  const executePostCompletionActions = async (actions, currentAnswers) => {
    if (!actions || actions.length === 0) return;

    for (const action of actions) {
      try {
        if (action.target_entity_type !== "Account" || !account?.id) continue;

        let valueToUpdate = null;

        if (action.value_source === "static_value") {
          valueToUpdate = action.value;
        } else if (action.value_source === "from_step_answer") {
          const sourceStepId = action.value;
          valueToUpdate = currentAnswers[sourceStepId];
          if (valueToUpdate === 'YES') valueToUpdate = true;
          if (valueToUpdate === 'NO') valueToUpdate = false;
        } else if (action.value_source === "from_workflow_outcome") {
          continue;
        }

        if (action.condition) {
          const conditionField = action.condition.field;
          const conditionOperator = action.condition.operator;
          const conditionValue = action.condition.value;

          const fieldValue = currentAnswers[conditionField];

          let conditionMet = false;
          switch (conditionOperator) {
            case '=': conditionMet = String(fieldValue || '').toLowerCase() === String(conditionValue || '').toLowerCase(); break;
            case '!=': conditionMet = String(fieldValue || '').toLowerCase() !== String(conditionValue || '').toLowerCase(); break;
            case 'contains': conditionMet = String(fieldValue || '').toLowerCase().includes(String(conditionValue || '').toLowerCase()); break;
            case 'in': conditionMet = String(conditionValue).split(',').map(v => v.trim().toLowerCase()).includes(String(fieldValue || '').toLowerCase()); break;
            case 'not_in': conditionMet = !String(conditionValue).split(',').map(v => v.trim().toLowerCase()).includes(String(fieldValue || '').toLowerCase()); break;
            default: conditionMet = false;
          }

          if (!conditionMet) continue;
        }

        const fieldToUpdate = action.field_to_update;
        await base44.entities.Account.update(account.id, { [fieldToUpdate]: valueToUpdate });
        window.dispatchEvent(new CustomEvent('account-updated', { detail: { accountId: account.id, field: fieldToUpdate, value: valueToUpdate } }));
      } catch (error) {
        console.error("[POST-COMPLETION ACTION] Error:", error);
      }
    }
  };

  // Wrapper to use extracted utility function - passes currentAnswers to condition evaluator for state timing fix
  const evaluateConditionalLogicWrapper = async (logic, currentAnswers) => {
    const conditionEvaluator = (condition) => evaluateSingleConditionWrapper(condition, currentAnswers);
    return await evaluateConditionalLogic(logic, currentAnswers, conditionEvaluator);
  };

  const stepMap = {};
  if (workflow?.steps) {
    workflow.steps.forEach(step => {
      stepMap[step.step_id] = step;
    });
  }

  // Use extracted utility function directly
  // (isActionNode is now imported from workflowNavigationUtils)

  const handleNext = async () => {
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
      const fileConfig = currentNode.file_upload_config || {};
      const requireDateReceived = fileConfig.require_date_received || false;

      if (!selectedValue?.file_url) {
        alert("Please upload a file.");
        return;
      }
      if (requireDateReceived && !dateReceivedValue) {
        alert("Please enter the date the document was received.");
        return;
      }
      newAnswers[currentNodeId] = {
        ...selectedValue,
        date_received: dateReceivedValue
      };
    } else if (currentNode.question_type === "multi_field_input") {
      const errors = {};
      const multiFields = currentNode.multi_fields || [];

      multiFields.forEach(field => {
        let isFieldVisible = true;
        if (field.conditional_visibility) {
          const condVis = field.conditional_visibility;
          isFieldVisible = String(multiFieldValues[condVis.depends_on_field]) === String(condVis.required_value);
        }
        if (!isFieldVisible) return;

        let isFieldRequired = field.is_required;
        if (field.conditional_required) {
          const condReq = field.conditional_required;
          isFieldRequired = String(multiFieldValues[condReq.depends_on_field]) === String(condReq.required_value);
        }

        if (isFieldRequired && !multiFieldValues[field.field_id]) {
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
      if (!addressValues.street || !addressValues.city || !addressValues.state ||
          !addressValues.postal_code || !addressValues.country) {
        alert("All address fields are required");
        return;
      }
      newAnswers[currentNodeId] = {
        ...addressValues,
        _address_config: currentNode.address_config || { target_field: "current_address", track_changes: true }
      };
    } else if (currentNode.question_type === "beneficiary_input") {
      const beneficiaryData = newAnswers[currentNodeId];
      if (!beneficiaryData?.savedBeneficiaries || beneficiaryData.savedBeneficiaries.length === 0) {
        alert("Please add and save at least one beneficiary");
        return;
      }
    } else if (currentNode.question_type === "controlling_person_input") {
      const controllingPersonData = newAnswers[currentNodeId];
      if (!controllingPersonData?.savedPersons || controllingPersonData.savedPersons.length === 0) {
        alert("Please add and save at least one controlling person");
        return;
      }
    }

    setAnswers(newAnswers);

    if (currentNode.post_completion_actions && currentNode.post_completion_actions.length > 0) {
      const afterStepActions = currentNode.post_completion_actions.filter(
        action => (action.execution_timing || "after_step") === "after_step"
      );
      if (afterStepActions.length > 0) {
        await executePostCompletionActions(afterStepActions, newAnswers);
      }
    }

    const newHistory = history.includes(currentNodeId)
      ? history
      : [...history, currentNodeId];
    setHistory(newHistory);

    let nextNodeId = null;

    if (currentNode.question_type === "multiple_choice" &&
        currentNode.conditional_logic?.option_values?.length > 0) {
      const selectedOptions = selectedValue ? selectedValue.split(',').filter(Boolean) : [];
      const matchFound = selectedOptions.some(selectedOpt =>
        currentNode.conditional_logic.option_values.includes(selectedOpt)
      );

      if (matchFound) {
        nextNodeId = currentNode.conditional_logic.option_values_next_step;
      } else {
        nextNodeId = currentNode.conditional_logic.option_values_else_step;
      }
    }

    if (!nextNodeId && currentNode.question_type === "multiple_choice" &&
        currentNode.conditional_logic?.multi_choice_routing_groups?.length > 0) {
      const selectedOptions = selectedValue ? selectedValue.split(',').filter(Boolean) : [];
      
      for (const group of currentNode.conditional_logic.multi_choice_routing_groups) {
        let groupMatches = group.group_operator === 'AND';
        
        for (const condition of group.conditions) {
          let conditionMet = false;
          
          if (condition.condition_type === 'selected_options') {
            conditionMet = selectedOptions.some(selectedOpt => condition.option_values?.includes(selectedOpt));
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
          } else if (condition.condition_type === 'field_comparison') {
            conditionMet = await evaluateSingleConditionWrapper(condition, newAnswers);
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
          nextNodeId = group.next_step;
          break;
        }
      }
      
      if (!nextNodeId) {
        const lastGroup = currentNode.conditional_logic.multi_choice_routing_groups[currentNode.conditional_logic.multi_choice_routing_groups.length - 1];
        if (lastGroup?.false_step) {
          nextNodeId = lastGroup.false_step;
        } else if (currentNode.conditional_logic.multi_choice_default_step) {
          nextNodeId = currentNode.conditional_logic.multi_choice_default_step;
        }
      }
    }

    if (!nextNodeId && currentNode.question_type === "multiple_choice") {
      if (currentNode.conditional_logic?.selection_count_next_step || currentNode.conditional_logic?.selection_count_else_step) {
        const selectedOptions = selectedValue ? selectedValue.split(',').filter(Boolean) : [];
        const selectionCount = selectedOptions.length;
        const countOperator = currentNode.conditional_logic.selection_count_operator || "=";
        const countValue = currentNode.conditional_logic.selection_count_value || 0;

        let countConditionMet = false;
        switch (countOperator) {
          case "=":
          case "equals":
            countConditionMet = selectionCount === countValue;
            break;
          case "!=":
          case "not_equals":
            countConditionMet = selectionCount !== countValue;
            break;
          case ">":
          case "greater_than":
            countConditionMet = selectionCount > countValue;
            break;
          case "<":
          case "less_than":
            countConditionMet = selectionCount < countValue;
            break;
          case ">=":
          case "greater_than_or_equal":
            countConditionMet = selectionCount >= countValue;
            break;
          case "<=":
          case "less_than_or_equal":
            countConditionMet = selectionCount <= countValue;
            break;
          default:
            countConditionMet = false;
        }

        if (countConditionMet) {
          nextNodeId = currentNode.conditional_logic.selection_count_next_step;
        } else {
          nextNodeId = currentNode.conditional_logic.selection_count_else_step;
        }
      }
    }

    if (!nextNodeId && (currentNode.conditional_logic?.condition_groups?.length > 0 || currentNode.conditional_logic?.conditions?.length > 0)) {
      const logic = currentNode.conditional_logic;
      let shouldEvaluateAdvancedLogic = true;
      if (logic.trigger_field && logic.trigger_value) {
        const currentAnswer = newAnswers[currentNodeId];
        shouldEvaluateAdvancedLogic = String(currentAnswer) === String(logic.trigger_value);
      }

      if (shouldEvaluateAdvancedLogic) {
        if (logic.condition_groups?.length > 0) {
          nextNodeId = await evaluateConditionalLogicWrapper(logic, newAnswers);
        } else if (logic.conditions?.length > 0) {
          const conditionMet = await evaluateConditionalLogicWrapper(logic, newAnswers);
          nextNodeId = conditionMet ? logic.next_step : logic.else_step;
        }
      }
    }

    if (!nextNodeId && selectedValue && currentNode.options && currentNode.options.length > 0) {
      const selectedOption = currentNode.options.find(opt => opt.value === selectedValue || opt.label === selectedValue);
      if (selectedOption?.next_step) nextNodeId = selectedOption.next_step;
    }

    if (!nextNodeId && currentNode.default_next_step) {
      nextNodeId = currentNode.default_next_step;
    }

    if (nextNodeId && !stepMap[nextNodeId]) {
      nextNodeId = null;
    }

    if (!nextNodeId && (currentNode.question_type === "controlling_person_input" || currentNode.question_type === "beneficiary_input")) {
      if (currentNode.default_next_step && stepMap[currentNode.default_next_step]) {
        nextNodeId = currentNode.default_next_step;
      }
    }

    const uniquePath = [...new Set([...newHistory, currentNodeId])];

    if (!nextNodeId || isActionNode(currentNode)) {
      setCompletedPath(uniquePath);
      setShowSummary(true);
      return;
    }

    setCurrentNodeId(nextNodeId);

    const existingAnswer = newAnswers[nextNodeId];

    if (existingAnswer && typeof existingAnswer === 'object' && existingAnswer._address_config) {
      const { _address_config, ...savedAddress } = existingAnswer;
      setAddressValues(savedAddress);
      setSelectedValue("");
      setDateValue("");
      setDateReceivedValue("");
    } else if (existingAnswer && typeof existingAnswer === 'object' && existingAnswer.file_url) {
      setSelectedValue(existingAnswer);
      setDateReceivedValue(existingAnswer.date_received || "");
      setDateValue("");
      setAddressValues({ street: "", city: "", state: "", postal_code: "", country: "" });
      setMultiFieldValues({});
    } else if (existingAnswer && typeof existingAnswer === 'object' && !existingAnswer.file_url) {
      setMultiFieldValues(existingAnswer);
      setSelectedValue("");
      setAddressValues({ street: "", city: "", state: "", postal_code: "", country: "" });
      setDateValue("");
      setDateReceivedValue("");
    } else if (existingAnswer) {
      setSelectedValue(existingAnswer || "");
      setDateValue(existingAnswer || "");
      setAddressValues({ street: "", city: "", state: "", postal_code: "", country: "" });
      setMultiFieldValues({});
      setDateReceivedValue("");
    } else {
      setSelectedValue("");
      setDateValue("");
      setAddressValues({ street: "", city: "", state: "", postal_code: "", country: "" });
      setMultiFieldValues({});
      setDateReceivedValue("");
    }
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

    const previousAnswer = answers[previousNodeId];

    if (previousAnswer && typeof previousAnswer === 'object' && previousAnswer._address_config) {
      const { _address_config, ...savedAddress } = previousAnswer;
      setAddressValues(savedAddress);
      setSelectedValue("");
      setMultiFieldValues({});
      setDateValue("");
      setDateReceivedValue("");
    } else if (previousAnswer && typeof previousAnswer === 'object' && previousAnswer.file_url) {
      setSelectedValue(previousAnswer);
      setDateReceivedValue(previousAnswer.date_received || "");
      setDateValue("");
      setAddressValues({ street: "", city: "", state: "", postal_code: "", country: "" });
      setMultiFieldValues({});
    } else if (previousAnswer && typeof previousAnswer === 'object' && !previousAnswer.file_url) {
      setMultiFieldValues(previousAnswer);
      setSelectedValue("");
      setAddressValues({ street: "", city: "", state: "", postal_code: "", country: "" });
      setDateValue("");
      setDateReceivedValue("");
    } else {
      setSelectedValue(previousAnswer || "");
      setDateValue(previousAnswer || "");
      setAddressValues({ street: "", city: "", state: "", postal_code: "", country: "" });
      setMultiFieldValues({});
      setDateReceivedValue("");
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

    // Check if result_action is "manage_controlling_persons"
    const shouldRedirectToControllingPersons = finalNode?.result_action === "manage_controlling_persons";

    // Check if workflow contains a "Request New Self Certification" step with a date
    let selfCertRequestDate = null;
    for (const [stepId, answerValue] of Object.entries(cleanedAnswers)) {
      const step = stepMap[stepId];
      if (step?.step_title?.toLowerCase().includes("request new self certification") && 
          step?.question_type === "date_input" && 
          answerValue) {
        selfCertRequestDate = answerValue;
        break;
      }
    }

    // Execute all after_workflow actions in parallel for speed
    const afterWorkflowPromises = [];
    for (const stepId of completedPath) {
      const step = stepMap[stepId];
      if (step?.post_completion_actions && step.post_completion_actions.length > 0) {
        const afterWorkflowActions = step.post_completion_actions.filter(
          action => action.execution_timing === "after_workflow"
        );
        if (afterWorkflowActions.length > 0) {
          afterWorkflowPromises.push(executePostCompletionActions(afterWorkflowActions, cleanedAnswers));
        }
      }
    }
    
    // Wait for all after_workflow actions to complete in parallel
    if (afterWorkflowPromises.length > 0) {
      await Promise.all(afterWorkflowPromises);
    }

    let reportabilityStatus = "pending_review";
    let reason = finalNode?.result_description || finalNode?.help_text || finalNode?.step_title || "Classification completed";

    // Priority 1: Use explicit result_status from workflow step configuration
    if (finalNode?.result_status) {
      reportabilityStatus = finalNode.result_status;
    } 
    // Priority 2: Infer from post-completion actions (with proper value extraction)
    else if (finalNode?.post_completion_actions?.length > 0) {
      const statusAction = finalNode.post_completion_actions.find(
        action => action.field_to_update === "reportability_status"
      );
      if (statusAction) {
        let extractedValue = null;
        
        if (statusAction.value_source === "static_value") {
          extractedValue = statusAction.value;
        } else if (statusAction.value_source === "from_step_answer") {
          extractedValue = cleanedAnswers[statusAction.value];
        } else if (statusAction.value_source === "from_workflow_outcome") {
          // This means it wants to use the computed reportability_status
          // We'll let it fall through to text inference
          extractedValue = null;
        }
        
        if (extractedValue) {
          reportabilityStatus = extractedValue;
        }
      }
    }
    
    // Priority 3: Infer from text content (legacy fallback)
    if (!reportabilityStatus || reportabilityStatus === "pending_review") {
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

    for (const stepId of [...completedPath]) {
      const step = stepMap[stepId];
      if (step?.post_completion_actions?.length > 0) {
        for (const action of step.post_completion_actions) {
          if (action.target_entity_type === "Account" && (!action.execution_timing || action.execution_timing === "after_step")) {
            let newValue = action.value;
            if (action.value_source === "from_step_answer") newValue = cleanedAnswers[action.value] || action.value;
            else if (action.value_source === "from_workflow_outcome" && action.value === "reportability_status") newValue = reportabilityStatus;
            if (action.field_to_update && newValue) classificationData[action.field_to_update] = newValue;
          }
        }
      }
    }

    if (finalNode?.post_completion_actions?.length > 0) {
      for (const action of finalNode.post_completion_actions) {
        if (action.target_entity_type === "Account" && (!action.execution_timing || action.execution_timing === "after_step")) {
          let newValue = action.value;
          if (action.value_source === "from_step_answer") newValue = cleanedAnswers[action.value] || action.value;
          else if (action.value_source === "from_workflow_outcome" && action.value === "reportability_status") newValue = reportabilityStatus;
          if (action.field_to_update && newValue) classificationData[action.field_to_update] = newValue;
        }
      }
    }

    if (fileUploadAnswer) {
      const currentAccount = latestAccountData || account;
      const existingDocuments = currentAccount.documents || [];
      classificationData.documents = [...existingDocuments, {
        id: `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        document_url: fileUploadAnswer.file_url,
        document_name: fileUploadAnswer.file_name,
        document_type: "self_certification",
        upload_date: fileUploadAnswer.upload_date || new Date().toISOString(),
        uploaded_by_email: user?.email || "Unknown",
        uploaded_by_name: user?.full_name || "Unknown User",
        notes: fileUploadAnswer.date_received ? `Uploaded via classification workflow - Date Received: ${fileUploadAnswer.date_received}` : "Uploaded via classification workflow"
      }];
      classificationData.self_certification_obtained = true;
      classificationData.self_certification_request_date = null;
      classificationData.self_certification_overdue = false;
    }

    if (selfCertRequestDate) {
      classificationData.self_certification_request_date = selfCertRequestDate;
      classificationData.self_certification_overdue = false;
    }

    const addressAnswer = Object.values(cleanedAnswers).find(ans => ans && typeof ans === 'object' && ans._address_config);
    if (addressAnswer) {
      const { _address_config, ...newAddress } = addressAnswer;
      const targetField = _address_config.target_field || "current_address";
      const currentAccount = latestAccountData || account;
      const previousAddress = currentAccount[targetField] || {};
      classificationData[targetField] = newAddress;
      if (_address_config.track_changes !== false) {
        try {
          await base44.entities.AuditLog.create({
            tenant_id: account.tenant_id, action_type: "account_updated",
            actor_email: user?.email || "unknown", actor_role: user?.user_role || "unknown",
            target_entity_type: "Account", target_entity_id: account.id,
            changes: { field: targetField, previous_value: previousAddress, new_value: newAddress },
            timestamp: new Date().toISOString()
          });
        } catch (e) {}
      }
    }

    const parallelTasks = [
      base44.entities.AccountClassificationHistory.create({
        tenant_id: account.tenant_id, account_id: account.id,
        classification_date: new Date().toISOString(),
        reportability_status: reportabilityStatus, classification_reason: reason,
        reportable_jurisdictions: [], workflow_answers: cleanedAnswers, indicia_found: [],
        self_certification_status: classificationData.self_certification_obtained ? "obtained" : "not_obtained",
        performed_by: user?.email || "unknown",
        account_holder_name: account.account_holder_name, account_number: account.account_number,
        account_balance: account.account_balance
      }).catch(() => {})
    ];

    if (account?.id && shouldRedirectToControllingPersons) {
      parallelTasks.push(
        base44.functions.invoke('syncAccountControllingPersons', { accountId: account.id }).catch(() => {})
      );
    }

    await Promise.all(parallelTasks);

    if (shouldRedirectToControllingPersons) {
      onComplete({ ...classificationData, _redirectToControllingPersons: true });
    } else {
      onComplete(classificationData);
    }
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
      const displayDate = dateValue ? (dateValue.includes('T') ? dateValue.split('T')[0] : dateValue) : '';

      return (
        <div className="space-y-3">
          <Input
            type="date"
            value={displayDate}
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
      const fileConfig = currentNode.file_upload_config || {};
      const requireDateReceived = fileConfig.require_date_received || false;

      const handleFileUpload = async (file) => {
        if (!file) return;

        setUploadingFile(true);
        try {
          const { file_url } = await base44.integrations.Core.UploadFile({ file });

          const uploadMetadata = {
            file_url,
            file_name: file.name,
            upload_date: new Date().toISOString(),
            uploaded_by: user?.email,
            date_received: dateReceivedValue || ""
          };

          setSelectedValue(uploadMetadata);
        } catch (error) {
      ("Error uploading file:", error);
          alert("Failed to upload file. Please try again.");
        } finally {
          setUploadingFile(false);
        }
      };

      const handleDrag = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
          setDragActive(true);
        } else if (e.type === "dragleave") {
          setDragActive(false);
        }
      };

      const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          handleFileUpload(e.dataTransfer.files[0]);
        }
      };

      const handleDateReceivedChange = (date) => {
        setDateReceivedValue(date);
        if (selectedValue && typeof selectedValue === 'object' && selectedValue.file_url) {
          setSelectedValue({
            ...selectedValue,
            date_received: date
          });
        }
      };

      return (
        <div className="space-y-4">
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-all ${
              dragActive
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
              onChange={(e) => handleFileUpload(e.target.files?.[0])}
              className="hidden"
              id="file-upload"
              accept=".pdf,.jpg,.jpeg,.png"
              disabled={uploadingFile}
            />

            {uploadingFile ? (
              <div className="space-y-2">
                <Loader2 className="w-12 h-12 mx-auto text-indigo-600 animate-spin" />
                <p className="text-sm font-medium text-slate-700">Uploading...</p>
              </div>
            ) : selectedValue?.file_url ? (
              <div className="space-y-4">
                <CheckCircle2 className="w-12 h-12 mx-auto text-green-600" />
                <p className="text-sm font-medium text-green-900">
                  {selectedValue.file_name}
                </p>
                <p className="text-xs text-green-700">Uploaded successfully</p>

                <div className="flex gap-3 justify-center">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setPreviewDocument(selectedValue);
                      setShowDocumentPreview(true);
                    }}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700"
                  >
                    <FileCheck className="w-4 h-4 mr-2" />
                    Preview Document
                  </Button>
                  <label
                    htmlFor="file-upload"
                    className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 cursor-pointer transition-colors"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Different File
                  </label>
                </div>
              </div>
            ) : (
              <>
                <Upload className={`w-12 h-12 mx-auto mb-4 ${dragActive ? 'text-indigo-600' : 'text-slate-400'}`} />
                <p className="text-sm font-medium text-slate-700 mb-2">
                  {dragActive ? 'Drop file here' : 'Drag and drop file here'}
                </p>
                <p className="text-xs text-slate-500 mb-4">or</p>
                <label
                  htmlFor="file-upload"
                  className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 cursor-pointer transition-colors"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Choose File
                </label>
                <p className="text-xs text-slate-500 mt-3">
                  PDF, JPG, or PNG (Max 10MB)
                </p>
              </>
            )}
          </div>

          {requireDateReceived && (
            <div className="mt-4">
              <Label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Date Received
                <span className="text-red-600">*</span>
              </Label>
              <Input
                type="date"
                value={dateReceivedValue}
                onChange={(e) => handleDateReceivedChange(e.target.value)}
                className="mt-1.5"
                placeholder="Select date received"
              />
            </div>
          )}
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

      const uploadedDocument = (() => {
        for (const [stepId, answerValue] of Object.entries(answers)) {
          const step = workflow.steps.find(s => s.step_id === stepId);
          if (step?.question_type === 'file_upload' && answerValue?.file_url) {
            return answerValue;
          }
        }
        return null;
      })();

      return (
        <div className="space-y-4">
          {uploadedDocument && (
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <FileCheck className="w-5 h-5 text-blue-600 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-blue-900">Self-Certification Document</p>
                      <p className="text-xs text-blue-700">{uploadedDocument.file_name}</p>
                      {uploadedDocument.date_received && (
                        <p className="text-xs text-blue-600 mt-1">
                          <Calendar className="w-3 h-3 inline mr-1" />
                          Received: {uploadedDocument.date_received}
                        </p>
                      )}
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setPreviewDocument(uploadedDocument);
                      setShowDocumentPreview(true);
                    }}
                    className="bg-white hover:bg-blue-100 text-blue-700 border-blue-300"
                  >
                    <FileCheck className="w-4 h-4 mr-2" />
                    Preview
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

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
              <Label htmlFor="address_street" className="text-sm font-medium text-slate-700">
                Street Address <span className="text-red-600">*</span>
              </Label>
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
                <Label htmlFor="address_city" className="text-sm font-medium text-slate-700">
                  City <span className="text-red-600">*</span>
                </Label>
                <Input
                  id="address_city"
                  value={addressValues.city}
                  onChange={(e) => setAddressValues({ ...addressValues, city: e.target.value })}
                  placeholder="City"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="address_state" className="text-sm font-medium text-slate-700">
                  State/Province <span className="text-red-600">*</span>
                </Label>
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
                <Label htmlFor="address_postal" className="text-sm font-medium text-slate-700">
                  Postal Code <span className="text-red-600">*</span>
                </Label>
                <Input
                  id="address_postal"
                  value={addressValues.postal_code}
                  onChange={(e) => setAddressValues({ ...addressValues, postal_code: e.target.value })}
                  placeholder="Postal Code"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="address_country" className="text-sm font-medium text-slate-700">
                  Country <span className="text-red-600">*</span>
                </Label>
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
      const existingAnswer = answers[currentNodeId];

      return (
        <BeneficiaryInputRenderer
          account={latestAccountData || account}
          tenant={null}
          initialBeneficiaries={existingAnswer?.draftBeneficiaries}
          savedBeneficiaries={existingAnswer?.savedBeneficiaries}
          onBeneficiariesChange={(beneficiaries) => {
            setAnswers(prev => ({
              ...prev,
              [currentNodeId]: {
                ...prev[currentNodeId],
                draftBeneficiaries: beneficiaries
              }
            }));
          }}
          onBeneficiariesAdded={async (savedBeneficiaries) => {
            setAnswers(prev => ({
              ...prev,
              [currentNodeId]: {
                savedBeneficiaries: savedBeneficiaries,
                draftBeneficiaries: savedBeneficiaries
              }
            }));
            
            // Update account beneficiaries count
            if (account?.id) {
              try {
                await base44.entities.Account.update(account.id, {
                  beneficiaries_count: savedBeneficiaries.length
                });
                refetchAccount();
              } catch (error) {
                console.error("Error updating beneficiaries count:", error);
              }
            }
          }}
        />
      );
    }

    if (currentNode.question_type === "controlling_person_input") {
      const existingAnswer = answers[currentNodeId];

      return (
        <ControllingPersonInputRenderer
          account={latestAccountData || account}
          initialPersons={existingAnswer?.draftPersons}
          savedPersons={existingAnswer?.savedPersons}
          onPersonsChange={(persons) => {
            setAnswers(prev => ({
              ...prev,
              [currentNodeId]: {
                ...prev[currentNodeId],
                draftPersons: persons
              }
            }));
          }}
          onControllingPersonsAdded={async (savedPersons) => {
            setAnswers(prev => ({
              ...prev,
              [currentNodeId]: {
                savedPersons: savedPersons,
                draftPersons: savedPersons
              }
            }));
            
            // Sync controlling persons count and classification status
            if (account?.id) {
              try {
                await base44.functions.invoke('syncAccountControllingPersons', { accountId: account.id });
                refetchAccount();
              } catch (error) {
                console.error("Error syncing controlling persons:", error);
              }
            }
          }}
        />
      );
    }

    return null;
  };

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

  if (showSummary) {
    const finalNode = stepMap[completedPath[completedPath.length - 1]];
    
    // Determine reportability for summary display - use same logic as completeClassification
    let summaryReportabilityStatus = "pending_review";
    
    let valueFoundInPriority1 = false;
    
    // PRIORITY 1: Post-completion actions
    if (finalNode?.post_completion_actions?.length > 0) {
      const statusAction = finalNode.post_completion_actions.find(action => action.field_to_update === "reportability_status");
      if (statusAction) {
        let extractedValue = null;
        if (statusAction.value_source === "static_value") {
          extractedValue = statusAction.value;
        } else if (statusAction.value_source === "from_step_answer") {
          extractedValue = answers[statusAction.value];
        }
        if (extractedValue) {
          summaryReportabilityStatus = extractedValue;
          valueFoundInPriority1 = true;
        }
      }
    }
    
    // PRIORITY 2: Explicit result_status
    if (!valueFoundInPriority1 && finalNode?.result_status) {
      summaryReportabilityStatus = finalNode.result_status;
    }
    
    // PRIORITY 3: Text-based inference
    if (summaryReportabilityStatus === "pending_review" && !valueFoundInPriority1) {
      if (finalNode?.step_title?.toLowerCase().includes("reportable") && !finalNode?.step_title?.toLowerCase().includes("non-reportable")) {
        summaryReportabilityStatus = "reportable";
      } else if (finalNode?.step_title?.toLowerCase().includes("non-reportable")) {
        summaryReportabilityStatus = "non_reportable";
      }
    }
    
    const isReportable = summaryReportabilityStatus === "reportable";
    const isPending = summaryReportabilityStatus === "pending_review";

    return (
      <div className="space-y-6">
        <div className="text-center">
          <div className={`w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center ${
            isReportable ? 'bg-amber-100' : isPending ? 'bg-blue-100' : 'bg-green-100'
          }`}>
            {isReportable ? (
              <AlertCircle className="w-10 h-10 text-amber-600" />
            ) : isPending ? (
              <Clock className="w-10 h-10 text-blue-600" />
            ) : (
              <CheckCircle2 className="w-10 h-10 text-green-600" />
            )}
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">{isPending ? 'Work In Progress' : 'Classification Complete'}</h2>
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
            : isPending
            ? 'bg-blue-50 border-blue-200'
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
                    : isPending
                    ? 'bg-blue-600 text-white'
                    : 'bg-green-600 text-white'
                }`}>
                  {isReportable ? 'Reportable' : isPending ? 'Pending Review' : 'Non-Reportable'}
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

                let answerLabel;
                if (typeof answer === 'string' && answer.includes(',') && step.question_type === 'multiple_choice') {
                  const selectedValues = answer.split(',').filter(Boolean);
                  const labels = selectedValues.map(v =>
                    step.options?.find(o => o.value === v)?.label || v
                  );
                  answerLabel = labels.join(', ');
                } else if (typeof answer === 'object' && answer !== null) {
                  if (answer.file_name) {
                    answerLabel = answer.date_received
                      ? `${answer.file_name} (Received: ${answer.date_received})`
                      : answer.file_name;
                  } else if (answer.controlling_persons_count !== undefined || answer.savedPersons) {
                    answerLabel = `${answer.savedPersons?.length || answer.controlling_persons_count || 0} controlling person(s) added`;
                  } else if (answer.beneficiaries_count !== undefined || answer.savedBeneficiaries) {
                    answerLabel = `${answer.savedBeneficiaries?.length || answer.beneficiaries_count || 0} beneficiary(ies) added`;
                  } else if (answer._address_config) {
                    const { _address_config, ...addr } = answer;
                    const parts = [addr.street, addr.city, addr.state, addr.postal_code, addr.country].filter(Boolean);
                    answerLabel = parts.join(', ') || 'Address entered';
                  } else {
                    const fieldValues = Object.entries(answer)
                      .filter(([k]) => !k.startsWith('_'))
                      .map(([k, v]) => v)
                      .filter(Boolean);
                    answerLabel = fieldValues.join(', ') || 'Data entered';
                  }
                } else {
                  answerLabel = step.options?.find(o => o.value === answer)?.label || String(answer || '');
                }

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
            onClick={() => setShowAIAssistant(true)}
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

      <Dialog open={showDocumentPreview} onOpenChange={setShowDocumentPreview}>
        <DialogContent className="max-w-5xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>{previewDocument?.file_name}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(previewDocument?.file_url, '_blank')}
              >
                Open in New Tab
              </Button>
            </DialogTitle>
          </DialogHeader>
          <div className="w-full h-[70vh]">
            {previewDocument?.file_name?.match(/\.(jpg|jpeg|png)$/i) ? (
              <img
                src={previewDocument.file_url}
                alt="Document preview"
                className="w-full h-full object-contain bg-slate-100"
              />
            ) : previewDocument?.file_name?.match(/\.pdf$/i) ? (
              <iframe
                src={previewDocument.file_url}
                className="w-full h-full border-0"
                title="PDF preview"
              />
            ) : (
              <div className="flex items-center justify-center h-full bg-slate-50">
                <p className="text-slate-500">Preview not available for this file type</p>
              </div>
            )}
          </div>
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
              {workflow.workflow_introduction_fields && workflow.workflow_introduction_fields.length > 0 && (latestAccountData || account) && (
                <div className="space-y-1 mt-2">
                  {workflow.workflow_introduction_fields.map((field, idx) => {
                    const accountData = latestAccountData || account;
                    const isComputedCondition = field.field_type === "computed_condition";

                    if (isComputedCondition) {
                      const value1 = Number(accountData[field.computation_field_1]) || 0;
                      const value2 = Number(accountData[field.computation_field_2]) || 0;

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
                      let fieldValue = accountData[field.field_name];

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

      {!workflow.display_workflow_introduction && (
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
      )}

      <div className="flex items-center gap-2 flex-wrap">
        {history.map((stepId, idx) => {
        const step = stepMap[stepId];

        return (
          <div key={stepId} className="flex items-center gap-2">
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
          </div>
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

                  let displayValue = '';
                  if (typeof value === 'string' && value.includes(',') && step.question_type === 'multiple_choice') {
                    const selectedValues = value.split(',').filter(Boolean);
                    const labels = selectedValues.map(v =>
                      step.options?.find(o => o.value === v)?.label || v
                    );
                    displayValue = labels.join(', ');
                  } else if (typeof value === 'object' && value !== null) {
                    if (value.file_name) {
                      displayValue = value.date_received
                        ? `${value.file_name} (Received: ${value.date_received})`
                        : value.file_name;
                    } else if (value._address_config) {
                      const { _address_config, ...addr } = value;
                      const parts = [addr.street, addr.city, addr.state, addr.postal_code, addr.country].filter(Boolean);
                      displayValue = parts.join(', ') || 'Address entered';
                    } else if (value.savedBeneficiaries) {
                      displayValue = `${value.savedBeneficiaries.length} beneficiary(ies) added`;
                    } else if (value.savedPersons) {
                      displayValue = `${value.savedPersons.length} controlling person(s) added`;
                    } else {
                      const fieldValues = Object.entries(value)
                        .filter(([k]) => !k.startsWith('_'))
                        .map(([k, v]) => v)
                        .filter(Boolean);
                      displayValue = fieldValues.join(', ') || 'Data entered';
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

      <AIWorkflowHelper
        currentStep={currentNode}
        workflow={workflow}
        answers={answers}
        accountData={latestAccountData || account}
        onSuggestedAnswer={(value) => setSelectedValue(value)}
      />

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
            !(currentNode.question_type === "address_input" && addressValues.street && addressValues.city &&
              addressValues.state && addressValues.postal_code && addressValues.country) &&
            !(currentNode.question_type === "beneficiary_input" && answers[currentNodeId]?.savedBeneficiaries?.length > 0) &&
            !(currentNode.question_type === "controlling_person_input" && answers[currentNodeId]?.savedPersons?.length > 0) &&
            !(currentNode.question_type === "file_upload" && selectedValue?.file_url && (!currentNode.file_upload_config?.require_date_received || dateReceivedValue))
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