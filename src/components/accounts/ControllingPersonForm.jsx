import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { XCircle, Save, Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import CountrySelect from "../shared/CountrySelect";

export default function ControllingPersonForm({ controllingPerson, account, onSubmit, onCancel }) {
  const [formData, setFormData] = useState(controllingPerson || {
    account_id: account?.id || "",
    first_name: "",
    last_name: "",
    date_of_birth: "",
    address: {
      street: "",
      city: "",
      state: "",
      postal_code: "",
      country: ""
    },
    tax_residencies: [{ country: "", tin: "", tin_unavailable_reason: "" }],
    control_type: "legal_person_ownership",
    ownership_percentage: 0,
    is_reportable: false
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleAddressChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      address: { ...prev.address, [field]: value }
    }));
  };

  const handleTaxResidencyChange = (index, field, value) => {
    const newResidencies = [...formData.tax_residencies];
    newResidencies[index] = { ...newResidencies[index], [field]: value };
    setFormData(prev => ({ ...prev, tax_residencies: newResidencies }));
  };

  const addTaxResidency = () => {
    setFormData(prev => ({
      ...prev,
      tax_residencies: [...prev.tax_residencies, { country: "", tin: "", tin_unavailable_reason: "" }]
    }));
  };

  const removeTaxResidency = (index) => {
    if (formData.tax_residencies.length > 1) {
      const newResidencies = formData.tax_residencies.filter((_, i) => i !== index);
      setFormData(prev => ({ ...prev, tax_residencies: newResidencies }));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic Information */}
      <Card className="border-2 border-indigo-100">
        <CardHeader className="bg-indigo-50/50">
          <CardTitle className="text-lg">Basic Information</CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="first_name">First Name *</Label>
              <Input
                id="first_name"
                value={formData.first_name || ""}
                onChange={(e) => handleChange("first_name", e.target.value)}
                placeholder="e.g., John"
                required
                className="mt-1.5"
              />
              <p className="text-xs text-slate-500 mt-1">Use 'NFN' if no first name available</p>
            </div>
            <div>
              <Label htmlFor="last_name">Last Name *</Label>
              <Input
                id="last_name"
                value={formData.last_name || ""}
                onChange={(e) => handleChange("last_name", e.target.value)}
                placeholder="e.g., Smith"
                required
                className="mt-1.5"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="date_of_birth">Date of Birth *</Label>
            <Input
              id="date_of_birth"
              type="date"
              value={formData.date_of_birth}
              onChange={(e) => handleChange("date_of_birth", e.target.value)}
              required
              className="mt-1.5"
            />
          </div>

          <div>
            <Label htmlFor="control_type">Type of Control *</Label>
            <Select
              value={formData.control_type}
              onValueChange={(value) => handleChange("control_type", value)}
            >
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="legal_person_ownership">Controlling Person of a legal person – control by ownership</SelectItem>
                <SelectItem value="legal_person_other_means">Controlling Person of a legal person – control by other means</SelectItem>
                <SelectItem value="legal_person_senior_managing_official">Controlling Person of a legal person – senior managing official</SelectItem>
                <SelectItem value="trust_settlor">Controlling Person of a trust - settlor</SelectItem>
                <SelectItem value="trust_trustee">Controlling Person of a trust – trustee</SelectItem>
                <SelectItem value="trust_protector">Controlling Person of a trust – protector</SelectItem>
                <SelectItem value="trust_beneficiary">Controlling Person of a trust – beneficiary</SelectItem>
                <SelectItem value="trust_other">Controlling Person of a trust – other</SelectItem>
                <SelectItem value="legal_arrangement_settlor_equivalent">Controlling Person of a legal arrangement (non-trust) – settlor-equivalent</SelectItem>
                <SelectItem value="legal_arrangement_trustee_equivalent">Controlling Person of a legal arrangement (non-trust) – trustee-equivalent</SelectItem>
                <SelectItem value="legal_arrangement_protector_equivalent">Controlling Person of a legal arrangement (non-trust) – protector-equivalent</SelectItem>
                <SelectItem value="legal_arrangement_beneficiary_equivalent">Controlling Person of a legal arrangement (non-trust) – beneficiary-equivalent</SelectItem>
                <SelectItem value="legal_arrangement_other_equivalent">Controlling Person of a legal arrangement (non-trust) – other-equivalent</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {formData.control_type === "legal_person_ownership" && (
            <div>
              <Label htmlFor="ownership_percentage">Ownership Percentage</Label>
              <Input
                id="ownership_percentage"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={formData.ownership_percentage}
                onChange={(e) => handleChange("ownership_percentage", parseFloat(e.target.value) || 0)}
                placeholder="e.g., 25.5"
                className="mt-1.5"
              />
              <p className="text-xs text-slate-500 mt-1">
                Percentage of ownership interest in the entity
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Address */}
      <Card className="border-2 border-indigo-100">
        <CardHeader className="bg-indigo-50/50">
          <CardTitle className="text-lg">Residential Address</CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div>
            <Label htmlFor="street">Street Address</Label>
            <Input
              id="street"
              value={formData.address.street}
              onChange={(e) => handleAddressChange("street", e.target.value)}
              className="mt-1.5"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                value={formData.address.city}
                onChange={(e) => handleAddressChange("city", e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="state">State/Province</Label>
              <Input
                id="state"
                value={formData.address.state}
                onChange={(e) => handleAddressChange("state", e.target.value)}
                className="mt-1.5"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="postal_code">Postal Code</Label>
              <Input
                id="postal_code"
                value={formData.address.postal_code}
                onChange={(e) => handleAddressChange("postal_code", e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="country">Country *</Label>
              <div className="mt-1.5">
                <CountrySelect
                  value={formData.address.country}
                  onValueChange={(value) => handleAddressChange("country", value)}
                  placeholder="Select country..."
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tax Residencies */}
      <Card className="border-2 border-indigo-100">
        <CardHeader className="bg-indigo-50/50">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Tax Residencies *</CardTitle>
            <Button type="button" size="sm" variant="outline" onClick={addTaxResidency}>
              <Plus className="w-4 h-4 mr-2" />
              Add Residency
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          {formData.tax_residencies.map((residency, index) => (
            <div key={index} className="p-4 rounded-lg border border-slate-200 bg-slate-50 space-y-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold text-slate-700">
                  Tax Residency {index + 1}
                </h4>
                {formData.tax_residencies.length > 1 && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => removeTaxResidency(index)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>

              <div>
                <Label htmlFor={`country_${index}`}>Country *</Label>
                <div className="mt-1.5">
                  <CountrySelect
                    value={residency.country}
                    onValueChange={(value) => handleTaxResidencyChange(index, "country", value)}
                    placeholder="Select country..."
                  />
                </div>
              </div>

              <div>
                <Label htmlFor={`tin_${index}`}>Tax Identification Number (TIN)</Label>
                <Input
                  id={`tin_${index}`}
                  value={residency.tin}
                  onChange={(e) => handleTaxResidencyChange(index, "tin", e.target.value)}
                  placeholder="e.g., 123-45-6789"
                  className="mt-1.5"
                />
              </div>

              {!residency.tin && (
                <div>
                  <Label htmlFor={`tin_unavailable_${index}`}>
                    TIN Unavailable Reason (if no TIN provided)
                  </Label>
                  <Input
                    id={`tin_unavailable_${index}`}
                    value={residency.tin_unavailable_reason}
                    onChange={(e) => handleTaxResidencyChange(index, "tin_unavailable_reason", e.target.value)}
                    placeholder="e.g., Country does not issue TINs"
                    className="mt-1.5"
                  />
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Reportability */}
      <Card className="border-2 border-amber-100 bg-amber-50/30">
        <CardContent className="p-6">
          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              id="is_reportable"
              checked={formData.is_reportable}
              onChange={(e) => handleChange("is_reportable", e.target.checked)}
              className="w-5 h-5 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
            />
            <div>
              <Label htmlFor="is_reportable" className="text-base font-semibold text-amber-900">
                Mark as Reportable
              </Label>
              <p className="text-sm text-amber-700 mt-1">
                Check this if the controlling person is tax resident in a foreign CRS participating jurisdiction. 
                This person's information will be included in CRS reporting.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-6 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>
          <XCircle className="w-4 h-4 mr-2" />
          Cancel
        </Button>
        <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white">
          <Save className="w-4 h-4 mr-2" />
          {controllingPerson ? "Update Controlling Person" : "Add Controlling Person"}
        </Button>
      </div>
    </form>
  );
}