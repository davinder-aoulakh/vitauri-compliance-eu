import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
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
import { XCircle, Save } from "lucide-react";

export default function EntityForm({ entity, onSubmit, onCancel }) {
  const [formData, setFormData] = useState(entity || {
    entity_name: "",
    entity_type: "corporation",
    country_of_incorporation: "",
    tax_id: "",
    giin: "",
    address: {
      street: "",
      city: "",
      state: "",
      postal_code: "",
      country: ""
    },
    status: "active"
  });

  // Fetch country list from global referenced data
  const { data: countryData = [] } = useQuery({
    queryKey: ['referenced-data-countries'],
    queryFn: () => base44.entities.ReferencedData.filter({
      entity_name: 'Global',
      field_name: 'country',
      is_published: true
    })
  });

  // Fetch entity_type options from referenced data
  const { data: entityTypeData = [] } = useQuery({
    queryKey: ['referenced-data-entity-type'],
    queryFn: () => base44.entities.ReferencedData.filter({
      entity_name: 'Entity',
      field_name: 'entity_type',
      is_published: true
    })
  });

  const countries = countryData
    .sort((a, b) => a.order - b.order)
    .map(d => ({ value: d.value, label: d.label }));

  const entityTypes = entityTypeData
    .sort((a, b) => a.order - b.order)
    .map(d => ({ value: d.value, label: d.label }));

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

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="md:col-span-2">
          <Label htmlFor="entity_name">Entity Name *</Label>
          <Input
            id="entity_name"
            value={formData.entity_name}
            onChange={(e) => handleChange("entity_name", e.target.value)}
            placeholder="Legal entity name"
            required
            className="mt-1.5"
          />
        </div>

        <div>
          <Label htmlFor="entity_type">Entity Type *</Label>
          <Select
            value={formData.entity_type}
            onValueChange={(value) => handleChange("entity_type", value)}
          >
            <SelectTrigger className="mt-1.5">
              <SelectValue placeholder="Select entity type..." />
            </SelectTrigger>
            <SelectContent>
              {entityTypes.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="country_of_incorporation">Country of Incorporation *</Label>
          <Select
            value={formData.country_of_incorporation}
            onValueChange={(value) => handleChange("country_of_incorporation", value)}
          >
            <SelectTrigger className="mt-1.5">
              <SelectValue placeholder="Select country..." />
            </SelectTrigger>
            <SelectContent>
              {countries.map((country) => (
                <SelectItem key={country.value} value={country.value}>
                  {country.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="tax_id">Tax ID</Label>
          <Input
            id="tax_id"
            value={formData.tax_id}
            onChange={(e) => handleChange("tax_id", e.target.value)}
            placeholder="Tax identification number"
            className="mt-1.5"
          />
        </div>

        <div>
          <Label htmlFor="giin">GIIN (if applicable)</Label>
          <Input
            id="giin"
            value={formData.giin}
            onChange={(e) => handleChange("giin", e.target.value)}
            placeholder="Global Intermediary ID"
            className="mt-1.5"
          />
        </div>
      </div>

      <div className="border-t pt-6">
        <h3 className="text-sm font-semibold text-slate-900 mb-4">Address</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <Label htmlFor="street">Street Address</Label>
            <Input
              id="street"
              value={formData.address.street}
              onChange={(e) => handleAddressChange("street", e.target.value)}
              className="mt-1.5"
            />
          </div>
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
            <Label htmlFor="country">Country</Label>
            <Select
              value={formData.address.country}
              onValueChange={(value) => handleAddressChange("country", value)}
            >
              <SelectTrigger className="mt-1.5">
                <SelectValue placeholder="Select country..." />
              </SelectTrigger>
              <SelectContent>
                {countries.map((country) => (
                  <SelectItem key={country.value} value={country.value}>
                    {country.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-6 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>
          <XCircle className="w-4 h-4 mr-2" />
          Cancel
        </Button>
        <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white">
          <Save className="w-4 h-4 mr-2" />
          {entity ? "Update Entity" : "Create Entity"}
        </Button>
      </div>
    </form>
  );
}