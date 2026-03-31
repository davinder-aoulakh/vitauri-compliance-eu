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
import { Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";

const updateableFields = [
  {
    key: "control_type",
    label: "Control Type",
    type: "select",
    options: [
      { value: "legal_person_ownership", label: "Legal Person - Ownership" },
      { value: "legal_person_other_means", label: "Legal Person - Other Means" },
      { value: "legal_person_senior_managing_official", label: "Legal Person - Senior Managing Official" },
      { value: "trust_settlor", label: "Trust - Settlor" },
      { value: "trust_trustee", label: "Trust - Trustee" },
      { value: "trust_protector", label: "Trust - Protector" },
      { value: "trust_beneficiary", label: "Trust - Beneficiary" },
      { value: "trust_other", label: "Trust - Other" },
      { value: "legal_arrangement_settlor_equivalent", label: "Legal Arrangement - Settlor Equivalent" },
      { value: "legal_arrangement_trustee_equivalent", label: "Legal Arrangement - Trustee Equivalent" },
      { value: "legal_arrangement_protector_equivalent", label: "Legal Arrangement - Protector Equivalent" },
      { value: "legal_arrangement_beneficiary_equivalent", label: "Legal Arrangement - Beneficiary Equivalent" },
      { value: "legal_arrangement_other_equivalent", label: "Legal Arrangement - Other Equivalent" },
    ]
  },
  {
    key: "is_reportable",
    label: "Is Reportable",
    type: "select",
    options: [
      { value: "true", label: "Yes - Reportable" },
      { value: "false", label: "No - Non-Reportable" },
    ]
  },
  {
    key: "self_certification_obtained",
    label: "Self-Certification Obtained",
    type: "select",
    options: [
      { value: "true", label: "Yes" },
      { value: "false", label: "No" },
    ]
  },
  {
    key: "self_certification_request_date",
    label: "Self-Certification Request Date",
    type: "date"
  },
  {
    key: "us_person_indic",
    label: "US Person Indicator",
    type: "select",
    options: [
      { value: "true", label: "Yes - US Person" },
      { value: "false", label: "No" },
    ]
  },
  {
    key: "country_of_residence",
    label: "Country of Residence",
    type: "text"
  },
];

export default function ControllingPersonBulkUpdateForm({ selectedPersons, onUpdate, onCancel, isLoading }) {
  const [selectedField, setSelectedField] = useState("");
  const [fieldValue, setFieldValue] = useState("");
  const [showConfirmation, setShowConfirmation] = useState(false);

  const selectedFieldConfig = updateableFields.find(f => f.key === selectedField);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!selectedField || fieldValue === "") {
      alert("Please select a field and provide a value");
      return;
    }
    setShowConfirmation(true);
  };

  const handleConfirm = () => {
    let finalValue = fieldValue;
    if (selectedFieldConfig?.type === "select" && (fieldValue === "true" || fieldValue === "false")) {
      finalValue = fieldValue === "true";
    }
    onUpdate(selectedField, finalValue);
  };

  const getFieldLabel = () => updateableFields.find(f => f.key === selectedField)?.label || selectedField;
  const getValueLabel = () => {
    if (selectedFieldConfig?.type === "select") {
      return selectedFieldConfig.options.find(o => o.value === fieldValue)?.label || fieldValue;
    }
    return fieldValue;
  };

  if (showConfirmation) {
    return (
      <div className="space-y-6">
        <Alert className="bg-amber-50 border-amber-200">
          <AlertTriangle className="w-4 h-4 text-amber-600" />
          <AlertDescription className="text-amber-900">
            <strong>Confirm Bulk Update</strong>
            <div className="mt-3 space-y-2">
              <p>You are about to update <strong>{selectedPersons.length}</strong> controlling person{selectedPersons.length !== 1 ? 's' : ''}:</p>
              <div className="bg-white rounded p-3 border border-amber-200">
                <p className="font-semibold">Field: <span className="text-slate-900">{getFieldLabel()}</span></p>
                <p className="font-semibold">New Value: <span className="text-slate-900">{getValueLabel()}</span></p>
              </div>
            </div>
          </AlertDescription>
        </Alert>

        <div className="bg-slate-50 rounded-lg p-4 max-h-48 overflow-y-auto">
          <h4 className="text-sm font-semibold text-slate-700 mb-2">Affected Controlling Persons:</h4>
          <ul className="space-y-1">
            {selectedPersons.map((person) => (
              <li key={person.id} className="text-sm text-slate-600 flex items-center gap-2">
                <CheckCircle2 className="w-3 h-3 text-green-600" />
                <span className="font-medium">
                  {person.first_name && person.last_name
                    ? `${person.first_name} ${person.last_name}`
                    : person.full_name || "N/A"}
                </span>
                {person.control_type && (
                  <span className="text-slate-400 capitalize">({person.control_type.replace(/_/g, ' ')})</span>
                )}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button type="button" variant="outline" onClick={() => setShowConfirmation(false)} disabled={isLoading}>
            Back
          </Button>
          <Button onClick={handleConfirm} disabled={isLoading} className="bg-amber-600 hover:bg-amber-700 text-white">
            {isLoading ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Updating...</>
            ) : "Confirm Update"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Alert>
        <AlertDescription>
          You are about to update <strong>{selectedPersons.length}</strong> controlling person{selectedPersons.length !== 1 ? 's' : ''}
        </AlertDescription>
      </Alert>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Select Field to Update</Label>
          <Select value={selectedField} onValueChange={(v) => { setSelectedField(v); setFieldValue(""); }}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a field..." />
            </SelectTrigger>
            <SelectContent>
              {updateableFields.map((field) => (
                <SelectItem key={field.key} value={field.key}>{field.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedFieldConfig && (
          <div className="space-y-2">
            <Label>New Value for {selectedFieldConfig.label}</Label>
            {selectedFieldConfig.type === "select" ? (
              <Select value={fieldValue} onValueChange={setFieldValue}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a value..." />
                </SelectTrigger>
                <SelectContent>
                  {selectedFieldConfig.options.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                value={fieldValue}
                onChange={(e) => setFieldValue(e.target.value)}
                placeholder={`Enter ${selectedFieldConfig.label.toLowerCase()}`}
                type={selectedFieldConfig.type === "date" ? "date" : "text"}
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
          disabled={!selectedField || fieldValue === "" || isLoading}
          className="bg-indigo-600 hover:bg-indigo-700"
        >
          {isLoading ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Updating...</>
          ) : `Update ${selectedPersons.length} Person${selectedPersons.length !== 1 ? 's' : ''}`}
        </Button>
      </div>
    </form>
  );
}