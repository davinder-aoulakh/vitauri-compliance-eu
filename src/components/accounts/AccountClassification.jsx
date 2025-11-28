import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, ArrowRight, ArrowLeft, Info, FileCheck, Loader2, AlertCircle, Users, Check, Circle, Upload, GitBranch } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import MultiFieldRenderer from "../workflows/MultiFieldRenderer";
import WorkflowVisualizer from "../workflows/WorkflowVisualizer";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function AccountClassification({ account, onComplete, onCancel }) {
  const [currentNodeId, setCurrentNodeId] = useState(null);
  const [answers, setAnswers] = useState(account?.classification_answers || {});
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
  const [dateValue, setDateValue] = useState("");

  // Fetch published account classification workflows
  const { data: workflows = [], isLoading } = useQuery({
    queryKey: ['account-workflows'],
    queryFn: () => base44.entities.Workflow.filter({ 
      workflow_type: 'account_reportability',
      status: 'published'
    }),
    enabled: !!account
  });

  // Fetch CRS countries for condition evaluation
  const { data: crsCountries = [] } = useQuery({
    queryKey: ['crs-countries-for-evaluation'],
    queryFn: async () => {
      const countries = await base44.entities.CrsCountryInfo.filter({ is_crs_country: true });
      return countries.map(c => c.country_code?.toUpperCase());
    },
    staleTime: Infinity,
    enabled: !!account
  });

  // Evaluate if a workflow's trigger conditions match the account data
  const evaluateTriggerConditions = (triggerConfig, accountData) => {
    if (!triggerConfig?.enabled) return false;
    if (!triggerConfig.conditions || triggerConfig.conditions.length === 0) return true; // Enabled but no conditions = always match

    const getFieldValue = (fieldPath) => {
      if (!fieldPath) return null;
      
      // Handle nested fields (e.g., account_holder_address.country)
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

    for (let idx = 0; idx < triggerConfig.conditions.length; idx++) {
      const condition = triggerConfig.conditions[idx];
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
          conditionMet = parseFloat(fieldValue) > parseFloat(comparisonValue);
          break;
        case "less_than":
          conditionMet = parseFloat(fieldValue) < parseFloat(comparisonValue);
          break;
        case "greater_than_or_equal":
          conditionMet = parseFloat(fieldValue) >= parseFloat(comparisonValue);
          break;
        case "less_than_or_equal":
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
        const logicOp = triggerConfig.conditions[idx - 1]?.logic_operator || "AND";
        if (logicOp === "AND") {
          result = result && conditionMet;
        } else if (logicOp === "OR") {
          result = result || conditionMet;
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
      // Find workflows that match based on trigger_conditions
      const matchingWorkflows = workflows.filter(w => {
        // Check if workflow has enabled trigger conditions
        if (w.trigger_conditions?.enabled) {
          return evaluateTriggerConditions(w.trigger_conditions, account);
        }
        return false;
      });

      let selectedWorkflow = null;

      if (matchingWorkflows.length > 0) {
        // Sort by priority (higher first), then by version (latest first)
        const sortedWorkflows = matchingWorkflows.sort((a, b) => {
          const priorityA = a.trigger_conditions?.priority || 0;
          const priorityB = b.trigger_conditions?.priority || 0;
          if (priorityB !== priorityA) return priorityB - priorityA;
          return parseFloat(b.version || "1.0") - parseFloat(a.version || "1.0");
        });
        selectedWorkflow = sortedWorkflows[0];
      } else {
        // Fallback: if no workflows have matching trigger conditions, 
        // try to find any workflow that matches account holder type by name
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

  // Pre-populate answers with account data for conditional logic
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

  const isEntityWorkflow = account?.account_holder_type === "entity";
  const currentStepIndex = history.length;
  const totalSteps = completedPath.length || history.length + 1;
  const progress = Math.round((currentStepIndex / totalSteps) * 100);

  // Determine if current node is an action (end) node
  const isActionNode = (step) => {
    if (!step) return false;
    
    // Input types with default_next_step are NOT action nodes
    const inputTypes = ["text_input", "number_input", "date_input", "file_upload", "multi_field_input"];
    if (inputTypes.includes(step.question_type)) {
      // If it has a default_next_step, it's not an end node
      if (step.default_next_step) return false;
      // text_input without next step is typically an end/result node
      if (step.question_type === "text_input") return true;
      // Other input types without next_step should still allow proceeding
      return false;
    }
    
    // For choice-based questions, check if any option has a next_step
    if (!step.options || step.options.length === 0) {
      return true;
    }
    return !step.options.some(opt => opt.next_step);
  };

  const handleNext = () => {
    const newAnswers = { ...answers };

    // Store the answer
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
      // For file uploads, selectedValue should contain the upload metadata
      if (!selectedValue) return;
      newAnswers[currentNodeId] = selectedValue;
    } else if (currentNode.question_type === "multi_field_input") {
      // Validate required fields
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
    }

    setAnswers(newAnswers);
    const newHistory = [...history, currentNodeId];
    setHistory(newHistory);

    // Determine next step
    let nextNodeId = null;

    // First check if there's a selected option with next_step (for yes_no, single_choice, multiple_choice)
    if (selectedValue && currentNode.options && currentNode.options.length > 0) {
      const selectedOption = currentNode.options.find(opt => 
        opt.value === selectedValue || opt.label === selectedValue
      );
      if (selectedOption?.next_step) {
        nextNodeId = selectedOption.next_step;
      }
    }
    
    // If no next step from options, check default_next_step (for input types)
    if (!nextNodeId && currentNode.default_next_step) {
      nextNodeId = currentNode.default_next_step;
    }

    // Check conditional logic if still no next step determined
    if (!nextNodeId && currentNode.conditional_logic?.conditions?.length > 0) {
      const conditionMet = evaluateConditionalLogic(currentNode.conditional_logic, newAnswers);
      nextNodeId = conditionMet 
        ? currentNode.conditional_logic.next_step 
        : currentNode.conditional_logic.else_step;
    }

    // Validate that the next step actually exists in the workflow
    if (nextNodeId && !stepMap[nextNodeId]) {
      console.warn(`Next step "${nextNodeId}" not found in workflow, showing summary`);
      nextNodeId = null;
    }

    // If this is an action node or no valid next step, show summary
    if (!nextNodeId || isActionNode(currentNode)) {
      setCompletedPath([...newHistory, currentNodeId]);
      setShowSummary(true);
      return;
    }

    // Move to next node
    setCurrentNodeId(nextNodeId);
    setSelectedValue("");
    setDateValue("");
    setMultiFieldValues({});
    setMultiFieldErrors({});
    };

  const evaluateConditionalLogic = (logic, answers) => {
    if (!logic.conditions || logic.conditions.length === 0) return false;

    // Check if there's a trigger condition
    if (logic.trigger_field && logic.trigger_value) {
      const triggerAnswer = answers[logic.trigger_field];
      // If trigger condition is not met, skip evaluation and return false
      if (String(triggerAnswer) !== String(logic.trigger_value)) {
        return false;
      }
    }

    // Helper to get field value from various sources
    const getFieldValue = (fieldPath) => {
      // Check if it's a multi-field input reference (step_id.field_id)
      if (fieldPath.includes('.')) {
        const parts = fieldPath.split('.');

        // Check if first part is a step ID
        const stepAnswer = answers[parts[0]];
        if (stepAnswer && typeof stepAnswer === 'object') {
          // It's a multi-field input answer
          return stepAnswer[parts[1]];
        }

        // Check account nested fields
        if (parts[0] === 'account_holder_address' || parts[0] === 'current_address') {
          return account?.[parts[0]]?.[parts[1]];
        }
        if (parts[0] === 'address') {
          // Entity address - would need entity context
          return null;
        }
      }

      // Check direct answers
      if (answers[fieldPath] !== undefined) {
        return answers[fieldPath];
      }

      // Handle special account data fields
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

      // Check other account fields
      if (account?.[fieldPath] !== undefined) {
        return account[fieldPath];
      }

      return null;
    };

    let result = true;

    logic.conditions.forEach((condition, idx) => {
      let fieldValue = getFieldValue(condition.field);

      // Get comparison value (could be static or field reference)
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
          // Check if the country value is in CRS participating countries
          const countryCodeCrs = String(fieldValue).toUpperCase();
          conditionMet = crsCountries.includes(countryCodeCrs);
          break;
        case "is_not_crs":
          // Check if the country value is NOT in CRS participating countries
          const countryCodeNotCrs = String(fieldValue).toUpperCase();
          conditionMet = !crsCountries.includes(countryCodeNotCrs);
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
    setSelectedValue(answers[previousNodeId] || "");
  };

  const completeClassification = async () => {
    const finalNode = stepMap[history[history.length - 1]] || currentNode;
    const finalAnswers = answers;

    // Remove internal account data fields from saved answers
    const cleanedAnswers = { ...finalAnswers };
    delete cleanedAnswers._account_data_loaded;
    delete cleanedAnswers._is_pre_existing;
    delete cleanedAnswers._account_holder_is_alive;
    delete cleanedAnswers._account_holder_type;

    // Determine classification based on final node
    let reportabilityStatus = "pending_review";
    let reason = finalNode.help_text || finalNode.step_title || "Classification completed";

    // Parse classification from node title/help text
    if (finalNode.step_title?.toLowerCase().includes("reportable") || 
        finalNode.help_text?.toLowerCase().includes("reportable")) {
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

    // Check if there's a file upload answer for self-certification
    const fileUploadAnswer = Object.values(cleanedAnswers).find(ans => 
      ans && typeof ans === 'object' && ans.file_url
    );

    const classificationData = {
      classification_answers: cleanedAnswers,
      reportability_status: reportabilityStatus,
      reportability_reason: reason,
      self_certification_obtained: finalNode.step_title?.toLowerCase().includes("self-certification obtained") || !!fileUploadAnswer
    };

    // If file was uploaded during workflow, update account with file details
    if (fileUploadAnswer) {
      classificationData.self_certification_document_url = fileUploadAnswer.file_url;
      classificationData.self_certification_document_name = fileUploadAnswer.file_name;
      classificationData.self_certification_upload_date = fileUploadAnswer.upload_date;
      classificationData.self_certification_uploaded_by_email = user?.email;
      classificationData.self_certification_obtained = true;
    }

    // Save classification history record
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

  // Early return if no account provided - MUST be after all hooks
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

  const renderNode = () => {
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

    if (currentNode.question_type === "single_choice" || currentNode.question_type === "multiple_choice") {
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

    return null;
    };

  // Summary Screen
  if (showSummary) {
    const finalNode = stepMap[completedPath[completedPath.length - 1]];
    const isReportable = finalNode?.step_title?.toLowerCase().includes("reportable") && 
                         !finalNode?.step_title?.toLowerCase().includes("non-reportable");

    return (
      <div className="space-y-6">
        {/* Header */}
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

        {/* Account Context Info */}
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

        {/* Classification Result Preview */}
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

        {/* All Answers Summary */}
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

                const answerLabel = step.options?.find(o => o.value === answer)?.label || answer;

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
      {/* Workflow Header */}
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
              Show Flowchart
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

      {/* Flowchart Dialog */}
      <Dialog open={showFlowchart} onOpenChange={setShowFlowchart}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Workflow Flowchart: {workflow.workflow_name}</DialogTitle>
          </DialogHeader>
          <WorkflowVisualizer workflow={workflow} />
        </DialogContent>
      </Dialog>

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
          <span className="font-medium text-indigo-600">{Object.keys(answers).filter(k => !k.startsWith('_')).length} questions answered</span>
          <span>Summary</span>
        </div>
      </div>

      {/* Workflow Type Indicator */}
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
                {currentNode.regulatory_reference && (
                  <p className="text-xs text-slate-500 italic mb-3 flex items-center gap-2">
                    <FileCheck className="w-3 h-3" />
                    Reference: {currentNode.regulatory_reference}
                  </p>
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
            !selectedValue && 
            !(currentNode.question_type === "multi_field_input" && Object.keys(multiFieldValues).length > 0)
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