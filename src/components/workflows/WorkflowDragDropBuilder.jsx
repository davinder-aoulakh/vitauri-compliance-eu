import React, { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Circle, Diamond, Square, Plus, Trash2, Save, Settings, Copy, Link as LinkIcon, ChevronRight, Target, Sparkles } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import OutcomeRulesConfig from "./OutcomeRulesConfig";
import StepEditor from "./StepEditor";
import CopyWorkflowStepsDialog from "./CopyWorkflowStepsDialog";

const ACCOUNT_FIELDS = [
  { value: "account_number", label: "Account Number" },
  { value: "account_number_type", label: "Account Number Type" },
  { value: "account_creation_date", label: "Account Creation Date" },
  { value: "account_type", label: "Account Type" },
  { value: "account_holder_type", label: "Account Holder Type" },
  { value: "account_holder_name", label: "Account Holder Name" },
  { value: "first_name", label: "First Name" },
  { value: "last_name", label: "Last Name" },
  { value: "date_of_birth", label: "Date of Birth" },
  { value: "place_of_birth", label: "Place of Birth" },
  { value: "country_of_incorporation", label: "Country of Incorporation" },
  { value: "is_pre_existing", label: "Pre-existing Account" },
  { value: "is_recalcitrant", label: "Is Recalcitrant" },
  { value: "account_holder_is_alive", label: "Account Holder Is Alive" },
  { value: "account_holder_deceased_during_period", label: "Deceased During Period" },
  { value: "account_closed_during_period", label: "Account Closed During Period" },
  { value: "account_frozen_at_reporting_date", label: "Account Frozen at Reporting Date" },
  { value: "account_dormant_at_reporting_date", label: "Account Dormant at Reporting Date" },
  { value: "entity_managed_by_fiduciary_trust", label: "Managed by Fiduciary Trust" },
  { value: "entity_managed_by_asset_manager", label: "Managed by Asset Manager" },
  { value: "gross_income_from_financial_assets", label: "Gross Income from Financial Assets" },
  { value: "gross_income_50_passive", label: "Gross Income 50%+ Passive" },
  { value: "entity_classification", label: "Entity Classification" },
  { value: "crs_entity_classification", label: "CRS Entity Classification" },
  { value: "year_end_cash_value", label: "Year End Cash Value" },
  { value: "year_end_cash_value_currency", label: "Year End Cash Value Currency" },
  { value: "gross_payments", label: "Gross Payments" },
  { value: "gross_payments_currency", label: "Gross Payments Currency" },
  { value: "reporting_year", label: "Reporting Year" },
  { value: "reportability_status", label: "Reportability Status" },
  { value: "beneficiaries_count", label: "Beneficiaries Count" },
  { value: "controlling_persons_count", label: "Controlling Persons Count" },
  { value: "self_certification_obtained", label: "Self Certification Obtained" },
  { value: "self_certification_date", label: "Self Certification Date" },
  { value: "country_of_residence", label: "Country of Residence" },
  { value: "status", label: "Account Status" },
];

export default function WorkflowDragDropBuilder({ workflow, onSave, onCancel }) {
  const initialSteps = (workflow?.steps || []).map(step => {
    const normalizedConditions = (step.conditional_logic?.conditions || []).map(c => ({
      ...c,
      value_type: c.value_type !== undefined ? c.value_type : "static"
    }));
    const normalizedConditionGroups = (step.conditional_logic?.condition_groups || []).map(group => ({
      ...group,
      conditions: (group.conditions || []).map(c => ({ ...c, value_type: c.value_type !== undefined ? c.value_type : "static" }))
    }));
    return {
      ...step,
      default_next_step: step.default_next_step || "",
      conditional_logic: step.conditional_logic ? {
        ...step.conditional_logic,
        conditions: normalizedConditions,
        option_values: Array.isArray(step.conditional_logic.option_values) ? step.conditional_logic.option_values : [],
        condition_groups: normalizedConditionGroups,
        overall_logic_operator: step.conditional_logic.overall_logic_operator || null,
        overall_true_step: step.conditional_logic.overall_true_step || null,
        overall_false_step: step.conditional_logic.overall_false_step || null
      } : { conditions: [], next_step: "", else_step: "", option_values: [], condition_groups: [] }
    };
  });

  const [steps, setSteps] = useState(initialSteps);
  const [selectedStep, setSelectedStep] = useState(null);
  const [showStepEditor, setShowStepEditor] = useState(false);
  const [showCopyStepsDialog, setShowCopyStepsDialog] = useState(false);
  const [workflowName, setWorkflowName] = useState(workflow?.workflow_name || "");
  const [workflowType, setWorkflowType] = useState(workflow?.workflow_type || "custom");
  const [displayIntro, setDisplayIntro] = useState(workflow?.display_workflow_introduction || false);
  const [introText, setIntroText] = useState(workflow?.workflow_introduction_text || "");
  const [introFields, setIntroFields] = useState(workflow?.workflow_introduction_fields || []);
  const [outcomeRules, setOutcomeRules] = useState(() => {
    const rules = workflow?.outcome_rules || [];
    return rules.map(rule => ({
      condition: rule.condition || "",
      result_classification: rule.result_classification || "",
      result_description: rule.result_description || "",
      account_context_items: rule.account_context_items || [],
      status_color: rule.status_color || "green"
    }));
  });

  const nodeTypes = [
    { id: "question", label: "Question", icon: Circle, color: "bg-blue-100 text-blue-700 border-blue-300", questionType: "yes_no" },
    { id: "decision", label: "Decision", icon: Diamond, color: "bg-purple-100 text-purple-700 border-purple-300", questionType: "single_choice" },
    { id: "action", label: "Action", icon: Square, color: "bg-green-100 text-green-700 border-green-300" }
  ];

  const handleAddStep = (nodeType) => {
    const newStep = {
      step_id: `step_${Date.now()}`,
      step_title: `New ${nodeType.label}`,
      step_description: "",
      question_text: "",
      question_type: nodeType.questionType || "yes_no",
      options: nodeType.questionType ? [{ value: "YES", label: "Yes", next_step: "" }, { value: "NO", label: "No", next_step: "" }] : [],
      help_text: "",
      required: true,
      post_completion_actions: []
    };
    setSteps([...steps, newStep]);
    setSelectedStep(newStep);
    setShowStepEditor(true);
  };

  const handleUpdateStep = (updatedStep) => {
    const newSteps = steps.map(s => s.step_id === updatedStep.step_id ? updatedStep : s);
    setSteps(newSteps);
    setSelectedStep(newSteps.find(s => s.step_id === updatedStep.step_id) || updatedStep);
  };

  const handleDeleteStep = (stepId) => {
    if (confirm("Delete this step?")) {
      setSteps(steps.filter(s => s.step_id !== stepId));
      if (selectedStep?.step_id === stepId) {
        setSelectedStep(null);
        setShowStepEditor(false);
      }
    }
  };

  const handleDuplicateStep = (step) => {
    const newStep = { ...step, step_id: `step_${Date.now()}`, step_title: `${step.step_title} (Copy)` };
    setSteps(prev => [...prev, newStep]);
  };

  const handleCopyStepsFromOtherWorkflow = (copiedSteps) => {
    const newSteps = copiedSteps.map(step => ({
      ...step,
      step_id: `step_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      step_title: `${step.step_title} (Copied)`
    }));
    setSteps(prev => [...prev, ...newSteps]);
  };

  const handleSave = () => {
    const processedSteps = steps.map(step => {
      const processedConditionalLogic = step.conditional_logic ? {
        trigger_field: step.conditional_logic.trigger_field || null,
        trigger_value: step.conditional_logic.trigger_value || null,
        conditions: (step.conditional_logic.conditions || []).map(c => ({
          field: c.field || "",
          operator: c.operator || "=",
          value: c.value || "",
          value_type: c.value_type || "static",
          logic_operator: c.logic_operator || "AND"
        })),
        next_step: step.conditional_logic.next_step || "",
        else_step: step.conditional_logic.else_step || "",
        use_selection_count: !!(step.conditional_logic.selection_count_next_step || step.conditional_logic.selection_count_else_step || (step.conditional_logic.selection_count_value !== undefined && step.conditional_logic.selection_count_value !== null)),
        selection_count_operator: step.conditional_logic.selection_count_operator || null,
        selection_count_value: step.conditional_logic.selection_count_value !== undefined ? step.conditional_logic.selection_count_value : null,
        selection_count_next_step: step.conditional_logic.selection_count_next_step || null,
        selection_count_else_step: step.conditional_logic.selection_count_else_step || null,
        option_values: Array.isArray(step.conditional_logic.option_values) && step.conditional_logic.option_values.length > 0 ? step.conditional_logic.option_values : null,
        option_values_next_step: step.conditional_logic.option_values_next_step || null,
        option_values_else_step: step.conditional_logic.option_values_else_step || null,
        multi_choice_routing_groups: step.conditional_logic.multi_choice_routing_groups && step.conditional_logic.multi_choice_routing_groups.length > 0 ? step.conditional_logic.multi_choice_routing_groups : null,
        multi_choice_default_step: step.conditional_logic.multi_choice_default_step || null,
        condition_groups: step.conditional_logic.condition_groups && step.conditional_logic.condition_groups.length > 0
          ? step.conditional_logic.condition_groups.map(group => ({
              group_id: group.group_id || `group_${Date.now()}`,
              group_name: group.group_name || "",
              group_operator: group.group_operator || "AND",
              conditions: (group.conditions || []).map(c => ({
                condition_id: c.condition_id || `cond_${Date.now()}`,
                field: c.field || "",
                operator: c.operator || "=",
                value: c.value || "",
                value_type: c.value_type || "static"
              })),
              true_step: group.true_step || "",
              false_step: group.false_step || ""
            }))
          : null,
        overall_logic_operator: step.conditional_logic.overall_logic_operator || null,
        overall_true_step: step.conditional_logic.overall_true_step || null,
        overall_false_step: step.conditional_logic.overall_false_step || null
      } : { conditions: [], next_step: "", else_step: "", option_values: null };
      return { ...step, conditional_logic: processedConditionalLogic };
    });

    onSave({
      ...workflow,
      workflow_name: workflowName,
      workflow_type: workflowType,
      display_workflow_introduction: displayIntro,
      workflow_introduction_text: introText,
      workflow_introduction_fields: introFields,
      steps: processedSteps,
      outcome_rules: outcomeRules,
      last_modified_by: "current_user"
    });
  };

  return (
    <div className="space-y-6">
      {/* Workflow Settings */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-transparent">
          <CardTitle className="text-lg">Workflow Settings</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="workflow_name">Workflow Name *</Label>
              <Input id="workflow_name" value={workflowName} onChange={(e) => setWorkflowName(e.target.value)} placeholder="e.g., Entity Classification" className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="workflow_type">Workflow Type *</Label>
              <Select value={workflowType} onValueChange={setWorkflowType}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="entity_rfi_classification">Entity RFI Classification</SelectItem>
                  <SelectItem value="account_reportability">Account Reportability</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t space-y-4">
            <div className="flex items-center gap-2">
              <Checkbox id="display_intro" checked={displayIntro} onCheckedChange={setDisplayIntro} />
              <Label htmlFor="display_intro" className="text-sm font-semibold cursor-pointer">Show Workflow Introduction</Label>
            </div>
            {displayIntro && (
              <div className="space-y-4 p-4 bg-blue-50 border-2 border-blue-200 rounded-lg">
                <div>
                  <Label htmlFor="intro_text">Introduction Text</Label>
                  <Textarea id="intro_text" value={introText} onChange={(e) => setIntroText(e.target.value)} rows={2} className="mt-1.5" />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm">Dynamic Fields to Display</Label>
                    <Button type="button" size="sm" variant="outline" onClick={() => setIntroFields([...introFields, { field_type: "simple_field", field_name: "", display_label: "", value_formatter: "default" }])}>
                      <Plus className="w-3 h-3 mr-1" />Add Field
                    </Button>
                  </div>
                  {introFields.length === 0 ? (
                    <p className="text-xs text-slate-500 italic p-3 bg-white rounded border">No fields configured.</p>
                  ) : (
                    <div className="space-y-3">
                      {introFields.map((field, idx) => {
                        const updateField = (updates) => {
                          const nf = [...introFields];
                          nf[idx] = { ...nf[idx], ...updates };
                          setIntroFields(nf);
                        };
                        return (
                          <div key={idx} className="p-3 border rounded-lg bg-white space-y-2">
                            <div className="flex items-center gap-2">
                              <Input value={field.display_label} onChange={(e) => updateField({ display_label: e.target.value })} placeholder="Display Label" className="flex-1 h-8 text-xs" />
                              <Select value={field.field_name} onValueChange={(v) => updateField({ field_name: v })}>
                                <SelectTrigger className="flex-1 h-8 text-xs"><SelectValue placeholder="Select field..." /></SelectTrigger>
                                <SelectContent className="max-h-72">
                                  {ACCOUNT_FIELDS.map(f => <SelectItem key={f.value} value={f.value} className="text-xs">{f.label}</SelectItem>)}
                                </SelectContent>
                              </Select>
                              <Select value={field.value_formatter || "default"} onValueChange={(v) => updateField({ value_formatter: v })}>
                                <SelectTrigger className="w-44 h-8 text-xs"><SelectValue placeholder="Formatter..." /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="default" className="text-xs">Default</SelectItem>
                                  <SelectItem value="capitalize" className="text-xs">Capitalize</SelectItem>
                                  <SelectItem value="boolean_alive_deceased" className="text-xs">Alive/Deceased</SelectItem>
                                  <SelectItem value="pre_existing_new" className="text-xs">Pre-existing/New</SelectItem>
                                  <SelectItem value="threshold_based_display" className="text-xs">High/Low Value (Threshold)</SelectItem>
                                </SelectContent>
                              </Select>
                              <Button type="button" variant="ghost" size="icon" onClick={() => setIntroFields(introFields.filter((_, i) => i !== idx))} className="h-7 w-7 text-red-600 flex-shrink-0"><Trash2 className="w-3 h-3" /></Button>
                            </div>
                            {field.value_formatter === "threshold_based_display" && (
                              <div className="space-y-2 pt-1 border-t border-slate-100">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-slate-500 w-16 flex-shrink-0">Field 1:</span>
                                  <Select value={field.field_name || ""} onValueChange={(v) => updateField({ field_name: v })}>
                                    <SelectTrigger className="flex-1 h-7 text-xs"><SelectValue placeholder="Primary field..." /></SelectTrigger>
                                    <SelectContent className="max-h-60">{ACCOUNT_FIELDS.map(f => <SelectItem key={f.value} value={f.value} className="text-xs">{f.label}</SelectItem>)}</SelectContent>
                                  </Select>
                                  <span className="text-xs text-slate-400">+</span>
                                  <Select value={field.threshold_field_2 || ""} onValueChange={(v) => updateField({ threshold_field_2: v === "_none_" ? "" : v })}>
                                    <SelectTrigger className="flex-1 h-7 text-xs"><SelectValue placeholder="Add 2nd field (optional)..." /></SelectTrigger>
                                    <SelectContent className="max-h-60">
                                      <SelectItem value="_none_" className="text-xs italic text-slate-400">None</SelectItem>
                                      {ACCOUNT_FIELDS.map(f => <SelectItem key={f.value} value={f.value} className="text-xs">{f.label}</SelectItem>)}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="grid grid-cols-4 gap-2">
                                  <Select value={field.comparison_operator || "greater_than"} onValueChange={(v) => updateField({ comparison_operator: v })}>
                                    <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="greater_than" className="text-xs">&gt; Greater than</SelectItem>
                                      <SelectItem value="greater_than_or_equal" className="text-xs">&ge; Greater or equal</SelectItem>
                                      <SelectItem value="less_than" className="text-xs">&lt; Less than</SelectItem>
                                      <SelectItem value="less_than_or_equal" className="text-xs">&le; Less or equal</SelectItem>
                                      <SelectItem value="equals" className="text-xs">= Equals</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <Input type="number" value={field.threshold_value || ""} onChange={(e) => updateField({ threshold_value: Number(e.target.value) })} placeholder="Threshold (e.g. 1000000)" className="h-7 text-xs" />
                                  <Input value={field.true_text || ""} onChange={(e) => updateField({ true_text: e.target.value })} placeholder="If true (e.g. High Value)" className="h-7 text-xs" />
                                  <Input value={field.false_text || ""} onChange={(e) => updateField({ false_text: e.target.value })} placeholder="If false (e.g. Low Value)" className="h-7 text-xs" />
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tabs for Steps and Outcome Rules */}
      <Tabs defaultValue="steps" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger value="steps" className="flex items-center gap-2">
            <Circle className="w-4 h-4" />Workflow Steps ({steps.length})
          </TabsTrigger>
          <TabsTrigger value="outcomes" className="flex items-center gap-2">
            <Target className="w-4 h-4" />Outcome Rules ({outcomeRules.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="steps">
          <div className="grid grid-cols-12 gap-6">
            {/* Node Palette */}
            <div className="col-span-3">
              <Card className="border-0 shadow-lg sticky top-6">
                <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-transparent">
                  <CardTitle className="text-sm">Node Palette</CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="space-y-2">
                    {nodeTypes.map((nodeType) => (
                      <button key={nodeType.id} onClick={() => handleAddStep(nodeType)} className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 ${nodeType.color} hover:shadow-md transition-all`}>
                        <nodeType.icon className="w-5 h-5" />
                        <span className="font-medium text-sm">{nodeType.label}</span>
                        <Plus className="w-4 h-4 ml-auto" />
                      </button>
                    ))}
                  </div>
                  <div className="mt-6 pt-6 border-t">
                    <p className="text-xs text-slate-600 mb-2">Quick Actions</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full justify-start"
                      onClick={() => setShowCopyStepsDialog(true)}
                    >
                      <Copy className="w-3 h-3 mr-2" />
                      Copy Steps from Workflow
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Canvas */}
            <div className="col-span-9">
              <Card className="border-0 shadow-lg">
                <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-transparent">
                  <CardTitle className="text-lg">Workflow Steps ({steps.length})</CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  {steps.length === 0 ? (
                    <div className="text-center py-12">
                      <Circle className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                      <h3 className="text-lg font-semibold text-slate-900 mb-2">No Steps Yet</h3>
                      <p className="text-slate-600 mb-6">Start building your workflow by adding steps from the palette</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {steps.map((step, index) => {
                        const nodeType = nodeTypes.find(nt =>
                          step.step_title?.includes(nt.label) ||
                          (step.options?.length > 0 && nt.id === "decision") ||
                          (step.question_type === "yes_no" && nt.id === "question")
                        ) || nodeTypes[0];
                        return (
                          <div key={step.step_id} className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${selectedStep?.step_id === step.step_id ? "border-indigo-400 bg-indigo-50 shadow-md" : "border-slate-200 hover:border-slate-300 hover:shadow"}`}
                            onClick={() => { setSelectedStep(step); setShowStepEditor(true); }}>
                            <div className="flex items-start gap-3">
                              <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">{index + 1}</div>
                              <div className={`w-10 h-10 rounded-lg flex items-center justify-center border-2 ${nodeType.color} flex-shrink-0`}>
                                <nodeType.icon className="w-5 h-5" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="font-semibold text-slate-900 mb-1">{step.step_title}</h4>
                                {step.question_text && <p className="text-sm text-slate-600 line-clamp-2">{step.question_text}</p>}
                                {step.options && step.options.length > 0 && (
                                  <div className="flex gap-1 mt-2">
                                    {step.options.map((opt, idx) => (
                                      <Badge key={idx} variant="outline" className="text-xs">
                                        {opt.label}{opt.next_step && <ChevronRight className="w-3 h-3 ml-1" />}
                                      </Badge>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <div className="flex gap-1 flex-shrink-0">
                                <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setSelectedStep(step); setShowStepEditor(true); }}><Settings className="w-4 h-4" /></Button>
                                <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleDuplicateStep(step); }}><Copy className="w-4 h-4" /></Button>
                                <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleDeleteStep(step.step_id); }} className="text-red-600 hover:text-red-700"><Trash2 className="w-4 h-4" /></Button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="outcomes">
          <OutcomeRulesConfig outcomeRules={outcomeRules} steps={steps} onChange={setOutcomeRules} />
        </TabsContent>
      </Tabs>

      {/* Save/Cancel */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button onClick={onCancel} variant="outline">Cancel</Button>
        <Button onClick={handleSave} className="bg-indigo-600 hover:bg-indigo-700 text-white">
          <Save className="w-4 h-4 mr-2" />Save Workflow
        </Button>
      </div>

      {/* Copy Workflow Steps Dialog */}
      <CopyWorkflowStepsDialog
        isOpen={showCopyStepsDialog}
        onClose={() => setShowCopyStepsDialog(false)}
        onCopySteps={handleCopyStepsFromOtherWorkflow}
        currentWorkflowId={workflow?.id}
      />

      {/* Step Editor Dialog */}
      <Dialog open={showStepEditor} onOpenChange={setShowStepEditor}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Edit Step: {selectedStep?.step_title}</DialogTitle>
          </DialogHeader>
          {selectedStep && (
            <StepEditor
              key={`step-editor-${selectedStep.step_id}`}
              step={steps.find(s => s.step_id === selectedStep.step_id) || selectedStep}
              allSteps={steps}
              onUpdate={handleUpdateStep}
              onClose={() => setShowStepEditor(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}