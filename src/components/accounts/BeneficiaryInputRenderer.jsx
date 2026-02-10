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
  Plus,
  Trash2,
  User,
  MapPin,
  CheckCircle2,
  Users,
  Save
} from "lucide-react";
import { toast } from "sonner";
import CountrySelect from "../shared/CountrySelect";

export default function BeneficiaryInputRenderer({ 
  account, 
  tenant, 
  onBeneficiariesAdded,
  onBeneficiariesChange,
  minBeneficiaries = 1,
  initialBeneficiaries,
  savedBeneficiaries
}) {
  console.log('[BeneficiaryInputRenderer] Component rendered');
  console.log('[BeneficiaryInputRenderer] Props:', { 
    accountId: account?.id,
    hasOnBeneficiariesChange: !!onBeneficiariesChange,
    hasInitialBeneficiaries: !!initialBeneficiaries,
    initialBeneficiariesLength: initialBeneficiaries?.length,
    hasSavedBeneficiaries: !!savedBeneficiaries,
    savedBeneficiariesLength: savedBeneficiaries?.length
  });

  const [beneficiaries, setBeneficiaries] = useState(() => {
    console.log('[BeneficiaryInputRenderer] Initializing beneficiaries state');
    if (initialBeneficiaries && initialBeneficiaries.length > 0) {
      console.log('[BeneficiaryInputRenderer] Using initialBeneficiaries:', initialBeneficiaries);
      return initialBeneficiaries.map(b => ({
        id: b.id || `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        first_name: b.first_name || "",
        last_name: b.last_name || "",
        date_of_birth: b.date_of_birth || "",
        place_of_birth: b.place_of_birth || "",
        address: b.address || {
          street: "",
          city: "",
          state: "",
          postal_code: "",
          country: ""
        }
      }));
    }
    console.log('[BeneficiaryInputRenderer] No initialBeneficiaries, creating empty beneficiary');
    return [createEmptyBeneficiary()];
  });
  
  const [errors, setErrors] = useState({});

  const queryClient = useQueryClient();

  // Check for existing beneficiaries to avoid duplicates
  const { data: existingBeneficiaries = [] } = useQuery({
    queryKey: ['beneficiaries', account?.id],
    queryFn: () => base44.entities.Beneficiary.filter({ account_id: account?.id }),
    enabled: !!account?.id
  });

  function createEmptyBeneficiary() {
    return {
      id: `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      first_name: "",
      last_name: "",
      date_of_birth: "",
      place_of_birth: "",
      address: {
        street: "",
        city: "",
        state: "",
        postal_code: "",
        country: ""
      }
    };
  }

  const handleAddBeneficiary = () => {
    console.log('[BeneficiaryInputRenderer] Adding new beneficiary');
    const newBeneficiaries = [...beneficiaries, createEmptyBeneficiary()];
    setBeneficiaries(newBeneficiaries);
    if (onBeneficiariesChange) {
      console.log('[BeneficiaryInputRenderer] Calling onBeneficiariesChange after add');
      onBeneficiariesChange(newBeneficiaries);
    }
  };

  const handleRemoveBeneficiary = (index) => {
    if (beneficiaries.length <= minBeneficiaries) {
      return;
    }
    console.log('[BeneficiaryInputRenderer] Removing beneficiary at index:', index);
    const newBeneficiaries = beneficiaries.filter((_, i) => i !== index);
    setBeneficiaries(newBeneficiaries);
    if (onBeneficiariesChange) {
      console.log('[BeneficiaryInputRenderer] Calling onBeneficiariesChange after remove');
      onBeneficiariesChange(newBeneficiaries);
    }
  };

  const handleBeneficiaryChange = (index, field, value) => {
    console.log(`[BeneficiaryInputRenderer] Beneficiary ${index} field "${field}" changed to:`, value);
    const newBeneficiaries = [...beneficiaries];
    if (field.startsWith("address.")) {
      const addressField = field.replace("address.", "");
      newBeneficiaries[index] = {
        ...newBeneficiaries[index],
        address: {
          ...newBeneficiaries[index].address,
          [addressField]: value
        }
      };
    } else {
      newBeneficiaries[index] = {
        ...newBeneficiaries[index],
        [field]: value
      };
    }
    setBeneficiaries(newBeneficiaries);
    
    // Notify parent of changes
    if (onBeneficiariesChange) {
      console.log('[BeneficiaryInputRenderer] Calling onBeneficiariesChange after field change');
      onBeneficiariesChange(newBeneficiaries);
    }
    
    // Clear error for this field
    if (errors[`${index}.${field}`]) {
      const newErrors = { ...errors };
      delete newErrors[`${index}.${field}`];
      setErrors(newErrors);
    }
  };

  const validateBeneficiaries = () => {
    const newErrors = {};
    
    beneficiaries.forEach((b, index) => {
      if (!b.first_name?.trim()) {
        newErrors[`${index}.first_name`] = "First name is required";
      }
      if (!b.last_name?.trim()) {
        newErrors[`${index}.last_name`] = "Last name is required";
      }
      if (!b.address?.country) {
        newErrors[`${index}.address.country`] = "Country is required";
      }
    });

    setErrors(newErrors);
    console.log('[BeneficiaryInputRenderer] Validation result:', { 
      isValid: Object.keys(newErrors).length === 0, 
      errors: newErrors 
    });
    return Object.keys(newErrors).length === 0;
  };

  const handleSaveAll = async () => {
    console.log('[BeneficiaryInputRenderer] handleSaveAll called');
    console.log('[BeneficiaryInputRenderer] savedBeneficiaries:', savedBeneficiaries);
    console.log('[BeneficiaryInputRenderer] beneficiaries to save:', beneficiaries);

    if (savedBeneficiaries && savedBeneficiaries.length > 0) {
      console.log('[BeneficiaryInputRenderer] Already saved, calling callback with existing data');
      if (onBeneficiariesAdded) {
        onBeneficiariesAdded(savedBeneficiaries);
      }
      return;
    }

    if (!validateBeneficiaries()) {
      console.log('[BeneficiaryInputRenderer] Validation failed, aborting save');
      return;
    }

    console.log('[BeneficiaryInputRenderer] Starting save process...');
    
    try {
      const savedBenefs = [];
      
      for (const b of beneficiaries) {
        console.log('[BeneficiaryInputRenderer] Saving beneficiary:', b);
        
        // Check if a beneficiary with the same name already exists for this account
        const existingMatch = existingBeneficiaries.find(
          existing => 
            existing.first_name?.toLowerCase().trim() === b.first_name?.toLowerCase().trim() &&
            existing.last_name?.toLowerCase().trim() === b.last_name?.toLowerCase().trim()
        );
        
        if (existingMatch) {
          console.log('[BeneficiaryInputRenderer] Found existing match, using:', existingMatch);
          savedBenefs.push(existingMatch);
          continue;
        }

        const beneficiaryData = {
          tenant_id: tenant?.id || account?.tenant_id,
          account_id: account.id,
          first_name: b.first_name,
          last_name: b.last_name,
          date_of_birth: b.date_of_birth || null,
          place_of_birth: b.place_of_birth || null,
          address: b.address,
          reportability_status: "pending_review"
        };
        
        console.log('[BeneficiaryInputRenderer] Creating beneficiary with data:', beneficiaryData);
        const created = await base44.entities.Beneficiary.create(beneficiaryData);
        console.log('[BeneficiaryInputRenderer] Beneficiary created:', created);
        savedBenefs.push(created);
      }

      console.log('[BeneficiaryInputRenderer] All beneficiaries saved:', savedBenefs);
      queryClient.invalidateQueries(['beneficiaries', account?.id]);
      
      console.log('[BeneficiaryInputRenderer] Showing success toast');
      toast.success(`${savedBenefs.length} beneficiary(ies) saved successfully!`);
      
      // Update beneficiaries count on Account
      try {
        await base44.entities.Account.update(account.id, {
          beneficiaries_count: savedBenefs.length
        });
      } catch (error) {
        console.error("Error updating beneficiaries count:", error);
      }
      
      if (onBeneficiariesAdded) {
        console.log('[BeneficiaryInputRenderer] Calling onBeneficiariesAdded callback');
        onBeneficiariesAdded(savedBenefs);
      }
    } catch (error) {
      console.error("[BeneficiaryInputRenderer] Error saving beneficiaries:", error);
      toast.error("Failed to save beneficiaries. Please try again.");
    }
    
    console.log('[BeneficiaryInputRenderer] Save process completed');
  };

  const isValid = beneficiaries.every(b => b.first_name?.trim() && b.last_name?.trim() && b.address?.country);
  const alreadySaved = savedBeneficiaries && savedBeneficiaries.length > 0;

  console.log('[BeneficiaryInputRenderer] Render state:', { 
    beneficiariesCount: beneficiaries.length, 
    isValid, 
    alreadySaved,
    firstBeneficiaryData: beneficiaries[0]
  });

  return (
    <div className="space-y-4">
      {alreadySaved && (
        <Alert className="bg-green-50 border-green-200">
          <CheckCircle2 className="w-4 h-4 text-green-600" />
          <AlertDescription className="text-sm text-green-900">
            <strong>Saved:</strong> {savedBeneficiaries.length} beneficiary(ies) have been saved successfully.
          </AlertDescription>
        </Alert>
      )}

      <Alert className="bg-purple-50 border-purple-200">
        <Users className="w-4 h-4 text-purple-600" />
        <AlertDescription className="text-sm text-purple-900">
          <strong>Add Beneficiaries:</strong> Enter the details of beneficiaries who will inherit this account.
          Each beneficiary will need to be classified separately for CRS reporting.
        </AlertDescription>
      </Alert>

      <div className="space-y-4">
        {beneficiaries.map((beneficiary, index) => (
          <Card key={beneficiary.id} className="border-2 border-purple-100">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                    <User className="w-4 h-4 text-purple-600" />
                  </div>
                  <span className="font-semibold text-slate-900">
                    Beneficiary {index + 1}
                  </span>
                </div>
                {beneficiaries.length > minBeneficiaries && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveBeneficiary(index)}
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
                    value={beneficiary.first_name}
                    onChange={(e) => handleBeneficiaryChange(index, "first_name", e.target.value)}
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
                    value={beneficiary.last_name}
                    onChange={(e) => handleBeneficiaryChange(index, "last_name", e.target.value)}
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
                    value={beneficiary.date_of_birth}
                    onChange={(e) => handleBeneficiaryChange(index, "date_of_birth", e.target.value)}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label className="text-sm">Place of Birth</Label>
                  <div className="mt-1">
                    <CountrySelect
                      value={beneficiary.place_of_birth}
                      onValueChange={(value) => handleBeneficiaryChange(index, "place_of_birth", value)}
                      placeholder="Select country..."
                    />
                  </div>
                </div>
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
                      value={beneficiary.address.street}
                      onChange={(e) => handleBeneficiaryChange(index, "address.street", e.target.value)}
                      placeholder="123 Main Street"
                      className="mt-1 h-9"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">City</Label>
                    <Input
                      value={beneficiary.address.city}
                      onChange={(e) => handleBeneficiaryChange(index, "address.city", e.target.value)}
                      placeholder="City"
                      className="mt-1 h-9"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">State/Province</Label>
                    <Input
                      value={beneficiary.address.state}
                      onChange={(e) => handleBeneficiaryChange(index, "address.state", e.target.value)}
                      placeholder="State"
                      className="mt-1 h-9"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Postal Code</Label>
                    <Input
                      value={beneficiary.address.postal_code}
                      onChange={(e) => handleBeneficiaryChange(index, "address.postal_code", e.target.value)}
                      placeholder="Postal Code"
                      className="mt-1 h-9"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Country *</Label>
                    <div className="mt-1">
                      <CountrySelect
                        value={beneficiary.address.country}
                        onValueChange={(value) => handleBeneficiaryChange(index, "address.country", value)}
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
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex items-center justify-between pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={handleAddBeneficiary}
          className="border-purple-200 text-purple-700 hover:bg-purple-50"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Another Beneficiary
        </Button>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-purple-50 text-purple-700">
            {beneficiaries.length} beneficiary(ies)
          </Badge>
          {isValid && (
            <CheckCircle2 className="w-5 h-5 text-green-600" />
          )}
        </div>
      </div>

      <Button
        type="button"
        onClick={handleSaveAll}
        disabled={!isValid || alreadySaved}
        className="w-full bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50"
      >
        <Save className="w-4 h-4 mr-2" />
        {alreadySaved ? `Saved ${savedBeneficiaries.length} Beneficiary(ies) ✓` : `Save ${beneficiaries.length} Beneficiary(ies) & Continue`}
      </Button>
    </div>
  );
}