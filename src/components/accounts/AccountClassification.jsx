import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, ArrowRight, ArrowLeft, Info, FileCheck, Loader2, AlertCircle, Users, Check, Circle, Upload, GitBranch, Brain, Sparkles, Calendar } from "lucide-react";
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
      console.log('[ACCOUNT UPDATE EVENT] Received:', event.detail);
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
    console.log('\n🔍 [TRIGGER EVALUATION] Starting...');
    console.log('  Trigger Config:', triggerConfig);
    console.log('  Account Data:', accountData);
    console.log('  Entity Data:', entityData);
    
    if (!triggerConfig?.enabled) {
      console.log('  ❌ Trigger not enabled');
      return false;
    }

    const conditions = triggerConfig.conditions || [];
    const computedConditions = triggerConfig.computed_conditions || [];

    if (conditions.length === 0 && computedConditions.length === 0) {
      console.log('  ✅ No conditions - auto-match');
      return true;
    }

    const getFieldValue = (fieldPath) => {
      if (!fieldPath) return null;

      console.log(`    🔎 Getting field value for: "${fieldPath}"`);

      if (fieldPath.includes('.')) {
        const parts = fieldPath.split('.');
        let value = accountData;
        for (const part of parts) {
          value = value?.[part];
          if (value === undefined) return null;
        }
        console.log(`      → Account nested field value: "${value}"`);
        return value;
      }

      // Check account data first
      if (accountData?.[fieldPath] !== undefined) {
        console.log(`      → Account field value: "${accountData[fieldPath]}"`);
        return accountData[fieldPath];
      }

      // Check entity data for entity-specific fields
      if (entityData?.[fieldPath] !== undefined) {
        console.log(`      → Entity field value: "${entityData[fieldPath]}"`);
        return entityData[fieldPath];
      }

      console.log(`      → Field not found in account or entity`);
      return null;
    };

    let result = true;

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
        console.error("Error evaluating computed condition:", error);
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
      console.log('\n🔵🔵🔵 [WORKFLOW SELECTION] Starting workflow selection...');
      console.log('  Available workflows:', workflows.map(w => w.workflow_name));
      console.log('  Account holder type:', account?.account_holder_type);
      console.log('  Linked Entity:', linkedEntity);
      
      const matchingWorkflows = workflows.filter(w => {
        console.log(`\n  📋 Evaluating workflow: "${w.workflow_name}"`);
        if (w.trigger_conditions?.enabled) {
          const matches = evaluateTriggerConditions(w.trigger_conditions, account, linkedEntity);
          console.log(`    Result: ${matches ? '✅ MATCHES' : '❌ NO MATCH'}`);
          return matches;
        }
        console.log(`    ⏭️ No trigger conditions`);
        return false;
      });

      let selectedWorkflow = null;

      if (matchingWorkflows.length > 0) {
        console.log(`\n  ✅ Found ${matchingWorkflows.length} matching workflow(s):`, matchingWorkflows.map(w => w.workflow_name));
        const sortedWorkflows = matchingWorkflows.sort((a, b) => {
          const priorityA = a.trigger_conditions?.priority || 0;
          const priorityB = b.trigger_conditions?.priority || 0;
          if (priorityB !== priorityA) return priorityB - priorityA;
          return parseFloat(b.version || "1.0") - parseFloat(a.version || "1.0");
        });
        selectedWorkflow = sortedWorkflows[0];
        console.log(`  🎯 Selected workflow by trigger: "${selectedWorkflow.workflow_name}" (priority: ${selectedWorkflow.trigger_conditions?.priority || 0})`);
      } else {
        console.log(`\n  ⚠️ No workflows matched triggers - using fallback name matching`);
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
        console.log(`\n  🏁 FINAL SELECTION: "${selectedWorkflow.workflow_name}"`);
        setWorkflow(selectedWorkflow);
        if (selectedWorkflow.steps && selectedWorkflow.steps.length > 0) {
          setCurrentNodeId(selectedWorkflow.steps[0].step_id);
        }
      } else {
        console.log(`\n  ❌ No workflow selected`);
      }
    }
  }, [workflows, workflow, account, linkedEntity]);

  useEffect(() => {
    if (!currentNodeId) return;

    const currentNode = stepMap[currentNodeId];
    const existingAnswer = answers[currentNodeId];

    console.log(`[AccountClassification] Current step changed to: ${currentNode?.step_title}`);
    console.log(`[AccountClassification] Existing answer for this step:`, existingAnswer);

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
      console.log('[PREFILL] Using account data:', currentAccount);

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
          console.log(`[PREFILL] Step "${step.step_title}": field=${fieldName}, value="${fieldValue}"`);

          if (fieldValue !== undefined && fieldValue !== null && fieldValue !== "") {
            if (step.question_type === 'yes_no' && step.mapped_field.prefill_config) {
              const prefillType = step.mapped_field.prefill_config.prefill_type;

              if (prefillType === 'country_crs') {
                const normalizedCountry = String(fieldValue).toLowerCase();
                const countryInfo = crsCountryMap[normalizedCountry];
                if (countryInfo) {
                  preFillAnswers[step.step_id] = countryInfo.isCrs ? 'YES' : 'NO';
                  console.log(`[PREFILL] country_crs: ${fieldValue} -> ${countryInfo.isCrs ? 'YES' : 'NO'}`);
                }
              } else if (prefillType === 'enum_match') {
                const matchValues = step.mapped_field.prefill_config.match_values || [];
                const isMatch = matchValues.includes(String(fieldValue));
                preFillAnswers[step.step_id] = isMatch ? 'YES' : 'NO';
                console.log(`[PREFILL] enum_match: fieldValue="${fieldValue}", matchValues=${JSON.stringify(matchValues)}, isMatch=${isMatch} -> ${isMatch ? 'YES' : 'NO'}`);
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
          
          console.log(`\n========== [PREFILL - ENTITY] DETAILED DEBUG ==========`);
          console.log(`Step Title: "${step.step_title}"`);
          console.log(`Step ID: "${step.step_id}"`);
          console.log(`Question Type: "${step.question_type}"`);
          console.log(`Mapped Field Name: "${fieldName}"`);
          console.log(`Entity Field Value (raw): "${fieldValue}" (type: ${typeof fieldValue})`);
          console.log(`Entity full data:`, linkedEntity);
          console.log(`Available dropdown options:`, step.options);

          if (fieldValue !== undefined && fieldValue !== null && fieldValue !== "") {
            if (step.question_type === 'yes_no' && typeof fieldValue === 'boolean') {
              preFillAnswers[step.step_id] = fieldValue ? 'YES' : 'NO';
              console.log(`[PREFILL - ENTITY] Boolean -> Yes/No: ${fieldValue} -> ${fieldValue ? 'YES' : 'NO'}`);
            } else if (step.question_type === 'single_choice') {
              // Pre-fill dropdown - try matching by VALUE first, then by LABEL (case-insensitive)
              const stringValue = String(fieldValue);
              
              console.log(`[PREFILL - ENTITY] Single choice dropdown:`);
              console.log(`  Value to pre-fill: "${stringValue}"`);
              console.log(`  Checking against dropdown options:`);
              
              // First try exact value match
              let matchingOption = step.options?.find(opt => opt.value === stringValue);
              
              // If no value match, try case-insensitive label match
              if (!matchingOption) {
                matchingOption = step.options?.find(opt => 
                  opt.label?.toLowerCase() === stringValue.toLowerCase()
                );
              }
              
              step.options?.forEach(opt => {
                const valueMatches = opt.value === stringValue;
                const labelMatches = opt.label?.toLowerCase() === stringValue.toLowerCase();
                console.log(`    Option: value="${opt.value}", label="${opt.label}", valueMatch=${valueMatches}, labelMatch=${labelMatches}`);
              });
              
              if (matchingOption) {
                preFillAnswers[step.step_id] = matchingOption.value;
                console.log(`  ✅ MATCH FOUND: Using option "${matchingOption.label}" (value: ${matchingOption.value})`);
              } else {
                console.log(`  ⚠️ NO MATCH FOUND! Entity value "${stringValue}" does not match any dropdown option values or labels`);
                console.log(`  Available options:`, step.options?.map(o => `${o.value}="${o.label}"`));
              }
            } else if (step.question_type === 'date_input') {
              preFillAnswers[step.step_id] = String(fieldValue);
            } else if (step.question_type === 'number_input') {
              preFillAnswers[step.step_id] = String(fieldValue);
            } else {
              preFillAnswers[step.step_id] = String(fieldValue);
            }
          } else {
            console.log(`  ⚠️ Field value is empty/null/undefined - NOT pre-filling`);
          }
          console.log(`========== END DETAILED DEBUG ==========\n`);
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

      console.log('[PREFILL] Final pre-fill answers:', preFillAnswers);
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

  const executePostCompletionActions = async (actions, currentAnswers) => {
    if (!actions || actions.length === 0) return;

    for (const action of actions) {
      try {
        console.log(`[POST-COMPLETION ACTION] Executing action:`, action);

        if (action.target_entity_type !== "Account" || !account?.id) {
          console.warn(`[POST-COMPLETION ACTION] Unsupported target or no account ID:`, action.target_entity_type);
          continue;
        }

        let valueToUpdate = null;

        if (action.value_source === "static_value") {
          valueToUpdate = action.value;
        } else if (action.value_source === "from_step_answer") {
          const sourceStepId = action.value;
          valueToUpdate = currentAnswers[sourceStepId];

          if (valueToUpdate === 'YES') valueToUpdate = true;
          if (valueToUpdate === 'NO') valueToUpdate = false;
        } else if (action.value_source === "from_workflow_outcome") {
          console.warn(`[POST-COMPLETION ACTION] from_workflow_outcome not available mid-workflow`);
          continue;
        }

        if (action.condition) {
          const conditionField = action.condition.field;
          const conditionOperator = action.condition.operator;
          const conditionValue = action.condition.value;

          const fieldValue = currentAnswers[conditionField];

          let conditionMet = false;
          switch (conditionOperator) {
            case '=':
              conditionMet = String(fieldValue || '').toLowerCase() === String(conditionValue || '').toLowerCase();
              break;
            case '!=':
              conditionMet = String(fieldValue || '').toLowerCase() !== String(conditionValue || '').toLowerCase();
              break;
            case 'contains':
              conditionMet = String(fieldValue || '').toLowerCase().includes(String(conditionValue || '').toLowerCase());
              break;
            case 'in':
              conditionMet = String(conditionValue).split(',').map(v => v.trim().toLowerCase()).includes(String(fieldValue || '').toLowerCase());
              break;
            case 'not_in':
              conditionMet = !String(conditionValue).split(',').map(v => v.trim().toLowerCase()).includes(String(fieldValue || '').toLowerCase());
              break;
            default:
              conditionMet = false;
          }

          console.log(`[POST-COMPLETION ACTION] Condition check: ${conditionField} ${conditionOperator} ${conditionValue} = ${conditionMet}`);

          if (!conditionMet) {
            console.log(`[POST-COMPLETION ACTION] Condition not met, skipping action`);
            continue;
          }
        }

        const fieldToUpdate = action.field_to_update;
        const updateData = { [fieldToUpdate]: valueToUpdate };

        console.log(`[POST-COMPLETION ACTION] Updating Account.${fieldToUpdate} = "${valueToUpdate}"`);
        console.log(`[POST-COMPLETION ACTION] Update data:`, updateData);

        await base44.entities.Account.update(account.id, updateData);

        console.log(`[POST-COMPLETION ACTION] Successfully updated Account field: ${fieldToUpdate}`);

        window.dispatchEvent(new CustomEvent('account-updated', { detail: { accountId: account.id, field: fieldToUpdate, value: valueToUpdate } }));
      } catch (error) {
        console.error(`[POST-COMPLETION ACTION] Error executing action:`, error);
        console.error(`[POST-COMPLETION ACTION] Error details:`, error.message);
      }
    }
  };

  const evaluateConditionalLogic = (logic, currentAnswers) => {
    console.log('\n🟢🟢🟢 ========== EVALUATING CONDITIONAL LOGIC (AccountClassification) ========== 🟢🟢🟢');
    console.log('📜 Full Logic Object:', JSON.stringify(logic, null, 2));
    console.log('🔢 Has condition_groups:', !!logic?.condition_groups?.length);
    console.log('🔢 Number of condition_groups:', logic?.condition_groups?.length || 0);
    console.log('📊 Current Answers Being Evaluated:', JSON.stringify(currentAnswers, null, 2));

    const getFieldValue = (fieldPath, entityData = null) => {
      if (fieldPath.includes('.')) {
        const parts = fieldPath.split('.');
        const stepAnswer = currentAnswers[parts[0]];
        if (stepAnswer && typeof stepAnswer === 'object') {
          return stepAnswer[parts[1]];
        }
        if (parts[0] === 'account_holder_address' || parts[0] === 'current_address') {
          return account?.[parts[0]]?.[parts[1]];
        }
        if (entityData && parts[0] === 'entity') {
          return entityData[parts[1]];
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

      if (entityData?.[fieldPath] !== undefined) {
        return entityData[fieldPath];
      }

      return null;
    };

    const evaluateSingleCondition = (condition) => {
      let fieldValue = getFieldValue(condition.field, linkedEntity);
      let comparisonValue = condition.value;
      if (condition.value_type === 'field_reference') {
        comparisonValue = getFieldValue(condition.value, linkedEntity);
      }

      const normalizeBoolean = (val) => {
        if (val === 'YES') return 'true';
        if (val === 'NO') return 'false';
        if (val === true) return 'true';
        if (val === false) return 'false';
        return val;
      };

      const originalFieldValue = fieldValue;
      const originalComparisonValue = comparisonValue;

      fieldValue = normalizeBoolean(fieldValue);
      comparisonValue = normalizeBoolean(comparisonValue);

      console.log(`  🔍 Condition: field="${condition.field}", operator="${condition.operator}", value="${condition.value}", value_type="${condition.value_type}"`);
      console.log(`  📊 Original field value:`, originalFieldValue, `→ Normalized:`, fieldValue);
      console.log(`  📊 Original comparison value:`, originalComparisonValue, `→ Normalized:`, comparisonValue);

      let conditionMet = false;

      const normalizeCountryForComparison = (val) => {
        if (!val) return '';
        const valLower = String(val).toLowerCase();
        const countryInfo = crsCountryMap[valLower];
        if (countryInfo?.code) {
          return countryInfo.code.toLowerCase();
        }
        return valLower;
      };

      const isCountryComparison = (
        condition.field?.toLowerCase().includes('country') ||
        condition.value?.toLowerCase().includes('country')
      );

      switch (condition.operator) {
        case "=":
          if (isCountryComparison) {
            conditionMet = normalizeCountryForComparison(fieldValue) === normalizeCountryForComparison(comparisonValue);
          } else {
            conditionMet = String(fieldValue || '').toLowerCase() === String(comparisonValue || '').toLowerCase();
          }
          break;
        case "!=":
          if (isCountryComparison) {
            conditionMet = normalizeCountryForComparison(fieldValue) !== normalizeCountryForComparison(comparisonValue);
          } else {
            conditionMet = String(fieldValue || '').toLowerCase() !== String(comparisonValue || '').toLowerCase();
          }
          break;
        case "in":
          const inValues = String(comparisonValue).split(",").map(v => v.trim().toLowerCase());
          conditionMet = inValues.includes(String(fieldValue || '').toLowerCase());
          break;
        case "not_in":
          const notInValues = String(comparisonValue).split(",").map(v => v.trim().toLowerCase());
          conditionMet = !notInValues.includes(String(fieldValue || '').toLowerCase());
          break;
        case "contains":
          conditionMet = String(fieldValue || '').toLowerCase().includes(String(comparisonValue || '').toLowerCase());
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
          const countryLookup = crsCountryMap[String(fieldValue || '').toLowerCase()];
          conditionMet = countryLookup?.isCrs === true;
          break;
        case "is_not_crs":
          const countryLookupNot = crsCountryMap[String(fieldValue || '').toLowerCase()];
          conditionMet = countryLookupNot?.isCrs === false;
          break;
        default:
          conditionMet = false;
      }

      console.log(`  >>> Condition Result: ${conditionMet}`);
      return conditionMet;
    };

    if (logic?.condition_groups && logic.condition_groups.length > 0) {
      console.log('\n🟣🟣🟣 EVALUATING CONDITION GROUPS 🟣🟣🟣');
      console.log(`📊 Total groups: ${logic.condition_groups.length}`);
      console.log(`🔗 Overall operator: ${logic.overall_logic_operator}`);
      console.log(`✅ Overall TRUE step: ${logic.overall_true_step}`);
      console.log(`❌ Overall FALSE step: ${logic.overall_false_step}`);

      const groupResults = [];

      for (let i = 0; i < logic.condition_groups.length; i++) {
        const group = logic.condition_groups[i];
        console.log(`\n  GROUP ${i + 1}: ${group.group_name}`);
        console.log(`  Group operator: ${group.group_operator}`);
        console.log(`  Conditions in group: ${group.conditions?.length || 0}`);

        if (!group.conditions || group.conditions.length === 0) {
          console.log(`  WARNING: Group has no conditions, treating as FALSE`);
          groupResults.push({ group, result: false });
          continue;
        }

        let groupResult = group.group_operator === 'AND' ? true : false;

        for (let j = 0; j < group.conditions.length; j++) {
          const condition = group.conditions[j];
          const conditionMet = evaluateSingleCondition(condition);

          if (group.group_operator === 'AND') {
            groupResult = groupResult && conditionMet;
            if (!groupResult) break;
          } else {
            groupResult = groupResult || conditionMet;
            if (groupResult) break;
          }
        }

        console.log(`  >>> Group ${i + 1} result: ${groupResult}`);
        groupResults.push({ group, result: groupResult });
      }

      console.log(`\n--- FIRST MATCH WINS LOGIC ---`);
      for (let i = 0; i < groupResults.length; i++) {
        const { group, result } = groupResults[i];
        console.log(`  Checking Group ${i + 1} (${group.group_name}): ${result ? 'TRUE ✅' : 'FALSE ❌'}`);

        if (result === true) {
          console.log(`  🎯 FIRST MATCH FOUND! Using Group ${i + 1}'s TRUE path`);
          console.log(`  >>> RETURNING STEP: ${group.true_step}`);
          console.log('========== END CONDITIONAL LOGIC ==========\n');
          return group.true_step;
        }
      }

      console.log(`  ⚠️ NO GROUPS MATCHED`);
      const fallbackStep = logic.overall_false_step ||
                           groupResults[groupResults.length - 1]?.group.false_step ||
                           groupResults[0]?.group.false_step;
      console.log(`  >>> RETURNING FALLBACK STEP: ${fallbackStep}`);
      console.log('========== END CONDITIONAL LOGIC ==========\n');
      return fallbackStep;
    }

    console.log('\n--- EVALUATING LEGACY CONDITIONS ---');
    if (!logic?.conditions || logic.conditions.length === 0) {
      console.log('No conditions found, returning false');
      return false;
    }

    if (logic.trigger_field && logic.trigger_value) {
      const triggerAnswer = currentAnswers[logic.trigger_field];
      if (String(triggerAnswer) !== String(logic.trigger_value)) {
        console.log('Trigger condition not met, returning false');
        return false;
      }
    }

    let result = true;

    logic.conditions.forEach((condition, idx) => {
      const conditionMet = evaluateSingleCondition(condition);

      if (idx === 0) {
        result = conditionMet;
      } else {
        const prevLogicOp = logic.conditions[idx - 1]?.logic_operator || "AND";
        console.log(`Combining with previous result using ${prevLogicOp}: ${result} ${prevLogicOp} ${conditionMet}`);
        if (prevLogicOp === "AND") {
          result = result && conditionMet;
        } else if (prevLogicOp === "OR") {
          result = result || conditionMet;
        }
      }
    });

    console.log(`Final conditional logic result:`, result);
    console.log('========== END CONDITIONAL LOGIC ==========\n');
    return result;
  };

  const stepMap = {};
  if (workflow?.steps) {
    workflow.steps.forEach(step => {
      stepMap[step.step_id] = step;
    });
  }

  const isActionNode = (step) => {
    if (!step) return false;

    console.log(`\n🔍 [isActionNode] Checking step: "${step.step_title}"`);
    console.log(`   Question Type: ${step.question_type}`);
    console.log(`   Has conditional_logic:`, !!step.conditional_logic);
    console.log(`   Full conditional_logic:`, JSON.stringify(step.conditional_logic, null, 2));

    const inputTypes = ["text_input", "number_input", "date_input", "file_upload", "multi_field_input", "address_input", "beneficiary_input", "controlling_person_input"];
    if (inputTypes.includes(step.question_type)) {
      console.log(`   ✓ Is input type: ${step.question_type}`);
      if (step.default_next_step) {
        console.log(`   ✓ Has default_next_step: ${step.default_next_step} → NOT action node`);
        return false;
      }
      if (step.question_type === "text_input") {
        console.log(`   ✓ Is text_input without default_next_step → IS action node`);
        return true;
      }
      console.log(`   ✓ Is input type without default_next_step → NOT action node`);
      return false;
    }

    if (step.question_type === "multiple_choice" && step.conditional_logic?.option_values?.length > 0) {
      console.log(`   ✓ Multiple choice with option_values branching`);
      console.log(`     option_values:`, step.conditional_logic.option_values);
      console.log(`     option_values_next_step:`, step.conditional_logic.option_values_next_step);
      console.log(`     option_values_else_step:`, step.conditional_logic.option_values_else_step);
      if (step.conditional_logic.option_values_next_step || step.conditional_logic.option_values_else_step) {
        console.log(`   → Has option-based branching paths → NOT action node`);
        return false;
      }
    }

    if (step.question_type === "multiple_choice") {
      console.log(`   ✓ Checking multiple choice selection count branching`);
      console.log(`     selection_count_operator:`, step.conditional_logic?.selection_count_operator);
      console.log(`     selection_count_value:`, step.conditional_logic?.selection_count_value);
      console.log(`     selection_count_next_step:`, step.conditional_logic?.selection_count_next_step);
      console.log(`     selection_count_else_step:`, step.conditional_logic?.selection_count_else_step);
      if (step.conditional_logic?.selection_count_next_step || step.conditional_logic?.selection_count_else_step) {
        console.log(`   → Has selection count branching paths → NOT action node`);
        return false;
      }
    }

    if (step.conditional_logic?.condition_groups?.length > 0) {
      console.log(`   ✓ Has condition_groups (${step.conditional_logic.condition_groups.length} groups) → NOT action node`);
      return false;
    }

    if (step.conditional_logic?.conditions?.length > 0) {
      console.log(`   ✓ Has legacy conditions (${step.conditional_logic.conditions.length} conditions)`);
      if (step.conditional_logic.next_step || step.conditional_logic.else_step) {
        console.log(`   → Has conditional logic paths → NOT action node`);
        return false;
      }
    }

    console.log(`   Checking options: ${step.options?.length || 0} options`);
    if (!step.options || step.options.length === 0) {
      console.log(`   → No options → IS action node`);
      return true;
    }

    const hasOptionNextSteps = step.options.some(opt => opt.next_step);
    console.log(`   Options have next_step:`, hasOptionNextSteps);
    console.log(`   → Final result: ${!hasOptionNextSteps ? 'IS action node' : 'NOT action node'}`);
    return !hasOptionNextSteps;
  };

  const handleNext = async () => {
    console.log('\n\n🔵🔵🔵 ========== ACCOUNT CLASSIFICATION - HANDLE NEXT ========== 🔵🔵🔵');
    console.log(`📍 Current Node ID: ${currentNodeId}`);
    const currentNode = stepMap[currentNodeId];
    if (!currentNode) {
      console.error('❌ Current node not found!');
      return;
    }

    console.log(`📋 Step Title: ${currentNode.step_title}`);
    console.log(`❓ Question Type: ${currentNode.question_type}`);
    console.log(`📊 Selected Value:`, selectedValue);
    console.log(`📦 All Answers (before update):`, answers);

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
      console.log('\n📝 MULTI-FIELD INPUT VALIDATION:');
      console.log('  Multi-field values:', multiFieldValues);
      console.log('  Multi-field definitions:', currentNode.multi_fields);

      const errors = {};
      const multiFields = currentNode.multi_fields || [];

      multiFields.forEach(field => {
        let isFieldVisible = true;
        if (field.conditional_visibility) {
          const condVis = field.conditional_visibility;
          const dependsOnValue = multiFieldValues[condVis.depends_on_field];
          isFieldVisible = String(dependsOnValue) === String(condVis.required_value);
          console.log(`  Field "${field.field_id}" conditional_visibility: depends_on="${condVis.depends_on_field}", required_value="${condVis.required_value}", current_value="${dependsOnValue}", visible=${isFieldVisible}`);
        }

        if (!isFieldVisible) {
          console.log(`  Field "${field.field_id}" is hidden by conditional_visibility, skipping validation ⏭️`);
          return;
        }

        let isFieldRequired = field.is_required;

        if (field.conditional_required) {
          const condReq = field.conditional_required;
          const dependsOnValue = multiFieldValues[condReq.depends_on_field];

          console.log(`  Field "${field.field_id}" has conditional_required: depends_on="${condReq.depends_on_field}", required_value="${condReq.required_value}", current_value=`, dependsOnValue);

          isFieldRequired = String(dependsOnValue) === String(condReq.required_value);
          console.log(`  Conditional required evaluation: ${isFieldRequired}`);
        }

        console.log(`  Checking field "${field.field_id}" (${field.display_label}): visible=${isFieldVisible}, required=${isFieldRequired}, value=`, multiFieldValues[field.field_id]);

        if (isFieldRequired && !multiFieldValues[field.field_id]) {
          errors[field.field_id] = `${field.display_label} is required`;
          console.log(`    ❌ Required field missing!`);
        } else {
          console.log(`    ✅ Field OK`);
        }
      });

      console.log('  Validation errors:', errors);

      if (Object.keys(errors).length > 0) {
        console.log('  ❌ Validation failed, setting errors and returning');
        setMultiFieldErrors(errors);
        return;
      }

      console.log('  ✅ Validation passed');
      setMultiFieldErrors({});
      newAnswers[currentNodeId] = multiFieldValues;
      console.log('  Saved multi-field values to answers:', multiFieldValues);
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
    console.log(`✅ Answers updated:`, newAnswers);

    if (currentNode.post_completion_actions && currentNode.post_completion_actions.length > 0) {
      const afterStepActions = currentNode.post_completion_actions.filter(
        action => (action.execution_timing || "after_step") === "after_step"
      );
      if (afterStepActions.length > 0) {
        console.log(`[POST-COMPLETION ACTIONS] Executing ${afterStepActions.length} "after_step" action(s) for step: ${currentNode.step_title}`);
        await executePostCompletionActions(afterStepActions, newAnswers);
      }
    }

    const newHistory = history.includes(currentNodeId)
      ? history
      : [...history, currentNodeId];
    setHistory(newHistory);
    console.log(`📚 History updated:`, newHistory);

    console.log('\n🔀 ========== DETERMINING NEXT STEP ========== 🔀');
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

    // Multi-choice routing groups - advanced branching for multiple choice questions
    if (!nextNodeId && currentNode.question_type === "multiple_choice" &&
        currentNode.conditional_logic?.multi_choice_routing_groups?.length > 0) {
      console.log('🔀 [MULTI-CHOICE ROUTING GROUPS]');
      const selectedOptions = selectedValue ? selectedValue.split(',').filter(Boolean) : [];
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
            conditionMet = evaluateSingleCondition(condition);
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

    if (!nextNodeId && currentNode.question_type === "multiple_choice") {
      if (currentNode.conditional_logic?.selection_count_next_step || currentNode.conditional_logic?.selection_count_else_step) {
        console.log('🔢 [COUNT-BASED BRANCHING] Detected selection count configuration');
        const selectedOptions = selectedValue ? selectedValue.split(',').filter(Boolean) : [];
        const selectionCount = selectedOptions.length;
        const countOperator = currentNode.conditional_logic.selection_count_operator || "=";
        const countValue = currentNode.conditional_logic.selection_count_value || 0;

        console.log(`   Selection count: ${selectionCount}, operator: ${countOperator}, target: ${countValue}`);

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

        console.log(`   Condition met: ${countConditionMet}`);

        if (countConditionMet) {
          nextNodeId = currentNode.conditional_logic.selection_count_next_step;
          console.log(`   → Going to TRUE path: ${nextNodeId}`);
        } else {
          nextNodeId = currentNode.conditional_logic.selection_count_else_step;
          console.log(`   → Going to FALSE path: ${nextNodeId}`);
        }
      }
    }

    if (!nextNodeId && (currentNode.conditional_logic?.condition_groups?.length > 0 || currentNode.conditional_logic?.conditions?.length > 0)) {
      console.log('\n🔍🔍🔍 CHECKING CONDITIONAL LOGIC for step:', currentNodeId);
      const logic = currentNode.conditional_logic;
      console.log('📜 Full Conditional Logic Config:', JSON.stringify(logic, null, 2));
      console.log('🎯 Has condition_groups:', !!logic.condition_groups?.length);
      console.log('🎯 Number of condition_groups:', logic.condition_groups?.length || 0);
      console.log('🎯 Has legacy conditions:', !!logic.conditions?.length);
      console.log('🎯 Trigger Field:', logic.trigger_field);
      console.log('🎯 Trigger Value:', logic.trigger_value);

      let shouldEvaluateAdvancedLogic = true;
      if (logic.trigger_field && logic.trigger_value) {
        console.log('\n⚡ TRIGGER EVALUATION:');
        const currentAnswer = newAnswers[currentNodeId];
        const triggerAnswer = newAnswers[logic.trigger_field];
        shouldEvaluateAdvancedLogic = String(currentAnswer) === String(logic.trigger_value);

        console.log(`  🔑 Trigger Field: "${logic.trigger_field}"`);
        console.log(`  🎯 Expected Trigger Value: "${logic.trigger_value}"`);
        console.log(`  💬 Current Step Answer: "${currentAnswer}"`);
        console.log(`  💬 Trigger Field Answer: "${triggerAnswer}"`);
        console.log(`  ✅ Should Evaluate Advanced Logic: ${shouldEvaluateAdvancedLogic}`);

        if (!shouldEvaluateAdvancedLogic) {
          console.log(`  ⚠️ TRIGGER NOT MET - skipping advanced conditional logic`);
        }
      } else {
        console.log('ℹ️ No trigger defined - will evaluate conditional logic');
      }

      if (shouldEvaluateAdvancedLogic) {
        if (logic.condition_groups?.length > 0) {
          console.log('\n✨✨✨ USING CONDITION GROUPS LOGIC (first match wins)');
          nextNodeId = evaluateConditionalLogic(logic, newAnswers);
          console.log(`✅✅✅ Condition groups returned next step ID: "${nextNodeId}"`);

          if (nextNodeId) {
            const nextStep = stepMap[nextNodeId];
            console.log(`  📌 Next Step Title: "${nextStep?.step_title || 'NOT FOUND'}"`);
            if (!nextStep) {
              console.error(`  ❌❌❌ CRITICAL: Next step "${nextNodeId}" NOT FOUND in stepMap!`);
            }
          } else {
            console.warn(`  ⚠️ Condition groups returned null/undefined next step`);
          }
        }
        else if (logic.conditions?.length > 0) {
          console.log('\n📋 Using LEGACY simple conditions logic');
          const conditionMet = evaluateConditionalLogic(logic, newAnswers);
          console.log(`  Condition Met: ${conditionMet}`);
          if (conditionMet) {
            nextNodeId = logic.next_step;
            console.log(`  ➡️ Going to next_step: ${nextNodeId}`);
          } else {
            nextNodeId = logic.else_step;
            console.log(`  ➡️ Going to else_step: ${nextNodeId}`);
          }
        }
      } else {
        console.log('⏭️⏭️⏭️ Trigger not met, skipping conditional logic entirely');
      }
    }

    console.log('\n🔸 Fallback Navigation Checks:');
    if (!nextNodeId && selectedValue && currentNode.options && currentNode.options.length > 0) {
      console.log('  📋 Checking option-based next_step...');
      const selectedOption = currentNode.options.find(opt =>
        opt.value === selectedValue || opt.label === selectedValue
      );
      console.log(`  Selected Option:`, selectedOption);
      if (selectedOption?.next_step) {
        nextNodeId = selectedOption.next_step;
        console.log(`  ✅ Found next_step from option: ${nextNodeId}`);
      } else {
        console.log(`  ⚠️ Selected option has no next_step`);
      }
    }

    if (!nextNodeId && currentNode.default_next_step) {
      console.log(`  📋 Using default_next_step: ${currentNode.default_next_step}`);
      nextNodeId = currentNode.default_next_step;
    }

    console.log(`\n🎯 FINAL NEXT NODE ID: "${nextNodeId}"`);

    if (nextNodeId && !stepMap[nextNodeId]) {
      console.error(`❌❌❌ CRITICAL ERROR: Next step "${nextNodeId}" not found in workflow stepMap!`);
      console.log('Available step IDs in workflow:', Object.keys(stepMap));
      console.warn(`Next step "${nextNodeId}" not found in workflow, showing summary`);
      nextNodeId = null;
    } else if (nextNodeId) {
      const nextStep = stepMap[nextNodeId];
      console.log(`✅ Next step validated - Title: "${nextStep.step_title}"`);
    }

    if (!nextNodeId && (currentNode.question_type === "controlling_person_input" || currentNode.question_type === "beneficiary_input")) {
      if (currentNode.default_next_step && stepMap[currentNode.default_next_step]) {
        console.log(`  Using default_next_step for ${currentNode.question_type}: ${currentNode.default_next_step}`);
        nextNodeId = currentNode.default_next_step;
      }
    }

    const uniquePath = [...new Set([...newHistory, currentNodeId])];

    console.log(`\n🏁 FINAL DECISION:`);
    console.log(`  Next Node ID: ${nextNodeId}`);
    console.log(`  Is Action Node: ${isActionNode(currentNode)}`);

    if (!nextNodeId || isActionNode(currentNode)) {
      console.log(`  🏁 Ending workflow - showing summary`);
      console.log(`  Completed Path:`, uniquePath);
      setCompletedPath(uniquePath);
      setShowSummary(true);
      console.log('🔵🔵🔵 ========== END HANDLE NEXT (SUMMARY) ========== 🔵🔵🔵\n\n');
      return;
    }

    console.log(`  ➡️ Navigating to next step: ${nextNodeId} (${stepMap[nextNodeId]?.step_title})`);
    setCurrentNodeId(nextNodeId);
    console.log('🔵🔵🔵 ========== END HANDLE NEXT (NAVIGATION) ========== 🔵🔵🔵\n\n');

    const existingAnswer = newAnswers[nextNodeId];
    console.log(`[AccountClassification] Navigating to step ${stepMap[nextNodeId]?.step_title}, existing answer:`, existingAnswer);

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
    console.log('[AccountClassification] handleBack called');

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
    console.log(`[AccountClassification] Going back to step ${stepMap[previousNodeId]?.step_title}, answer:`, previousAnswer);

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

    console.log(`[POST-COMPLETION ACTIONS] Checking for "after_workflow" actions across all steps`);
    for (const stepId of completedPath) {
      const step = stepMap[stepId];
      if (step?.post_completion_actions && step.post_completion_actions.length > 0) {
        const afterWorkflowActions = step.post_completion_actions.filter(
          action => action.execution_timing === "after_workflow"
        );
        if (afterWorkflowActions.length > 0) {
          console.log(`[POST-COMPLETION ACTIONS] Executing ${afterWorkflowActions.length} "after_workflow" action(s) from step: ${step.step_title}`);
          await executePostCompletionActions(afterWorkflowActions, cleanedAnswers);
        }
      }
    }

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

    const allCompletedSteps = [...completedPath];
    for (const stepId of allCompletedSteps) {
      const step = stepMap[stepId];
      if (step?.post_completion_actions?.length > 0) {
        for (const action of step.post_completion_actions) {
          if (action.target_entity_type === "Account" && (!action.execution_timing || action.execution_timing === "after_step")) {
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
    }

    if (finalNode?.post_completion_actions?.length > 0) {
      for (const action of finalNode.post_completion_actions) {
        if (action.target_entity_type === "Account" && (!action.execution_timing || action.execution_timing === "after_step")) {
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
        notes: fileUploadAnswer.date_received ? `Uploaded via classification workflow - Date Received: ${fileUploadAnswer.date_received}` : "Uploaded via classification workflow"
      };
      classificationData.documents = [...existingDocuments, newDocument];
      classificationData.self_certification_obtained = true;
      
      // Clear overdue flags when new self-certification is received
      classificationData.self_certification_request_date = null;
      classificationData.self_certification_overdue = false;
    }

    // Set request date if workflow asked for it
    if (selfCertRequestDate) {
      classificationData.self_certification_request_date = selfCertRequestDate;
      classificationData.self_certification_overdue = false;
    }

    const addressAnswer = Object.values(cleanedAnswers).find(ans =>
      ans && typeof ans === 'object' && ans._address_config
    );

    if (addressAnswer) {
      const { _address_config, ...newAddress } = addressAnswer;
      const targetField = _address_config.target_field || "current_address";
      const currentAccount = latestAccountData || account;
      const previousAddress = currentAccount[targetField] || {};

      classificationData[targetField] = newAddress;

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
          console.error("Error uploading file:", error);
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
      console.log(`[AccountClassification] Rendering beneficiary_input, existing answer:`, existingAnswer);

      return (
        <BeneficiaryInputRenderer
          account={latestAccountData || account}
          tenant={null}
          initialBeneficiaries={existingAnswer?.draftBeneficiaries}
          savedBeneficiaries={existingAnswer?.savedBeneficiaries}
          onBeneficiariesChange={(beneficiaries) => {
            console.log('[AccountClassification] onBeneficiariesChange called:', beneficiaries);
            setAnswers(prev => ({
              ...prev,
              [currentNodeId]: {
                ...prev[currentNodeId],
                draftBeneficiaries: beneficiaries
              }
            }));
          }}
          onBeneficiariesAdded={async (savedBeneficiaries) => {
            console.log('[AccountClassification] onBeneficiariesAdded called:', savedBeneficiaries);
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
      console.log(`[AccountClassification] Rendering controlling_person_input, existing answer:`, existingAnswer);

      return (
        <ControllingPersonInputRenderer
          account={latestAccountData || account}
          initialPersons={existingAnswer?.draftPersons}
          savedPersons={existingAnswer?.savedPersons}
          onPersonsChange={(persons) => {
            console.log('[AccountClassification] onPersonsChange called:', persons);
            setAnswers(prev => ({
              ...prev,
              [currentNodeId]: {
                ...prev[currentNodeId],
                draftPersons: persons
              }
            }));
          }}
          onControllingPersonsAdded={async (savedPersons) => {
            console.log('[AccountClassification] onControllingPersonsAdded called:', savedPersons);
            setAnswers(prev => ({
              ...prev,
              [currentNodeId]: {
                savedPersons: savedPersons,
                draftPersons: savedPersons
              }
            }));
            
            // Update account controlling persons count
            if (account?.id) {
              try {
                await base44.entities.Account.update(account.id, {
                  controlling_persons_count: savedPersons.length
                });
                refetchAccount();
              } catch (error) {
                console.error("Error updating controlling persons count:", error);
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