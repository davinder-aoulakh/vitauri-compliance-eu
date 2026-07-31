import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Trash2,
  User,
  MapPin,
  CheckCircle2,
  Users,
  Save,
  Globe,
  AlertTriangle
} from "lucide-react";
import { toast } from "sonner";
import CountrySelect from "../shared/CountrySelect";

export default function ControllingPersonInputRenderer({ 
  account, 
  onControllingPersonsAdded,
  onPersonsChange,
  minPersons = 1,
  initialPersons,
  savedPersons
}) {


  const [persons, setPersons] = useState(() => {
    if (initialPersons && initialPersons.length > 0) {
      return initialPersons.map(p => ({
        id: p.id || `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        first_name: p.first_name || "",
        last_name: p.last_name || "",
        date_of_birth: p.date_of_birth || "",
        control_type: p.control_type || "legal_person_ownership",
        ownership_percentage: p.ownership_percentage || 0,
        address: p.address || {
          street: "",
          city: "",
          state: "",
          postal_code: "",
          country: ""
        },
        tax_residencies: p.tax_residencies || [{ country: "", tin: "" }]
      }));
    }
    return [createEmptyPerson()];
  });
  
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const queryClient = useQueryClient();

  function createEmptyPerson() {
    return {
      id: `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      first_name: "",
      last_name: "",
      date_of_birth: "",
      control_type: "legal_person_ownership",
      ownership_percentage: 0,
      address: {
        street: "",
        city: "",
        state: "",
        postal_code: "",
        country: ""
      },
      tax_residencies: [{ country: "", tin: "" }]
    };
  }

  const handleAddPerson = () => {
    const newPersons = [...persons, createEmptyPerson()];
    setPersons(newPersons);
    if (onPersonsChange) onPersonsChange(newPersons);
  };

  const handleRemovePerson = (index) => {
    if (persons.length <= minPersons) return;
    const newPersons = persons.filter((_, i) => i !== index);
    setPersons(newPersons);
    if (onPersonsChange) onPersonsChange(newPersons);
  };

  const handlePersonChange = (index, field, value) => {
    const newPersons = [...persons];
    if (field.startsWith("address.")) {
      const addressField = field.replace("address.", "");
      newPersons[index] = {
        ...newPersons[index],
        address: {
          ...newPersons[index].address,
          [addressField]: value
        }
      };
    } else {
      newPersons[index] = {
        ...newPersons[index],
        [field]: value
      };
    }
    setPersons(newPersons);
    if (onPersonsChange) onPersonsChange(newPersons);
    
    // Clear error for this field
    if (errors[`${index}.${field}`]) {
      const newErrors = { ...errors };
      delete newErrors[`${index}.${field}`];
      setErrors(newErrors);
    }
  };

  const handleTaxResidencyChange = (personIndex, residencyIndex, field, value) => {
    const newPersons = [...persons];
    const newResidencies = [...(newPersons[personIndex].tax_residencies || [])];
    newResidencies[residencyIndex] = {
      ...newResidencies[residencyIndex],
      [field]: value
    };
    newPersons[personIndex].tax_residencies = newResidencies;
    setPersons(newPersons);
    if (onPersonsChange) onPersonsChange(newPersons);
  };

  const handleAddTaxResidency = (personIndex) => {
    const newPersons = [...persons];
    newPersons[personIndex].tax_residencies = [
      ...(newPersons[personIndex].tax_residencies || []),
      { country: "", tin: "" }
    ];
    setPersons(newPersons);
    if (onPersonsChange) onPersonsChange(newPersons);
  };

  const handleRemoveTaxResidency = (personIndex, residencyIndex) => {
    const newPersons = [...persons];
    newPersons[personIndex].tax_residencies = newPersons[personIndex].tax_residencies.filter(
      (_, i) => i !== residencyIndex
    );
    setPersons(newPersons);
    if (onPersonsChange) onPersonsChange(newPersons);
  };

  // Calculate total ownership percentage across all persons with ownership-based control
  const totalOwnershipPercentage = persons.reduce((sum, p) => {
    if (p.control_type === "legal_person_ownership") {
      return sum + (parseFloat(p.ownership_percentage) || 0);
    }
    return sum;
  }, 0);

  const ownershipExceedsLimit = totalOwnershipPercentage > 100;
  const hasMultipleOwners = persons.filter(p => p.control_type === "legal_person_ownership").length > 1;

  const validatePersons = () => {
    const newErrors = {};
    
    persons.forEach((p, index) => {
      if (!p.first_name?.trim()) {
        newErrors[`${index}.first_name`] = "First name is required";
      }
      if (!p.last_name?.trim()) {
        newErrors[`${index}.last_name`] = "Last name is required";
      }
      if (!p.address?.country) {
        newErrors[`${index}.address.country`] = "Country is required";
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSaveAll = async () => {
    if (savedPersons && savedPersons.length > 0) {
      if (onControllingPersonsAdded) {
        onControllingPersonsAdded(savedPersons);
      }
      return;
    }

    if (!validatePersons()) return;

    // Block submission if total ownership exceeds 100%
    if (ownershipExceedsLimit) {
      toast.error(`Total ownership percentage (${totalOwnershipPercentage.toFixed(1)}%) exceeds 100%. Please correct before saving.`);
      return;
    }

    setSaving(true);
    
    try {
      // Check for already-existing persons in DB to prevent duplicates on re-classify
      const existing = await base44.entities.ControllingPerson.filter({ account_id: account.id });
      const existingNames = new Set(
        existing.map(p => `${(p.first_name || '').toLowerCase().trim()}|${(p.last_name || '').toLowerCase().trim()}`)
      );

      const savedPers = [];
      
      for (const p of persons) {
        const nameKey = `${(p.first_name || '').toLowerCase().trim()}|${(p.last_name || '').toLowerCase().trim()}`;
        
        // Skip if this person already exists in DB
        if (existingNames.has(nameKey)) {
          const existingPerson = existing.find(ep =>
            `${(ep.first_name || '').toLowerCase().trim()}|${(ep.last_name || '').toLowerCase().trim()}` === nameKey
          );
          if (existingPerson) savedPers.push(existingPerson);
          continue;
        }

        const personData = {
          tenant_id: account?.tenant_id,
          account_id: account.id,
          first_name: p.first_name,
          last_name: p.last_name,
          date_of_birth: p.date_of_birth || null,
          control_type: p.control_type,
          ownership_percentage: parseFloat(p.ownership_percentage) || 0,
          address: p.address,
          tax_residencies: p.tax_residencies?.filter(tr => tr.country) || [],
          is_reportable: null
        };
        
        const created = await base44.entities.ControllingPerson.create(personData);
        savedPers.push(created);
      }

      queryClient.invalidateQueries(['controlling-persons', account?.id]);
      queryClient.invalidateQueries(['account-fresh', account?.id]);
      
      toast.success(`${savedPers.length} controlling person(s) saved successfully!`);
      
      if (onControllingPersonsAdded) {
        onControllingPersonsAdded(savedPers);
      }
    } catch (error) {
      console.error("[ControllingPersonInputRenderer] Error saving controlling persons:", error);
      toast.error("Failed to save controlling persons. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const isValid = persons.every(p => p.first_name?.trim() && p.last_name?.trim() && p.address?.country);
  const alreadySaved = savedPersons && savedPersons.length > 0;

  return (
    <div className="space-y-4">
      {alreadySaved && (
        <Alert className="bg-green-50 border-green-200">
          <CheckCircle2 className="w-4 h-4 text-green-600" />
          <AlertDescription className="text-sm text-green-900">
            <strong>Saved:</strong> {savedPersons.length} controlling person(s) have been saved successfully.
          </AlertDescription>
        </Alert>
      )}

      <Alert className="bg-purple-50 border-purple-200">
        <Users className="w-4 h-4 text-purple-600" />
        <AlertDescription className="text-sm text-purple-900">
          <strong>Add Controlling Persons:</strong> Enter details of individuals who exercise control over this entity 
          (ownership &gt;25% or senior management). Any controlling person with foreign tax residency will make this account reportable.
        </AlertDescription>
      </Alert>

      <div className="space-y-4">
        {persons.map((person, index) => (
          <Card key={person.id} className="border-2 border-purple-100">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                    <User className="w-4 h-4 text-purple-600" />
                  </div>
                  <span className="font-semibold text-slate-900">
                    Controlling Person {index + 1}
                  </span>
                </div>
                {persons.length > minPersons && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemovePerson(index)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm">First Name *</Label>
                  <Input
                    value={person.first_name}
                    onChange={(e) => handlePersonChange(index, "first_name", e.target.value)}
                    placeholder="First name"
                    className={`mt-1 ${errors[`${index}.first_name`] ? 'border-red-500' : ''}`}
                  />
                  {errors[`${index}.first_name`] && (
                    <p className="text-xs text-red-600 mt-1">{errors[`${index}.first_name`]}</p>
                  )}
                </div>

                <div>
                  <Label className="text-sm">Last Name *</Label>
                  <Input
                    value={person.last_name}
                    onChange={(e) => handlePersonChange(index, "last_name", e.target.value)}
                    placeholder="Last name"
                    className={`mt-1 ${errors[`${index}.last_name`] ? 'border-red-500' : ''}`}
                  />
                  {errors[`${index}.last_name`] && (
                    <p className="text-xs text-red-600 mt-1">{errors[`${index}.last_name`]}</p>
                  )}
                </div>

                <div>
                  <Label className="text-sm">Date of Birth</Label>
                  <Input
                    type="date"
                    value={person.date_of_birth}
                    onChange={(e) => handlePersonChange(index, "date_of_birth", e.target.value)}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label className="text-sm">Control Type</Label>
                  <Select
                    value={person.control_type}
                    onValueChange={(value) => handlePersonChange(index, "control_type", value)}
                  >
                    <SelectTrigger className="mt-1">
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

                {person.control_type === "legal_person_ownership" && (
                  <div>
                    <Label className="text-sm">Ownership Percentage</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={person.ownership_percentage}
                      onChange={(e) => handlePersonChange(index, "ownership_percentage", e.target.value)}
                      placeholder="e.g., 30"
                      className="mt-1"
                    />
                  </div>
                )}
              </div>

              {/* Address */}
              <div className="mt-4 pt-4 border-t">
                <div className="flex items-center gap-2 mb-3">
                  <MapPin className="w-4 h-4 text-slate-500" />
                  <span className="text-sm font-medium text-slate-700">Address</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <Label className="text-xs">Street Address</Label>
                    <Input
                      value={person.address.street}
                      onChange={(e) => handlePersonChange(index, "address.street", e.target.value)}
                      placeholder="123 Main Street"
                      className="mt-1 h-9"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">City</Label>
                    <Input
                      value={person.address.city}
                      onChange={(e) => handlePersonChange(index, "address.city", e.target.value)}
                      placeholder="City"
                      className="mt-1 h-9"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">State/Province</Label>
                    <Input
                      value={person.address.state}
                      onChange={(e) => handlePersonChange(index, "address.state", e.target.value)}
                      placeholder="State"
                      className="mt-1 h-9"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Postal Code</Label>
                    <Input
                      value={person.address.postal_code}
                      onChange={(e) => handlePersonChange(index, "address.postal_code", e.target.value)}
                      placeholder="Postal Code"
                      className="mt-1 h-9"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Country *</Label>
                    <div className="mt-1">
                      <CountrySelect
                        value={person.address.country}
                        onValueChange={(value) => handlePersonChange(index, "address.country", value)}
                        placeholder="Select..."
                        className={errors[`${index}.address.country`] ? 'border-red-500' : ''}
                      />
                    </div>
                    {errors[`${index}.address.country`] && (
                      <p className="text-xs text-red-600 mt-1">{errors[`${index}.address.country`]}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Tax Residencies */}
              <div className="mt-4 pt-4 border-t">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-slate-500" />
                    <span className="text-sm font-medium text-slate-700">Tax Residencies</span>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleAddTaxResidency(index)}
                    className="h-7 text-xs"
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Add
                  </Button>
                </div>
                <div className="space-y-2">
                  {person.tax_residencies?.map((residency, rIndex) => (
                    <div key={rIndex} className="flex gap-2 items-end">
                      <div className="flex-1">
                        <Label className="text-xs">Country</Label>
                        <div className="mt-1">
                          <CountrySelect
                            value={residency.country}
                            onValueChange={(value) => handleTaxResidencyChange(index, rIndex, "country", value)}
                            placeholder="Select..."
                          />
                        </div>
                      </div>
                      <div className="flex-1">
                        <Label className="text-xs">TIN</Label>
                        <Input
                          value={residency.tin}
                          onChange={(e) => handleTaxResidencyChange(index, rIndex, "tin", e.target.value)}
                          placeholder="Tax ID Number"
                          className="mt-1 h-9"
                        />
                      </div>
                      {person.tax_residencies.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveTaxResidency(index, rIndex)}
                          className="text-red-600 h-9 px-2"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {!alreadySaved && (
        <div className="space-y-3 pt-4">
          <div className="flex items-center justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={handleAddPerson}
              className="border-purple-200 text-purple-700 hover:bg-purple-50"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Another Controlling Person
            </Button>

            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-purple-50 text-purple-700">
                {persons.length} person(s)
              </Badge>
              {isValid && !ownershipExceedsLimit && (
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              )}
            </div>
          </div>

          {/* Running ownership total — only shown when there are ownership-type persons */}
          {persons.some(p => p.control_type === "legal_person_ownership") && (
            <div className={`flex items-center justify-between px-4 py-2.5 rounded-lg border text-sm font-medium ${
              ownershipExceedsLimit
                ? "bg-red-50 border-red-300 text-red-700"
                : totalOwnershipPercentage === 100
                ? "bg-green-50 border-green-300 text-green-700"
                : "bg-slate-50 border-slate-200 text-slate-700"
            }`}>
              <span className="flex items-center gap-2">
                {ownershipExceedsLimit && <AlertTriangle className="w-4 h-4" />}
                Total Ownership Allocated
              </span>
              <span className={`text-base font-bold ${ownershipExceedsLimit ? "text-red-700" : totalOwnershipPercentage === 100 ? "text-green-700" : "text-slate-900"}`}>
                {totalOwnershipPercentage.toFixed(1)}% / 100%
              </span>
            </div>
          )}

          {/* Inline error when limit exceeded */}
          {ownershipExceedsLimit && (
            <Alert className="bg-red-50 border-red-300">
              <AlertTriangle className="w-4 h-4 text-red-600" />
              <AlertDescription className="text-sm text-red-800">
                <strong>Ownership exceeds 100%:</strong> The combined ownership percentage is{" "}
                <strong>{totalOwnershipPercentage.toFixed(1)}%</strong>. Total ownership across all controlling
                persons cannot exceed 100%. Please review and correct the percentages before saving.
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}

      <Button
        type="button"
        onClick={handleSaveAll}
        disabled={!isValid || saving || alreadySaved || ownershipExceedsLimit}
        className="w-full bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50"
      >
        <Save className="w-4 h-4 mr-2" />
        {saving ? "Saving..." : alreadySaved ? `Saved ${savedPersons.length} Controlling Person(s) ✓` : `Save ${persons.length} Controlling Person(s) & Continue`}
      </Button>
    </div>
  );
}