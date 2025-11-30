import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Target, X, HelpCircle, ChevronDown, ChevronUp } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function OutcomeRulesConfig({ outcomeRules = [], steps = [], onChange }) {
  const [expandedRules, setExpandedRules] = useState(
    outcomeRules.map((_, i) => i === 0) // Expand first rule by default
  );

  const handleAddRule = () => {
    const newRules = [
      ...outcomeRules,
      {
        result_classification: "",
        result_description: "",
        status_color: "green",
        conditions: [],
        account_context_items: []
      }
    ];
    onChange(newRules);
    setExpandedRules([...expandedRules, true]);
  };

  const handleRemoveRule = (index) => {
    const newRules = outcomeRules.filter((_, i) => i !== index);
    onChange(newRules);
    setExpandedRules(expandedRules.filter((_, i) => i !== index));
  };

  const handleRuleChange = (index, field, value) => {
    const newRules = [...outcomeRules];
    newRules[index] = { ...newRules[index], [field]: value };
    onChange(newRules);
  };

  const toggleExpanded = (index) => {
    const newExpanded = [...expandedRules];
    newExpanded[index] = !newExpanded[index];
    setExpandedRules(newExpanded);
  };

  // Condition handling
  const handleAddCondition = (ruleIndex) => {
    const newRules = [...outcomeRules];
    const currentConditions = newRules[ruleIndex].conditions || [];
    newRules[ruleIndex].conditions = [
      ...currentConditions,
      { step_id: "", operator: "=", value: "", logic_operator: "AND" }
    ];
    onChange(newRules);
  };

  const handleRemoveCondition = (ruleIndex, conditionIndex) => {
    const newRules = [...outcomeRules];
    newRules[ruleIndex].conditions = newRules[ruleIndex].conditions.filter((_, i) => i !== conditionIndex);
    onChange(newRules);
  };

  const handleConditionChange = (ruleIndex, conditionIndex, field, value) => {
    const newRules = [...outcomeRules];
    newRules[ruleIndex].conditions[conditionIndex] = {
      ...newRules[ruleIndex].conditions[conditionIndex],
      [field]: value
    };
    onChange(newRules);
  };

  // Context items handling
  const handleAddContextItem = (ruleIndex) => {
    const newRules = [...outcomeRules];
    const currentItems = newRules[ruleIndex].account_context_items || [];
    newRules[ruleIndex].account_context_items = [...currentItems, ""];
    onChange(newRules);
  };

  const handleRemoveContextItem = (ruleIndex, itemIndex) => {
    const newRules = [...outcomeRules];
    newRules[ruleIndex].account_context_items = newRules[ruleIndex].account_context_items.filter((_, i) => i !== itemIndex);
    onChange(newRules);
  };

  const handleContextItemChange = (ruleIndex, itemIndex, value) => {
    const newRules = [...outcomeRules];
    newRules[ruleIndex].account_context_items[itemIndex] = value;
    onChange(newRules);
  };

  const getStatusColorBadge = (color) => {
    const colors = {
      green: "bg-green-100 text-green-800 border-green-300",
      amber: "bg-amber-100 text-amber-800 border-amber-300",
      red: "bg-red-100 text-red-800 border-red-300",
      blue: "bg-blue-100 text-blue-800 border-blue-300"
    };
    return colors[color] || colors.green;
  };

  const getStatusColorLabel = (color) => {
    const labels = {
      green: "Reportable",
      amber: "Pending Review",
      red: "Non-Reportable / Excluded",
      blue: "Information"
    };
    return labels[color] || "Reportable";
  };

  // Convert legacy condition string to structured format if needed
  const migrateConditionString = (rule) => {
    if (rule.condition && typeof rule.condition === 'string' && (!rule.conditions || rule.conditions.length === 0)) {
      // Try to parse simple conditions like "step_id === 'value'"
      const match = rule.condition.match(/(\w+)\s*(===?|!==?|>|<|>=|<=)\s*['"]?([^'"]+)['"]?/);
      if (match) {
        return [{
          step_id: match[1],
          operator: match[2].replace('===', '=').replace('!==', '!='),
          value: match[3],
          logic_operator: "AND"
        }];
      }
    }
    return rule.conditions || [];
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <Target className="w-5 h-5 text-emerald-600" />
            Outcome Rules
          </h3>
          <p className="text-sm text-slate-600 mt-1">
            Define the final classification results based on workflow answers
          </p>
        </div>
        <Button onClick={handleAddRule} className="bg-emerald-600 hover:bg-emerald-700 text-white">
          <Plus className="w-4 h-4 mr-2" />
          Add Outcome Rule
        </Button>
      </div>

      {/* Info Alert */}
      <Alert className="bg-emerald-50 border-emerald-200">
        <HelpCircle className="w-4 h-4 text-emerald-600" />
        <AlertDescription className="text-sm text-emerald-900">
          <strong>How Outcome Rules Work:</strong> When the workflow reaches an end step, 
          the system evaluates each rule's conditions in order. The first rule where all conditions match 
          determines the final classification result shown to the user.
        </AlertDescription>
      </Alert>

      {/* Rules List */}
      {outcomeRules.length === 0 ? (
        <Card className="border-2 border-dashed border-slate-300 bg-slate-50">
          <CardContent className="py-12 text-center">
            <Target className="w-12 h-12 mx-auto text-slate-400 mb-4" />
            <h4 className="text-lg font-semibold text-slate-700 mb-2">No Outcome Rules Defined</h4>
            <p className="text-sm text-slate-500 mb-6">
              Add outcome rules to define what classification results appear when the workflow ends.
            </p>
            <Button onClick={handleAddRule} variant="outline">
              <Plus className="w-4 h-4 mr-2" />
              Add First Outcome Rule
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {outcomeRules.map((rule, ruleIndex) => {
            const conditions = migrateConditionString(rule);
            const isExpanded = expandedRules[ruleIndex];

            return (
              <Card key={ruleIndex} className="border-2 border-emerald-100 shadow-sm">
                {/* Collapsed Header */}
                <div
                  className={`flex items-center justify-between p-4 cursor-pointer hover:bg-emerald-50/50 transition-colors ${
                    isExpanded ? 'border-b border-emerald-100' : ''
                  }`}
                  onClick={() => toggleExpanded(ruleIndex)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-semibold text-sm">
                      {ruleIndex + 1}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900">
                          {rule.result_classification || "Untitled Rule"}
                        </span>
                        <Badge className={getStatusColorBadge(rule.status_color)}>
                          {getStatusColorLabel(rule.status_color)}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {conditions.length} condition(s) • {(rule.account_context_items || []).length} context item(s)
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveRule(ruleIndex);
                      }}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-slate-400" />
                    )}
                  </div>
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                  <CardContent className="p-6 space-y-6">
                    {/* Basic Info */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm font-medium">Result Classification (Status Badge) *</Label>
                        <Input
                          value={rule.result_classification || ""}
                          onChange={(e) => handleRuleChange(ruleIndex, 'result_classification', e.target.value)}
                          placeholder="e.g., Reportable, Non-Reportable, Pending Review"
                          className="mt-1.5"
                        />
                        <p className="text-xs text-slate-500 mt-1">
                          This text appears as the main status badge in the result
                        </p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium">Status Color</Label>
                        <Select
                          value={rule.status_color || "green"}
                          onValueChange={(value) => handleRuleChange(ruleIndex, 'status_color', value)}
                        >
                          <SelectTrigger className="mt-1.5">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="green">
                              <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-green-500" />
                                Green (Reportable)
                              </div>
                            </SelectItem>
                            <SelectItem value="amber">
                              <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-amber-500" />
                                Amber (Pending/Review)
                              </div>
                            </SelectItem>
                            <SelectItem value="red">
                              <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-red-500" />
                                Red (Non-Reportable/Excluded)
                              </div>
                            </SelectItem>
                            <SelectItem value="blue">
                              <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-blue-500" />
                                Blue (Information)
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Reason Description */}
                    <div>
                      <Label className="text-sm font-medium">Reason Description</Label>
                      <Textarea
                        value={rule.result_description || ""}
                        onChange={(e) => handleRuleChange(ruleIndex, 'result_description', e.target.value)}
                        placeholder="Explain why this classification was determined. This will be shown in the result summary."
                        rows={3}
                        className="mt-1.5"
                      />
                      <p className="text-xs text-slate-500 mt-1">
                        Detailed explanation shown in the classification result box
                      </p>
                    </div>

                    {/* Conditions Section */}
                    <div className="border-t pt-4">
                      <div className="flex items-center justify-between mb-3">
                        <Label className="text-sm font-semibold flex items-center gap-2">
                          <Target className="w-4 h-4 text-purple-600" />
                          When Conditions Match
                        </Label>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleAddCondition(ruleIndex)}
                        >
                          <Plus className="w-3 h-3 mr-1" />
                          Add Condition
                        </Button>
                      </div>

                      {conditions.length === 0 ? (
                        <div className="p-4 bg-slate-50 rounded-lg border border-dashed border-slate-300 text-center">
                          <p className="text-sm text-slate-600">
                            No conditions defined. This rule will always match.
                          </p>
                          <Button
                            size="sm"
                            variant="link"
                            onClick={() => handleAddCondition(ruleIndex)}
                            className="mt-2"
                          >
                            Add a condition
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {conditions.map((condition, condIndex) => (
                            <div key={condIndex} className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                              <div className="flex items-center justify-between mb-3">
                                <Badge variant="outline" className="bg-purple-100 text-purple-800">
                                  Condition {condIndex + 1}
                                </Badge>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleRemoveCondition(ruleIndex, condIndex)}
                                  className="h-6 w-6 text-red-600 hover:bg-red-50"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>

                              <div className="grid grid-cols-4 gap-3">
                                <div>
                                  <Label className="text-xs">Step</Label>
                                  <Select
                                    value={condition.step_id || ""}
                                    onValueChange={(value) => handleConditionChange(ruleIndex, condIndex, 'step_id', value)}
                                  >
                                    <SelectTrigger className="mt-1">
                                      <SelectValue placeholder="Select step..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {steps.map(s => (
                                        <SelectItem key={s.step_id} value={s.step_id}>
                                          {s.step_title}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>

                                <div>
                                  <Label className="text-xs">Operator</Label>
                                  <Select
                                    value={condition.operator || "="}
                                    onValueChange={(value) => handleConditionChange(ruleIndex, condIndex, 'operator', value)}
                                  >
                                    <SelectTrigger className="mt-1">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="=">Equals (=)</SelectItem>
                                      <SelectItem value="!=">Not Equals (≠)</SelectItem>
                                      <SelectItem value="contains">Contains</SelectItem>
                                      <SelectItem value="in">In (comma separated)</SelectItem>
                                      <SelectItem value="not_in">Not In</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>

                                <div>
                                  <Label className="text-xs">Value</Label>
                                  <Input
                                    value={condition.value || ""}
                                    onChange={(e) => handleConditionChange(ruleIndex, condIndex, 'value', e.target.value)}
                                    placeholder="e.g., YES, NO"
                                    className="mt-1"
                                  />
                                </div>

                                {condIndex < conditions.length - 1 && (
                                  <div>
                                    <Label className="text-xs">Logic</Label>
                                    <Select
                                      value={condition.logic_operator || "AND"}
                                      onValueChange={(value) => handleConditionChange(ruleIndex, condIndex, 'logic_operator', value)}
                                    >
                                      <SelectTrigger className="mt-1">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="AND">AND</SelectItem>
                                        <SelectItem value="OR">OR</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Context Items Section */}
                    <div className="border-t pt-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <Label className="text-sm font-semibold flex items-center gap-2">
                            Account Context Items
                          </Label>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Additional context shown in the blue info box
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleAddContextItem(ruleIndex)}
                        >
                          <Plus className="w-3 h-3 mr-1" />
                          Add Item
                        </Button>
                      </div>

                      {(!rule.account_context_items || rule.account_context_items.length === 0) ? (
                        <p className="text-sm text-slate-500 italic p-3 bg-slate-50 rounded-lg">
                          No context items. These appear as bullet points in the result summary.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {rule.account_context_items.map((item, itemIndex) => (
                            <div key={itemIndex} className="flex items-center gap-2">
                              <span className="text-slate-400">•</span>
                              <Input
                                value={item}
                                onChange={(e) => handleContextItemChange(ruleIndex, itemIndex, e.target.value)}
                                placeholder="e.g., Account Type: New Account (Jan 1, 2018 or later)"
                                className="flex-1"
                              />
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRemoveContextItem(ruleIndex, itemIndex)}
                                className="h-8 w-8 text-red-600 hover:bg-red-50"
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Preview */}
                    <div className="border-t pt-4">
                      <Label className="text-sm font-semibold mb-3 block">Preview</Label>
                      <div className={`p-4 rounded-lg border-2 ${
                        rule.status_color === 'green' ? 'bg-green-50 border-green-200' :
                        rule.status_color === 'amber' ? 'bg-amber-50 border-amber-200' :
                        rule.status_color === 'red' ? 'bg-red-50 border-red-200' :
                        'bg-blue-50 border-blue-200'
                      }`}>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-sm font-medium text-slate-700">Status:</span>
                          <Badge className={getStatusColorBadge(rule.status_color)}>
                            {rule.result_classification || "Classification"}
                          </Badge>
                        </div>
                        {rule.result_description && (
                          <p className="text-sm text-slate-700">
                            <span className="font-medium">Reason:</span> {rule.result_description}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}