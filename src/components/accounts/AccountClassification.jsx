import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, ArrowRight, ArrowLeft, Info, FileCheck, AlertTriangle, Users } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// CRS Individual Account Reportability Workflow
const INDIVIDUAL_WORKFLOW = {
  Q1_account_type: {
    type: "decision",
    question: "Is this a new account or a pre-existing account?",
    help: "New accounts opened after the CRS implementation date follow simplified due diligence. Pre-existing accounts may have already undergone review.",
    outputs: { 
      NEW: "Q2_self_cert_obtained",
      PREEXISTING: "Q3_account_balance"
    }
  },
  Q2_self_cert_obtained: {
    type: "decision",
    question: "Has a valid self-certification been obtained from the account holder?",
    help: "For new accounts, a self-certification is mandatory to establish tax residency. This is a requirement under CRS procedures.",
    outputs: { 
      YES: "frm_enter_tax_residencies",
      NO: "act_classify_pending_self_cert"
    }
  },
  frm_enter_tax_residencies: {
    type: "form",
    label: "Enter tax residency information from self-certification",
    help: "Enter all countries where the account holder claims tax residency.",
    fieldId: "taxResidencies",
    fieldType: "text",
    placeholder: "e.g., United States, United Kingdom (comma-separated)",
    next: "Q4_home_jurisdiction"
  },
  Q4_home_jurisdiction: {
    type: "decision",
    question: "Is the account holder ONLY tax resident in your home jurisdiction (no foreign tax residency)?",
    help: "If the account holder is solely resident in your country with no foreign tax obligations, the account is typically non-reportable.",
    outputs: { 
      YES: "act_classify_non_reportable_local",
      NO: "Q5_check_crs_jurisdiction"
    }
  },
  Q5_check_crs_jurisdiction: {
    type: "decision",
    question: "Are any of the foreign tax residency jurisdictions CRS participating countries?",
    help: "CRS reporting only applies to participating jurisdictions. Check the OECD list of CRS participating countries.",
    outputs: { 
      YES: "act_classify_reportable_foreign",
      NO: "act_classify_non_reportable_non_crs"
    }
  },
  Q3_account_balance: {
    type: "form",
    label: "What is the account balance/value?",
    help: "Pre-existing accounts may have balance thresholds for due diligence requirements.",
    fieldId: "accountBalance",
    fieldType: "number",
    placeholder: "Enter account balance in USD",
    next: "Q6_high_value"
  },
  Q6_high_value: {
    type: "decision",
    question: "Does the account balance exceed USD 1,000,000? (High Value Account threshold)",
    help: "High value pre-existing accounts require enhanced due diligence procedures.",
    rule: (answers) => parseFloat(answers.accountBalance) > 1000000 ? "YES" : "NO",
    outputs: { 
      YES: "Q7_indicia_search",
      NO: "Q8_lower_value_indicia"
    }
  },
  Q7_indicia_search: {
    type: "decision",
    question: "Has an electronic record search been performed for foreign indicia?",
    help: "For high value accounts, you must search electronic records for: foreign address, foreign phone, standing instructions to foreign address, POA to foreign address.",
    outputs: { 
      YES: "Q9_indicia_found_high",
      NO: "act_classify_pending_indicia_search"
    }
  },
  Q9_indicia_found_high: {
    type: "decision",
    question: "Were any foreign indicia found in the electronic search?",
    help: "Foreign indicia include: residence address in foreign country, mailing address in foreign country, phone number in foreign country, standing instructions to transfer funds to foreign country, or POA granted to person with foreign address.",
    outputs: { 
      YES: "frm_indicia_list",
      NO: "Q10_paper_search"
    }
  },
  frm_indicia_list: {
    type: "multiselect",
    label: "Select all foreign indicia found",
    fieldId: "indiciaFound",
    options: [
      { value: "foreign_address", label: "Foreign residence address" },
      { value: "foreign_mailing", label: "Foreign mailing/hold mail address" },
      { value: "foreign_phone", label: "Foreign telephone number" },
      { value: "standing_instructions", label: "Standing instructions to transfer funds to foreign account" },
      { value: "poa_foreign", label: "Power of Attorney granted to person with foreign address" }
    ],
    next: "Q11_self_cert_cure_high"
  },
  Q11_self_cert_cure_high: {
    type: "decision",
    question: "Has a valid self-certification been obtained to cure the indicia?",
    help: "A self-certification can override indicia if it establishes the account holder is NOT tax resident in the foreign jurisdiction indicated by the indicia.",
    outputs: { 
      YES: "frm_enter_tax_residencies",
      NO: "act_classify_reportable_indicia_uncured"
    }
  },
  Q10_paper_search: {
    type: "decision",
    question: "Has a paper record search been performed? (Required for high value accounts)",
    help: "For high value accounts without electronic indicia, you must review paper records from the past 5 years for indicia.",
    outputs: { 
      YES: "Q12_paper_indicia",
      NO: "act_classify_pending_paper_search"
    }
  },
  Q12_paper_indicia: {
    type: "decision",
    question: "Were any foreign indicia found in the paper record search?",
    outputs: { 
      YES: "frm_indicia_list",
      NO: "act_classify_non_reportable_no_indicia"
    }
  },
  Q8_lower_value_indicia: {
    type: "decision",
    question: "Were any foreign indicia found in the electronic records? (For lower value pre-existing accounts)",
    help: "For accounts under USD 1M, electronic record search is required but paper search is not mandatory unless indicia are found.",
    outputs: { 
      YES: "frm_indicia_list_lower",
      NO: "act_classify_non_reportable_no_indicia"
    }
  },
  frm_indicia_list_lower: {
    type: "multiselect",
    label: "Select all foreign indicia found",
    fieldId: "indiciaFound",
    options: [
      { value: "foreign_address", label: "Foreign residence address" },
      { value: "foreign_mailing", label: "Foreign mailing/hold mail address" },
      { value: "foreign_phone", label: "Foreign telephone number" },
      { value: "standing_instructions", label: "Standing instructions to transfer funds to foreign account" },
      { value: "poa_foreign", label: "Power of Attorney granted to person with foreign address" }
    ],
    next: "Q13_self_cert_lower"
  },
  Q13_self_cert_lower: {
    type: "decision",
    question: "Has a self-certification been obtained to resolve the indicia?",
    outputs: { 
      YES: "frm_enter_tax_residencies",
      NO: "act_classify_reportable_indicia_uncured"
    }
  },
  
  // Actions - Classification outcomes
  act_classify_reportable_foreign: {
    type: "action",
    classification: "reportable",
    reason: (answers) => `Account holder is tax resident in foreign CRS participating jurisdiction(s): ${answers.taxResidencies}`,
    reportable_jurisdictions: (answers) => answers.taxResidencies ? answers.taxResidencies.split(',').map(j => j.trim()) : []
  },
  act_classify_reportable_indicia_uncured: {
    type: "action",
    classification: "reportable",
    reason: (answers) => `Foreign indicia found and not cured by self-certification. Indicia: ${answers.indiciaFound?.join(', ') || 'unspecified'}`,
    reportable_jurisdictions: ["To be determined based on indicia"]
  },
  act_classify_non_reportable_local: {
    type: "action",
    classification: "non_reportable",
    reason: "Account holder is solely tax resident in home jurisdiction - no foreign tax residency"
  },
  act_classify_non_reportable_non_crs: {
    type: "action",
    classification: "non_reportable",
    reason: "Foreign tax residency is in non-CRS participating jurisdiction - not reportable under CRS"
  },
  act_classify_non_reportable_no_indicia: {
    type: "action",
    classification: "non_reportable",
    reason: "No foreign indicia found - presumed local resident account"
  },
  act_classify_pending_self_cert: {
    type: "action",
    classification: "pending_review",
    reason: "Self-certification required but not yet obtained - follow up needed"
  },
  act_classify_pending_indicia_search: {
    type: "action",
    classification: "pending_review",
    reason: "Electronic record search for indicia not yet completed - due diligence pending"
  },
  act_classify_pending_paper_search: {
    type: "action",
    classification: "pending_review",
    reason: "Paper record search required for high value account - due diligence pending"
  }
};

// CRS Entity Account Reportability Workflow
const ENTITY_WORKFLOW = {
  QE1_is_financial_institution: {
    type: "decision",
    question: "Is the entity account holder itself a Financial Institution (FI)?",
    help: "Financial Institutions include: custodial institutions, depository institutions, investment entities, and specified insurance companies. If yes, this FI should do its own CRS reporting.",
    outputs: {
      YES: "QE2_fi_type",
      NO: "QE3_nfe_classification"
    }
  },
  QE2_fi_type: {
    type: "form",
    label: "What type of Financial Institution is it?",
    fieldId: "fiType",
    fieldType: "select",
    options: [
      { value: "custodial", label: "Custodial Institution" },
      { value: "depository", label: "Depository Institution" },
      { value: "investment_entity", label: "Investment Entity" },
      { value: "insurance", label: "Specified Insurance Company" }
    ],
    next: "act_classify_entity_non_reportable_fi"
  },
  QE3_nfe_classification: {
    type: "decision",
    question: "Is the entity an Active NFE or a Passive NFE?",
    help: "Active NFEs conduct substantial business activities (operational companies). Passive NFEs primarily hold passive income/assets (holding companies, investment vehicles). If unsure, default to Passive for enhanced due diligence.",
    outputs: {
      ACTIVE: "QE4_active_nfe_reason",
      PASSIVE: "act_entity_needs_controlling_persons"
    }
  },
  QE4_active_nfe_reason: {
    type: "form",
    label: "Select the Active NFE classification basis",
    fieldId: "activeNfeReason",
    fieldType: "select",
    options: [
      { value: "operational", label: "Operational company with substantial business activity" },
      { value: "publicly_traded", label: "Publicly traded entity or affiliate" },
      { value: "governmental", label: "Governmental entity or wholly-owned subsidiary" },
      { value: "holding_active", label: "Holding company of Active NFE group" },
      { value: "startup", label: "Start-up entity (less than 24 months)" },
      { value: "liquidation", label: "Entity in liquidation or emerging from bankruptcy" },
      { value: "treasury", label: "Treasury center serving Active NFE group" }
    ],
    next: "act_classify_entity_non_reportable_active_nfe"
  },
  
  // Actions for entity workflow
  act_classify_entity_non_reportable_fi: {
    type: "action",
    classification: "non_reportable",
    reason: (answers) => `Entity is a Financial Institution (${answers.fiType || 'unspecified type'}) - responsible for its own CRS reporting`,
    entity_classification: "financial_institution"
  },
  act_classify_entity_non_reportable_active_nfe: {
    type: "action",
    classification: "non_reportable",
    reason: (answers) => `Entity is an Active NFE (${answers.activeNfeReason?.replace(/_/g, ' ') || 'unspecified reason'}) - not reportable under CRS`,
    entity_classification: "active_nfe"
  },
  act_entity_needs_controlling_persons: {
    type: "action",
    classification: "pending_review",
    reason: "Entity is a Passive NFE - controlling persons must be identified and assessed for reportability",
    entity_classification: "passive_nfe",
    requires_controlling_persons: true
  }
};

export default function AccountClassification({ account, onComplete, onCancel }) {
  const [workflow, setWorkflow] = useState(null);
  const [currentNodeId, setCurrentNodeId] = useState(null);
  const [answers, setAnswers] = useState(account?.classification_answers || {});
  const [selectedValue, setSelectedValue] = useState("");
  const [selectedMultiple, setSelectedMultiple] = useState([]);
  const [textInput, setTextInput] = useState("");
  const [history, setHistory] = useState([]);
  const [user, setUser] = useState(null);

  useEffect(() => {
    loadUser();
    initializeWorkflow();
  }, [account]);

  const initializeWorkflow = () => {
    if (account?.account_holder_type === "individual") {
      setWorkflow(INDIVIDUAL_WORKFLOW);
      setCurrentNodeId("Q1_account_type");
    } else if (account?.account_holder_type === "entity") {
      setWorkflow(ENTITY_WORKFLOW);
      setCurrentNodeId("QE1_is_financial_institution");
    }
  };

  const loadUser = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
    } catch (error) {
      console.error("Error loading user:", error);
    }
  };

  if (!workflow || !currentNodeId) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
      </div>
    );
  }

  const currentNode = workflow[currentNodeId];
  const progress = Math.round((Object.keys(answers).length / 15) * 100);
  const isEntityWorkflow = account?.account_holder_type === "entity";

  const handleNext = () => {
    const newAnswers = { ...answers };
    
    if (currentNode.type === "form") {
      if (!textInput && currentNode.fieldType !== "multiselect") return;
      newAnswers[currentNode.fieldId] = textInput;
    } else if (currentNode.type === "multiselect") {
      if (selectedMultiple.length === 0) return;
      newAnswers[currentNode.fieldId] = selectedMultiple;
    } else if (currentNode.type === "decision" && !currentNode.rule) {
      if (!selectedValue) return;
      newAnswers[currentNodeId] = selectedValue;
    }

    setAnswers(newAnswers);
    setHistory([...history, currentNodeId]);

    let nextNodeId;

    if (currentNode.type === "action") {
      completeClassification(currentNode, newAnswers);
      return;
    } else if (currentNode.type === "form" || currentNode.type === "multiselect") {
      nextNodeId = currentNode.next;
    } else if (currentNode.rule) {
      const decision = currentNode.rule(newAnswers);
      nextNodeId = currentNode.outputs[decision];
      newAnswers[currentNodeId] = decision;
    } else {
      nextNodeId = currentNode.outputs[selectedValue];
    }

    if (workflow[nextNodeId]?.type === "action") {
      completeClassification(workflow[nextNodeId], newAnswers);
    } else {
      setCurrentNodeId(nextNodeId);
      setSelectedValue("");
      setSelectedMultiple([]);
      setTextInput("");
    }
  };

  const handleBack = () => {
    if (history.length === 0) {
      onCancel();
      return;
    }

    const previousNodeId = history[history.length - 1];
    const previousNode = workflow[previousNodeId];

    const newAnswers = { ...answers };
    if (previousNode.type === "form" || previousNode.type === "multiselect") {
      delete newAnswers[previousNode.fieldId];
    } else if (previousNode.type === "decision") {
      delete newAnswers[previousNodeId];
    }

    setAnswers(newAnswers);
    setHistory(history.slice(0, -1));
    setCurrentNodeId(previousNodeId);
    
    if (previousNode.type === "form") {
      setTextInput(answers[previousNode.fieldId] || "");
    } else if (previousNode.type === "multiselect") {
      setSelectedMultiple(answers[previousNode.fieldId] || []);
    } else {
      setSelectedValue(answers[previousNodeId] || "");
    }
  };

  const completeClassification = async (actionNode, finalAnswers) => {
    const classification = actionNode.classification;
    const reason = typeof actionNode.reason === "function" 
      ? actionNode.reason(finalAnswers) 
      : actionNode.reason;
    const reportableJurisdictions = typeof actionNode.reportable_jurisdictions === "function"
      ? actionNode.reportable_jurisdictions(finalAnswers)
      : (actionNode.reportable_jurisdictions || []);

    const classificationData = {
      classification_answers: finalAnswers,
      reportability_status: classification,
      reportability_reason: reason,
      indicia_found: finalAnswers.indiciaFound || [],
      self_certification_obtained: finalAnswers.Q2_self_cert_obtained === "YES" || finalAnswers.Q11_self_cert_cure_high === "YES" || finalAnswers.Q13_self_cert_lower === "YES",
      self_certification_date: (finalAnswers.Q2_self_cert_obtained === "YES" || finalAnswers.Q11_self_cert_cure_high === "YES" || finalAnswers.Q13_self_cert_lower === "YES") 
        ? new Date().toISOString().split('T')[0] 
        : null
    };

    // Entity-specific data
    if (isEntityWorkflow) {
      classificationData.entity_classification = actionNode.entity_classification;
      
      // If it's a Passive NFE, signal that controlling persons are needed
      if (actionNode.requires_controlling_persons) {
        classificationData.requires_controlling_persons = true;
      }
    }

    // Parse tax residencies if provided (for individuals)
    if (finalAnswers.taxResidencies) {
      const residencies = finalAnswers.taxResidencies.split(',').map(country => ({
        country: country.trim(),
        tin: "",
        tin_unavailable_reason: ""
      }));
      classificationData.tax_residencies = residencies;
    }

    // Save classification history record
    try {
      await base44.entities.AccountClassificationHistory.create({
        tenant_id: account.tenant_id,
        account_id: account.id,
        classification_date: new Date().toISOString(),
        reportability_status: classification,
        classification_reason: reason,
        reportable_jurisdictions: reportableJurisdictions,
        workflow_answers: finalAnswers,
        indicia_found: finalAnswers.indiciaFound || [],
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
    if (currentNode.type === "decision") {
      const options = Object.keys(currentNode.outputs);
      
      return (
        <div className="space-y-4">
          <RadioGroup value={selectedValue} onValueChange={setSelectedValue}>
            {options.map((option) => (
              <div 
                key={option}
                className="flex items-center space-x-3 p-4 rounded-lg border-2 border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50 transition-all cursor-pointer"
                onClick={() => setSelectedValue(option)}
              >
                <RadioGroupItem value={option} id={option} />
                <Label 
                  htmlFor={option}
                  className="flex-1 cursor-pointer font-medium text-slate-900"
                >
                  {option}
                </Label>
                {option === selectedValue && (
                  <CheckCircle2 className="w-5 h-5 text-indigo-600" />
                )}
              </div>
            ))}
          </RadioGroup>
        </div>
      );
    }

    if (currentNode.type === "form") {
      if (currentNode.fieldType === "select") {
        return (
          <div className="space-y-4">
            <Label className="text-sm font-medium text-slate-700">{currentNode.label}</Label>
            <Select value={textInput} onValueChange={setTextInput}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select an option..." />
              </SelectTrigger>
              <SelectContent>
                {currentNode.options.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );
      }
      
      return (
        <div className="space-y-4">
          <Label className="text-sm font-medium text-slate-700">{currentNode.label}</Label>
          <Input
            type={currentNode.fieldType}
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder={currentNode.placeholder}
            className="w-full"
          />
        </div>
      );
    }

    if (currentNode.type === "multiselect") {
      return (
        <div className="space-y-4">
          <Label className="text-sm font-medium text-slate-700">{currentNode.label}</Label>
          <div className="space-y-2">
            {currentNode.options.map((option) => (
              <div 
                key={option.value}
                className={`flex items-center space-x-3 p-4 rounded-lg border-2 transition-all cursor-pointer ${
                  selectedMultiple.includes(option.value)
                    ? 'border-indigo-400 bg-indigo-50'
                    : 'border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50'
                }`}
                onClick={() => {
                  setSelectedMultiple(prev => 
                    prev.includes(option.value)
                      ? prev.filter(v => v !== option.value)
                      : [...prev, option.value]
                  );
                }}
              >
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                  selectedMultiple.includes(option.value)
                    ? 'bg-indigo-600 border-indigo-600'
                    : 'border-slate-300'
                }`}>
                  {selectedMultiple.includes(option.value) && (
                    <CheckCircle2 className="w-4 h-4 text-white" />
                  )}
                </div>
                <Label className="flex-1 cursor-pointer font-medium text-slate-900">
                  {option.label}
                </Label>
              </div>
            ))}
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="space-y-6">
      {/* Progress */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-slate-700">
            {isEntityWorkflow ? "Entity Classification" : "Reportability Assessment"}
          </span>
          <span className="text-sm text-slate-500">{Object.keys(answers).length} steps completed</span>
        </div>
        <div className="w-full bg-slate-200 rounded-full h-2">
          <div 
            className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Workflow Type Indicator */}
      <Alert className={isEntityWorkflow ? "bg-purple-50 border-purple-200" : "bg-blue-50 border-blue-200"}>
        {isEntityWorkflow ? (
          <>
            <Users className="w-4 h-4 text-purple-600" />
            <AlertDescription className="text-sm text-purple-900">
              <strong>Entity Account Holder:</strong> This workflow will determine if the entity is a Financial Institution, Active NFE, or Passive NFE requiring controlling persons identification.
            </AlertDescription>
          </>
        ) : (
          <>
            <Info className="w-4 h-4 text-blue-600" />
            <AlertDescription className="text-sm text-blue-900">
              <strong>Individual Account Holder:</strong> This workflow follows CRS due diligence procedures for individual accounts, including indicia searches and self-certification requirements.
            </AlertDescription>
          </>
        )}
      </Alert>

      {/* Question Card */}
      <Card className="border-2 border-indigo-100 bg-gradient-to-br from-white to-indigo-50/30">
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center flex-shrink-0 mt-1">
                <span className="text-white font-bold text-sm">{history.length + 1}</span>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-slate-900 mb-2">
                  {currentNode.question || currentNode.label}
                </h3>
                {currentNode.help && (
                  <Alert className="bg-blue-50 border-blue-200">
                    <Info className="w-4 h-4 text-blue-600" />
                    <AlertDescription className="text-sm text-blue-900">
                      {currentNode.help}
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </div>

            <div className="ml-11">
              {renderNode()}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Previous Answers Summary */}
      {Object.keys(answers).length > 0 && (
        <Card className="bg-slate-50 border-slate-200">
          <CardContent className="p-4">
            <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <FileCheck className="w-4 h-4" />
              Previous Answers
            </h4>
            <div className="space-y-2">
              {Object.entries(answers).map(([key, value]) => {
                const node = workflow[key];
                if (!node) return null;
                return (
                  <div key={key} className="flex items-center justify-between text-sm">
                    <span className="text-slate-600 text-xs">
                      {node.question || node.label || key}
                    </span>
                    <Badge variant="outline" className="capitalize text-xs">
                      {Array.isArray(value) ? value.join(', ') : value}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Navigation */}
      <div className="flex justify-between gap-3 pt-4 border-t">
        <Button 
          type="button" 
          variant="outline" 
          onClick={handleBack}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          {history.length === 0 ? "Cancel" : "Back"}
        </Button>
        <Button 
          onClick={handleNext}
          disabled={
            (currentNode.type === "decision" && !selectedValue && !currentNode.rule) ||
            (currentNode.type === "form" && !textInput) ||
            (currentNode.type === "multiselect" && selectedMultiple.length === 0)
          }
          className="bg-indigo-600 hover:bg-indigo-700 text-white"
        >
          Continue
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}