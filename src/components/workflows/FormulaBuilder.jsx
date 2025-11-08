import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Calculator,
  Plus,
  X,
  Check,
  Zap,
  HelpCircle
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function FormulaBuilder({ onSave, initialFormula }) {
  const [conditions, setConditions] = useState(initialFormula?.conditions || []);
  const [formula, setFormula] = useState(initialFormula?.formula || "");
  const [testValues, setTestValues] = useState({});
  const [testResult, setTestResult] = useState(null);

  const operators = [
    { value: "=", label: "Equals (=)" },
    { value: "!=", label: "Not Equals (≠)" },
    { value: ">", label: "Greater Than (>)" },
    { value: "<", label: "Less Than (<)" },
    { value: ">=", label: "Greater or Equal (≥)" },
    { value: "<=", label: "Less or Equal (≤)" },
    { value: "contains", label: "Contains" },
    { value: "in", label: "In List" },
    { value: "not_in", label: "Not In List" }
  ];

  const logicOperators = [
    { value: "AND", label: "AND" },
    { value: "OR", label: "OR" }
  ];

  const fieldTypes = [
    { value: "text", label: "Text" },
    { value: "number", label: "Number" },
    { value: "date", label: "Date" },
    { value: "boolean", label: "Boolean" }
  ];

  const handleAddCondition = () => {
    setConditions([
      ...conditions,
      {
        field: "",
        operator: "=",
        value: "",
        fieldType: "text",
        logicOperator: conditions.length > 0 ? "AND" : null
      }
    ]);
  };

  const handleUpdateCondition = (index, field, value) => {
    const newConditions = [...conditions];
    newConditions[index] = { ...newConditions[index], [field]: value };
    setConditions(newConditions);
    generateFormula(newConditions);
  };

  const handleRemoveCondition = (index) => {
    const newConditions = conditions.filter((_, i) => i !== index);
    setConditions(newConditions);
    generateFormula(newConditions);
  };

  const generateFormula = (conds) => {
    if (conds.length === 0) {
      setFormula("");
      return;
    }

    let formulaStr = "";
    conds.forEach((cond, idx) => {
      if (idx > 0 && cond.logicOperator) {
        formulaStr += ` ${cond.logicOperator} `;
      }
      
      let valueStr = cond.value;
      if (cond.fieldType === "text") {
        valueStr = `"${cond.value}"`;
      }
      
      formulaStr += `${cond.field} ${cond.operator} ${valueStr}`;
    });

    setFormula(formulaStr);
  };

  const evaluateFormula = () => {
    try {
      let result = true;
      let currentOp = null;

      conditions.forEach((cond, idx) => {
        const fieldValue = testValues[cond.field];
        let condResult = false;

        // Convert values based on type
        let compareValue = cond.value;
        let testValue = fieldValue;

        if (cond.fieldType === "number") {
          compareValue = parseFloat(cond.value);
          testValue = parseFloat(fieldValue);
        }

        // Evaluate condition
        switch (cond.operator) {
          case "=":
            condResult = testValue == compareValue;
            break;
          case "!=":
            condResult = testValue != compareValue;
            break;
          case ">":
            condResult = testValue > compareValue;
            break;
          case "<":
            condResult = testValue < compareValue;
            break;
          case ">=":
            condResult = testValue >= compareValue;
            break;
          case "<=":
            condResult = testValue <= compareValue;
            break;
          case "contains":
            condResult = String(testValue).includes(String(compareValue));
            break;
          case "in":
            condResult = compareValue.split(",").map(v => v.trim()).includes(String(testValue));
            break;
          case "not_in":
            condResult = !compareValue.split(",").map(v => v.trim()).includes(String(testValue));
            break;
        }

        // Combine with previous result
        if (idx === 0) {
          result = condResult;
        } else {
          if (cond.logicOperator === "AND") {
            result = result && condResult;
          } else if (cond.logicOperator === "OR") {
            result = result || condResult;
          }
        }
      });

      setTestResult(result);
    } catch (error) {
      setTestResult(null);
      alert("Error evaluating formula: " + error.message);
    }
  };

  const handleSave = () => {
    onSave({
      conditions,
      formula
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Calculator className="w-6 h-6 text-indigo-600" />
            Formula Builder
          </h3>
          <p className="text-sm text-slate-600">Create complex conditional logic with visual tools</p>
        </div>
      </div>

      {/* Conditions */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-transparent">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Conditions</CardTitle>
            <Button onClick={handleAddCondition} size="sm" variant="outline">
              <Plus className="w-4 h-4 mr-1" />
              Add Condition
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          {conditions.length === 0 ? (
            <div className="text-center py-8">
              <Calculator className="w-12 h-12 mx-auto mb-3 text-slate-300" />
              <p className="text-slate-600 mb-4">No conditions added yet</p>
              <Button onClick={handleAddCondition} variant="outline">
                <Plus className="w-4 h-4 mr-2" />
                Add First Condition
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {conditions.map((condition, index) => (
                <div key={index} className="space-y-3">
                  {/* Logic Operator (for 2nd+ conditions) */}
                  {index > 0 && (
                    <div className="flex justify-center">
                      <Select
                        value={condition.logicOperator || "AND"}
                        onValueChange={(value) => handleUpdateCondition(index, "logicOperator", value)}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {logicOperators.map((op) => (
                            <SelectItem key={op.value} value={op.value}>
                              {op.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Condition Row */}
                  <div className="p-4 border-2 border-slate-200 rounded-lg bg-slate-50">
                    <div className="grid grid-cols-12 gap-3 items-end">
                      {/* Field */}
                      <div className="col-span-3">
                        <Label className="text-xs text-slate-600 mb-1.5">Field</Label>
                        <Input
                          placeholder="field_name"
                          value={condition.field}
                          onChange={(e) => handleUpdateCondition(index, "field", e.target.value)}
                        />
                      </div>

                      {/* Field Type */}
                      <div className="col-span-2">
                        <Label className="text-xs text-slate-600 mb-1.5">Type</Label>
                        <Select
                          value={condition.fieldType}
                          onValueChange={(value) => handleUpdateCondition(index, "fieldType", value)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {fieldTypes.map((type) => (
                              <SelectItem key={type.value} value={type.value}>
                                {type.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Operator */}
                      <div className="col-span-3">
                        <Label className="text-xs text-slate-600 mb-1.5">Operator</Label>
                        <Select
                          value={condition.operator}
                          onValueChange={(value) => handleUpdateCondition(index, "operator", value)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {operators.map((op) => (
                              <SelectItem key={op.value} value={op.value}>
                                {op.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Value */}
                      <div className="col-span-3">
                        <Label className="text-xs text-slate-600 mb-1.5">Value</Label>
                        <Input
                          placeholder="value"
                          value={condition.value}
                          onChange={(e) => handleUpdateCondition(index, "value", e.target.value)}
                          type={condition.fieldType === "number" ? "number" : "text"}
                        />
                      </div>

                      {/* Remove Button */}
                      <div className="col-span-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveCondition(index)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Generated Formula */}
      {formula && (
        <Card className="border-2 border-indigo-200 bg-indigo-50/30">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Zap className="w-5 h-5 text-indigo-600 mt-0.5" />
              <div className="flex-1">
                <p className="text-xs font-medium text-indigo-900 mb-2">Generated Formula:</p>
                <code className="block bg-white p-3 rounded border border-indigo-200 text-sm font-mono text-slate-900">
                  {formula}
                </code>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Test Formula */}
      {conditions.length > 0 && (
        <Card className="border-0 shadow-lg">
          <CardHeader className="border-b bg-gradient-to-r from-green-50 to-transparent">
            <CardTitle className="text-lg flex items-center gap-2">
              <Check className="w-5 h-5 text-green-600" />
              Test Formula
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {conditions.map((condition, index) => (
                  <div key={index}>
                    <Label className="text-sm text-slate-700 mb-1.5">
                      {condition.field || `Field ${index + 1}`}
                    </Label>
                    <Input
                      placeholder={`Test value for ${condition.field}`}
                      value={testValues[condition.field] || ""}
                      onChange={(e) => setTestValues({
                        ...testValues,
                        [condition.field]: e.target.value
                      })}
                      type={condition.fieldType === "number" ? "number" : "text"}
                    />
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-3">
                <Button onClick={evaluateFormula} className="bg-green-600 hover:bg-green-700 text-white">
                  <Check className="w-4 h-4 mr-2" />
                  Evaluate Formula
                </Button>

                {testResult !== null && (
                  <Alert className={testResult ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}>
                    <AlertDescription className={`text-sm font-medium ${testResult ? "text-green-900" : "text-red-900"}`}>
                      Result: <strong>{testResult ? "TRUE ✓" : "FALSE ✗"}</strong>
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Help */}
      <Alert className="bg-blue-50 border-blue-200">
        <HelpCircle className="w-4 h-4 text-blue-600" />
        <AlertDescription className="text-sm text-blue-900">
          <strong>Tip:</strong> Use field names that match your workflow data (e.g., account_balance, country, age).
          The formula will be evaluated during workflow execution to determine branching.
        </AlertDescription>
      </Alert>

      {/* Save Button */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button onClick={handleSave} className="bg-indigo-600 hover:bg-indigo-700 text-white">
          <Check className="w-4 h-4 mr-2" />
          Save Formula
        </Button>
      </div>
    </div>
  );
}