import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";

export default function BulkUpdateForm({ selectedAccounts, onUpdate, onCancel, isLoading }) {
  const [selectedField, setSelectedField] = useState("");
  const [fieldValue, setFieldValue] = useState("");

  // Define updateable fields with their types and options
  const updateableFields = [
    {
      key: "reportability_status",
      label: "Reportability Status",
      type: "select",
      options: [
        { value: "pending_review", label: "Pending Review" },
        { value: "reportable", label: "Reportable" },
        { value: "non_reportable", label: "Non-Reportable" },
        { value: "excluded", label: "Excluded" }
      ]
    },
    {
      key: "status",
      label: "Account Status",
      type: "select",
      options: [
        { value: "active", label: "Active" },
        { value: "closed", label: "Closed" },
        { value: "dormant", label: "Dormant" }
      ]
    },
    {
      key: "account_type",
      label: "Account Type",
      type: "select",
      options: [
        { value: "depository", label: "Depository" },
        { value: "custodial", label: "Custodial" },
        { value: "equity_debt_interest", label: "Equity/Debt Interest" },
        { value: "cash_value_insurance", label: "Cash Value Insurance" },
        { value: "annuity", label: "Annuity" }
      ]
    },
    {
      key: "entity_classification",
      label: "Entity Classification",
      type: "select",
      options: [
        { value: "financial_institution", label: "Financial Institution" },
        { value: "active_nfe", label: "Active NFE" },
        { value: "passive_nfe", label: "Passive NFE" },
        { value: "not_applicable", label: "Not Applicable" }
      ]
    },
    {
      key: "reporting_year",
      label: "Reporting Year",
      type: "text"
    },
    {
      key: "year_end_cash_value_currency",
      label: "Currency",
      type: "text"
    }
  ];

  const selectedFieldConfig = updateableFields.find(f => f.key === selectedField);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!selectedField || !fieldValue) {
      alert("Please select a field and provide a value");
      return;
    }
    onUpdate(selectedField, fieldValue);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Alert>
        <AlertDescription>
          You are about to update <strong>{selectedAccounts.length}</strong> account{selectedAccounts.length !== 1 ? 's' : ''}
        </AlertDescription>
      </Alert>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="field-select">Select Field to Update</Label>
          <Select value={selectedField} onValueChange={(value) => {
            setSelectedField(value);
            setFieldValue(""); // Reset value when field changes
          }}>
            <SelectTrigger id="field-select">
              <SelectValue placeholder="Choose a field..." />
            </SelectTrigger>
            <SelectContent>
              {updateableFields.map((field) => (
                <SelectItem key={field.key} value={field.key}>
                  {field.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedFieldConfig && (
          <div className="space-y-2">
            <Label htmlFor="field-value">New Value for {selectedFieldConfig.label}</Label>
            {selectedFieldConfig.type === "select" ? (
              <Select value={fieldValue} onValueChange={setFieldValue}>
                <SelectTrigger id="field-value">
                  <SelectValue placeholder="Choose a value..." />
                </SelectTrigger>
                <SelectContent>
                  {selectedFieldConfig.options.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                id="field-value"
                value={fieldValue}
                onChange={(e) => setFieldValue(e.target.value)}
                placeholder={`Enter ${selectedFieldConfig.label.toLowerCase()}`}
              />
            )}
          </div>
        )}
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          Cancel
        </Button>
        <Button 
          type="submit" 
          disabled={!selectedField || !fieldValue || isLoading}
          className="bg-indigo-600 hover:bg-indigo-700"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Updating...
            </>
          ) : (
            `Update ${selectedAccounts.length} Account${selectedAccounts.length !== 1 ? 's' : ''}`
          )}
        </Button>
      </div>
    </form>
  );
}