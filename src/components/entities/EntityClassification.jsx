import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, ArrowRight, ArrowLeft, Info, FileCheck } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Workflow definition
const WORKFLOW = {
  Q1a_is_there_an_entity: {
    type: "decision",
    question: "Is there an entity?",
    help: "Confirm that a legal entity exists for classification.",
    outputs: { YES: "Q1b_cbc_nonlife", NO: "act_classify_non_reporting_no_entity" }
  },
  Q1b_cbc_nonlife: {
    type: "decision",
    question: "Is the entity supervised by CBCS and non-life?",
    help: "Determine if the entity is supervised by the Central Bank and is a non-life insurance entity.",
    outputs: { YES: "act_classify_non_reporting_cbc_nonlife", NO: "frm_select_legal_entity_type" }
  },
  frm_select_legal_entity_type: {
    type: "form",
    label: "Select type of legal entity",
    fieldId: "legalEntityType",
    options: [
      { value: "corporation", label: "Corporation" },
      { value: "trust", label: "Trust" },
      { value: "partnership", label: "Partnership" },
      { value: "fund", label: "Investment Fund" },
      { value: "branch", label: "Branch" },
      { value: "other", label: "Other" }
    ],
    next: "Q2a_crs_participating"
  },
  Q2a_crs_participating: {
    type: "decision",
    question: "Is the entity residing in a CRS participating jurisdiction?",
    help: "Check if the entity is located in a jurisdiction that participates in CRS reporting.",
    outputs: { YES: "Q2b_tax_resident", NO: "act_classify_non_reporting_not_in_crs" }
  },
  Q2b_tax_resident: {
    type: "decision",
    question: "Is the entity tax resident of that participating jurisdiction?",
    help: "Confirm tax residency status in the CRS participating jurisdiction.",
    outputs: { 
      YES: "frm_select_fi_type", 
      NO: "act_classify_non_reporting_not_tax_resident",
      NONE: "act_classify_non_reporting_none_applies"
    }
  },
  frm_select_fi_type: {
    type: "form",
    label: "Select type of financial institution",
    fieldId: "fiType",
    options: [
      { value: "1", label: "Custodial Institution" },
      { value: "2", label: "Depository Institution" },
      { value: "3a", label: "Investment Entity (Managed)" },
      { value: "3b", label: "Investment Entity (Professional)" },
      { value: "4", label: "Specified Insurance Company" },
      { value: "non", label: "Non (not a financial institution)" }
    ],
    next: "Q3_is_fi"
  },
  Q3_is_fi: {
    type: "decision",
    question: "Is the entity a Financial Institution?",
    help: "Based on the selected type, determine if this qualifies as a Financial Institution.",
    rule: (answers) => ["1", "2", "3a", "3b", "4"].includes(answers.fiType) ? "YES" : "NO",
    outputs: { YES: "Q4_exempt_non_reporting_fi", NO: "act_classify_non_reporting_not_fi" }
  },
  Q4_exempt_non_reporting_fi: {
    type: "decision",
    question: "Is the entity Exempt as a Non-Reporting Financial Institution?",
    help: "Check if the FI qualifies for any CRS reporting exemptions.",
    outputs: { YES: "frm_select_exemption", NO: "act_classify_reporting_fi" }
  },
  frm_select_exemption: {
    type: "form",
    label: "Select non-reporting exemption",
    fieldId: "nonReportingExemption",
    options: [
      { value: "1", label: "Governmental Entity" },
      { value: "2", label: "International Organisation" },
      { value: "3", label: "Central Bank" },
      { value: "4", label: "Broad Participation Retirement Fund" },
      { value: "5", label: "Narrow Participation Retirement Fund" },
      { value: "6", label: "Pension Fund of Governmental Entity" },
      { value: "7", label: "Qualified Credit Card Issuer" },
      { value: "8", label: "Exempt Collective Investment Vehicle" },
      { value: "9", label: "Trustee-Documented Trust" }
    ],
    next: "act_classify_non_reporting_exempt"
  },
  act_classify_non_reporting_no_entity: {
    type: "action",
    classification: "non_reporting_fi",
    reason: "No entity present",
    rfi_status: "non_reporting_fi",
    fi_type: "not_applicable"
  },
  act_classify_non_reporting_cbc_nonlife: {
    type: "action",
    classification: "non_reporting_fi",
    reason: "CBCS supervised non-life insurance entity",
    rfi_status: "non_reporting_fi",
    fi_type: "specified_insurance_company"
  },
  act_classify_non_reporting_not_in_crs: {
    type: "action",
    classification: "non_reporting_fi",
    reason: "Not in CRS participating jurisdiction",
    rfi_status: "non_reporting_fi",
    fi_type: "not_applicable"
  },
  act_classify_non_reporting_not_tax_resident: {
    type: "action",
    classification: "non_reporting_fi",
    reason: "Not tax resident in participating jurisdiction",
    rfi_status: "non_reporting_fi",
    fi_type: "not_applicable"
  },
  act_classify_non_reporting_none_applies: {
    type: "action",
    classification: "non_reporting_fi",
    reason: "Tax residence none/unknown",
    rfi_status: "non_reporting_fi",
    fi_type: "not_applicable"
  },
  act_classify_non_reporting_not_fi: {
    type: "action",
    classification: "non_reporting_fi",
    reason: "Not a Financial Institution (NFE)",
    rfi_status: "nfe_active",
    fi_type: "not_applicable"
  },
  act_classify_non_reporting_exempt: {
    type: "action",
    classification: "non_reporting_fi",
    reason: (answers) => `Exempt Non-Reporting FI (${answers.nonReportingExemption})`,
    rfi_status: "non_reporting_fi",
    fi_type: (answers) => {
      const fiTypeMap = {
        "1": "custodial_institution",
        "2": "depository_institution",
        "3a": "investment_entity",
        "3b": "investment_entity",
        "4": "specified_insurance_company"
      };
      return fiTypeMap[answers.fiType] || "not_applicable";
    }
  },
  act_classify_reporting_fi: {
    type: "action",
    classification: "reporting_fi",
    reason: "Financial Institution and not exempt - CRS reporting required",
    rfi_status: "reporting_fi",
    fi_type: (answers) => {
      const fiTypeMap = {
        "1": "custodial_institution",
        "2": "depository_institution",
        "3a": "investment_entity",
        "3b": "investment_entity",
        "4": "specified_insurance_company"
      };
      return fiTypeMap[answers.fiType] || "not_applicable";
    }
  }
};

export default function EntityClassification({ entity, onComplete, onCancel }) {
  const [currentNodeId, setCurrentNodeId] = useState("Q1a_is_there_an_entity");
  const [answers, setAnswers] = useState(entity?.classification_answers || {});
  const [selectedValue, setSelectedValue] = useState("");
  const [history, setHistory] = useState([]);
  const [user, setUser] = useState(null);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
    } catch (error) {
      console.error("Error loading user:", error);
    }
  };

  const progress = Math.round((Object.keys(answers).length / 10) * 100);

  const handleNext = () => {
    if (!selectedValue && currentNode.type !== "decision" && !currentNode.rule) return;

    const newAnswers = { ...answers };
    
    if (currentNode.type === "form") {
      newAnswers[currentNode.fieldId] = selectedValue;
    } else if (currentNode.type === "decision" && !currentNode.rule) {
      newAnswers[currentNodeId] = selectedValue;
    }

    setAnswers(newAnswers);
    setHistory([...history, currentNodeId]);

    let nextNodeId;

    if (currentNode.type === "action") {
      completeClassification(currentNode, newAnswers);
      return;
    } else if (currentNode.type === "form") {
      nextNodeId = currentNode.next;
    } else if (currentNode.rule) {
      // Auto-decision based on rule
      const decision = currentNode.rule(newAnswers);
      nextNodeId = currentNode.outputs[decision];
      newAnswers[currentNodeId] = decision;
    } else {
      nextNodeId = currentNode.outputs[selectedValue];
    }

    if (WORKFLOW[nextNodeId]?.type === "action") {
      completeClassification(WORKFLOW[nextNodeId], newAnswers);
    } else {
      setCurrentNodeId(nextNodeId);
      setSelectedValue("");
    }
  };

  const handleBack = () => {
    if (history.length === 0) {
      onCancel();
      return;
    }

    const previousNodeId = history[history.length - 1];
    const previousNode = WORKFLOW[previousNodeId];

    // Remove last answer
    const newAnswers = { ...answers };
    if (previousNode.type === "form") {
      delete newAnswers[previousNode.fieldId];
    } else if (previousNode.type === "decision") {
      delete newAnswers[previousNodeId];
    }

    setAnswers(newAnswers);
    setHistory(history.slice(0, -1));
    setCurrentNodeId(previousNodeId);
    setSelectedValue(
      previousNode.type === "form" ? (answers[previousNode.fieldId] || "") : (answers[previousNodeId] || "")
    );
  };

  const completeClassification = async (actionNode, finalAnswers) => {
    const classification = actionNode.classification;
    const reason = typeof actionNode.reason === "function" 
      ? actionNode.reason(finalAnswers) 
      : actionNode.reason;
    const rfi_status = actionNode.rfi_status;
    const fi_type = typeof actionNode.fi_type === "function"
      ? actionNode.fi_type(finalAnswers)
      : actionNode.fi_type;

    const classificationData = {
      classification_answers: finalAnswers,
      classification_completed_date: new Date().toISOString().split('T')[0],
      rfi_status: rfi_status,
      fi_type: fi_type,
      non_reporting_reason: classification === "non_reporting_fi" ? reason : undefined,
      entity_type: finalAnswers.legalEntityType || entity.entity_type
    };

    // Save classification history record
    try {
      await base44.entities.EntityClassificationHistory.create({
        tenant_id: entity.tenant_id,
        entity_id: entity.id,
        classification_date: new Date().toISOString(),
        classification_result: rfi_status,
        classification_reason: reason,
        fi_type: fi_type,
        workflow_answers: finalAnswers,
        performed_by: user?.email || "unknown",
        entity_name: entity.entity_name,
        entity_type: finalAnswers.legalEntityType || entity.entity_type
      });
    } catch (error) {
      console.error("Error saving classification history:", error);
    }

    onComplete(classificationData);
  };

  const currentNode = WORKFLOW[currentNodeId];

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
      return (
        <div className="space-y-4">
          <Label className="text-sm font-medium text-slate-700">{currentNode.label}</Label>
          <Select value={selectedValue} onValueChange={setSelectedValue}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder={`Select ${currentNode.label.toLowerCase()}...`} />
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

    return null;
  };

  return (
    <div className="space-y-6">
      {/* Progress */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-slate-700">Classification Progress</span>
          <span className="text-sm text-slate-500">{Object.keys(answers).length} steps completed</span>
        </div>
        <div className="w-full bg-slate-200 rounded-full h-2">
          <div 
            className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

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

            {/* Render current node */}
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
                const node = WORKFLOW[key];
                if (!node) return null;
                return (
                  <div key={key} className="flex items-center justify-between text-sm">
                    <span className="text-slate-600 text-xs">
                      {node.question || node.label || key}
                    </span>
                    <Badge variant="outline" className="capitalize text-xs">
                      {node.options?.find(o => o.value === value)?.label || value}
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
          disabled={!selectedValue && currentNode.type !== "decision" && !currentNode.rule}
          className="bg-indigo-600 hover:bg-indigo-700 text-white"
        >
          Continue
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}