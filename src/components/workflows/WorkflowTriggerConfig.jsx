import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, Info, Zap } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function WorkflowTriggerConfig({ triggerConditions, onUpdate }) {
  const [config, setConfig] = useState(triggerConditions || {
    enabled: false,
    trigger_event: 'account_created',
    conditions: [],
    computed_conditions: [],
    priority: 0
  });

  // Available fields for Account and Entity with type information
  const accountFields = [
    { value: 'account_holder_is_alive', label: 'Account Holder Is Alive', type: 'boolean', options: ['true', 'false'] },
    { value: 'account_holder_type', label: 'Account Holder Type', type: 'enum', options: ['individual', 'entity'] },
    { value: 'account_type', label: 'Account Type', type: 'enum', options: ['depository', 'custodial', 'equity_debt_interest', 'cash_value_insurance', 'annuity'] },
    { value: 'year_end_cash_value', label: 'Year-end Cash Value', type: 'number' },
    { value: 'gross_payments', label: 'Gross Payments', type: 'number' },
    { value: 'reportability_status', label: 'Reportability Status', type: 'enum', options: ['pending_review', 'reportable', 'non_reportable', 'excluded'] },
    { value: 'entity_classification', label: 'Entity Classification', type: 'enum', options: ['financial_institution', 'active_nfe', 'passive_nfe', 'not_applicable'] },
    { value: 'is_pre_existing', label: 'Pre-existing Account', type: 'boolean', options: ['true', 'false'] },
    { value: 'account_closed_during_period', label: 'Account Closed During Period', type: 'boolean', options: ['true', 'false'] },
    { value: 'self_certification_obtained', label: 'Self Certification Obtained', type: 'boolean', options: ['true', 'false'] },
    { value: 'country_of_residence', label: 'Country of Residence', type: 'string' },
    { value: 'account_holder_address.country', label: 'Account Holder Address Country', type: 'string' },
    { value: 'status', label: 'Status', type: 'enum', options: ['active', 'closed', 'dormant'] }
  ];

  const entityFields = [
    { value: 'entity_type', label: 'Entity Type', type: 'enum', options: ['corporation', 'trust', 'partnership', 'fund', 'branch', 'other'] },
    { value: 'rfi_status', label: 'RFI Status', type: 'enum', options: ['pending_classification', 'reporting_fi', 'non_reporting_fi', 'nfe_active', 'nfe_passive'] },
    { value: 'fi_type', label: 'FI Type', type: 'enum', options: ['custodial_institution', 'depository_institution', 'investment_entity', 'specified_insurance_company', 'not_applicable'] },
    { value: 'country_of_incorporation', label: 'Country of Incorporation', type: 'string' },
    { value: 'status', label: 'Status', type: 'enum', options: ['active', 'inactive'] }
  ];

  const availableFields = config.trigger_event?.includes('account') ? accountFields : entityFields;

  const handleAddCondition = () => {
    setConfig({
      ...config,
      conditions: [
        ...config.conditions,
        {
          field: '',
          operator: 'equals',
          value: '',
          logic_operator: 'AND'
        }
      ]
    });
  };

  const handleAddComputedCondition = () => {
    setConfig({
      ...config,
      computed_conditions: [
        ...config.computed_conditions,
        {
          expression: '',
          operator: 'greater_than',
          value: 0,
          logic_operator: 'AND'
        }
      ]
    });
  };

  const handleUpdateCondition = (index, field, value) => {
    const updated = [...config.conditions];
    updated[index] = { ...updated[index], [field]: value };
    setConfig({ ...config, conditions: updated });
  };

  const handleUpdateComputedCondition = (index, field, value) => {
    const updated = [...config.computed_conditions];
    updated[index] = { ...updated[index], [field]: value };
    setConfig({ ...config, computed_conditions: updated });
  };

  const handleRemoveCondition = (index) => {
    setConfig({
      ...config,
      conditions: config.conditions.filter((_, i) => i !== index)
    });
  };

  const handleRemoveComputedCondition = (index) => {
    setConfig({
      ...config,
      computed_conditions: config.computed_conditions.filter((_, i) => i !== index)
    });
  };

  const handleSave = () => {
    onUpdate(config);
  };

  return (
    <div className="space-y-6">
      <Alert className="bg-blue-50 border-blue-200">
        <Info className="w-4 h-4 text-blue-600" />
        <AlertDescription className="text-sm text-blue-900">
          Configure conditions to automatically trigger this workflow when accounts or entities are created/updated.
          For example: "If account_holder_is_alive = true AND year_end_cash_value + gross_payments &gt; 100000, trigger this workflow"
        </AlertDescription>
      </Alert>

      <Card className="border-0 shadow-lg">
        <CardHeader className="border-b bg-slate-50">
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-600" />
            Auto-Trigger Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <Checkbox
              checked={config.enabled}
              onCheckedChange={(checked) => setConfig({ ...config, enabled: checked })}
              id="trigger-enabled"
            />
            <Label htmlFor="trigger-enabled" className="cursor-pointer">
              Enable automatic workflow triggering
            </Label>
          </div>

          {config.enabled && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Trigger Event</Label>
                  <Select
                    value={config.trigger_event}
                    onValueChange={(value) => setConfig({ ...config, trigger_event: value })}
                  >
                    <SelectTrigger className="mt-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="account_created">Account Created</SelectItem>
                      <SelectItem value="account_updated">Account Updated</SelectItem>
                      <SelectItem value="entity_created">Entity Created</SelectItem>
                      <SelectItem value="entity_updated">Entity Updated</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Priority</Label>
                  <Input
                    type="number"
                    value={config.priority}
                    onChange={(e) => setConfig({ ...config, priority: parseInt(e.target.value) || 0 })}
                    placeholder="0"
                    className="mt-1.5"
                  />
                  <p className="text-xs text-slate-500 mt-1">Higher priority workflows trigger first</p>
                </div>
              </div>

              {/* Regular Conditions */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <Label className="text-sm font-semibold">Field Conditions</Label>
                  <Button
                    type="button"
                    onClick={handleAddCondition}
                    variant="outline"
                    size="sm"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Condition
                  </Button>
                </div>

                {config.conditions.length === 0 ? (
                  <div className="text-sm text-slate-500 text-center py-4 border-2 border-dashed rounded-lg">
                    No conditions defined. Click "Add Condition" to start.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {config.conditions.map((condition, index) => (
                      <Card key={index} className="border">
                        <CardContent className="p-3">
                          <div className="grid grid-cols-12 gap-3 items-center">
                            <div className="col-span-3">
                              <Select
                                value={condition.field}
                                onValueChange={(value) => handleUpdateCondition(index, 'field', value)}
                              >
                                <SelectTrigger className="h-8">
                                  <SelectValue placeholder="Select field..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {availableFields.map((field) => (
                                    <SelectItem key={field.value} value={field.value}>
                                      {field.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="col-span-3">
                              <Select
                                value={condition.operator}
                                onValueChange={(value) => handleUpdateCondition(index, 'operator', value)}
                              >
                                <SelectTrigger className="h-8">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="equals">Equals</SelectItem>
                                  <SelectItem value="not_equals">Not Equals</SelectItem>
                                  <SelectItem value="greater_than">Greater Than</SelectItem>
                                  <SelectItem value="less_than">Less Than</SelectItem>
                                  <SelectItem value="greater_than_or_equal">≥</SelectItem>
                                  <SelectItem value="less_than_or_equal">≤</SelectItem>
                                  <SelectItem value="contains">Contains</SelectItem>
                                  <SelectItem value="in">In (comma-separated)</SelectItem>
                                  <SelectItem value="not_in">Not In</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="col-span-3">
                              {(() => {
                                const selectedField = availableFields.find(f => f.value === condition.field);
                                const fieldType = selectedField?.type;
                                const fieldOptions = selectedField?.options;

                                // Render dropdown for enum and boolean fields
                                if ((fieldType === 'enum' || fieldType === 'boolean') && fieldOptions) {
                                  return (
                                    <Select
                                      value={condition.value}
                                      onValueChange={(value) => handleUpdateCondition(index, 'value', value)}
                                    >
                                      <SelectTrigger className="h-8">
                                        <SelectValue placeholder="Select value..." />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {fieldOptions.map((option) => (
                                          <SelectItem key={option} value={option}>
                                            {option}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  );
                                }

                                // Render number input for number fields
                                if (fieldType === 'number') {
                                  return (
                                    <Input
                                      type="number"
                                      placeholder="Value"
                                      value={condition.value}
                                      onChange={(e) => handleUpdateCondition(index, 'value', e.target.value)}
                                      size="sm"
                                    />
                                  );
                                }

                                // Default text input for string fields and others
                                return (
                                  <Input
                                    placeholder="Value"
                                    value={condition.value}
                                    onChange={(e) => handleUpdateCondition(index, 'value', e.target.value)}
                                    size="sm"
                                  />
                                );
                              })()}
                            </div>
                            <div className="col-span-2">
                              <Select
                                value={condition.logic_operator}
                                onValueChange={(value) => handleUpdateCondition(index, 'logic_operator', value)}
                              >
                                <SelectTrigger className="h-8">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="AND">AND</SelectItem>
                                  <SelectItem value="OR">OR</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="col-span-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleRemoveCondition(index)}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50 h-8 w-8"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>

              {/* Computed Conditions */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <Label className="text-sm font-semibold">Computed Conditions</Label>
                    <p className="text-xs text-slate-500">For conditions using multiple fields (e.g., field1 + field2 &gt; 100000)</p>
                  </div>
                  <Button
                    type="button"
                    onClick={handleAddComputedCondition}
                    variant="outline"
                    size="sm"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Computed
                  </Button>
                </div>

                {config.computed_conditions.length > 0 && (
                  <div className="space-y-2">
                    {config.computed_conditions.map((compCondition, index) => (
                      <Card key={index} className="border border-green-200 bg-green-50/30">
                        <CardContent className="p-3">
                          <div className="grid grid-cols-12 gap-3 items-center">
                            <div className="col-span-4">
                              <Input
                                placeholder="Expression (e.g., year_end_cash_value + gross_payments)"
                                value={compCondition.expression}
                                onChange={(e) => handleUpdateComputedCondition(index, 'expression', e.target.value)}
                                size="sm"
                              />
                              <p className="text-xs text-slate-500 mt-1">
                                Available fields: {availableFields.filter(f => f.value.includes('value') || f.value.includes('payments')).map(f => f.value).join(', ')}
                              </p>
                            </div>
                            <div className="col-span-2">
                              <Select
                                value={compCondition.operator}
                                onValueChange={(value) => handleUpdateComputedCondition(index, 'operator', value)}
                              >
                                <SelectTrigger className="h-8">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="greater_than">&gt;</SelectItem>
                                  <SelectItem value="less_than">&lt;</SelectItem>
                                  <SelectItem value="greater_than_or_equal">≥</SelectItem>
                                  <SelectItem value="less_than_or_equal">≤</SelectItem>
                                  <SelectItem value="equals">=</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="col-span-2">
                              <Input
                                type="number"
                                placeholder="Value"
                                value={compCondition.value}
                                onChange={(e) => handleUpdateComputedCondition(index, 'value', parseFloat(e.target.value) || 0)}
                                size="sm"
                              />
                            </div>
                            <div className="col-span-2">
                              <Select
                                value={compCondition.logic_operator}
                                onValueChange={(value) => handleUpdateComputedCondition(index, 'logic_operator', value)}
                              >
                                <SelectTrigger className="h-8">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="AND">AND</SelectItem>
                                  <SelectItem value="OR">OR</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="col-span-2">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleRemoveComputedCondition(index)}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50 h-8 w-8"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          <div className="flex justify-end pt-4 border-t">
            <Button onClick={handleSave} className="bg-indigo-600 hover:bg-indigo-700 text-white">
              Save Trigger Configuration
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}