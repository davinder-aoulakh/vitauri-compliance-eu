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
import { XCircle, Save } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import TaxResidencyManager from "./TaxResidencyManager";

export default function AccountForm({ account, entities, onSubmit, onCancel }) {
  const [formData, setFormData] = useState(account || {
    entity_id: "",
    account_number: "",
    account_type: "depository",
    account_holder_type: "individual",
    account_holder_name: "",
    date_of_birth: "",
    account_balance: 0,
    currency: "USD",
    reporting_year: new Date().getFullYear().toString(),
    reportability_status: "pending_review",
    status: "active",
    account_holder_address: {
      street: "",
      city: "",
      state: "",
      postal_code: "",
      country: ""
    },
    tax_residencies: []
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
      account_holder_address: { ...prev.account_holder_address, [field]: value }
    }));
  };

  const handleTaxResidenciesChange = (residencies) => {
    setFormData(prev => ({ ...prev, tax_residencies: residencies }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Tabs defaultValue="basic" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="basic">Basic Information</TabsTrigger>
          <TabsTrigger value="address">Address</TabsTrigger>
          <TabsTrigger value="tax">Tax Information</TabsTrigger>
        </TabsList>

        <TabsContent value="basic" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="entity_id">Related Entity *</Label>
              <Select
                value={formData.entity_id}
                onValueChange={(value) => handleChange("entity_id", value)}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="Select entity..." />
                </SelectTrigger>
                <SelectContent>
                  {entities.map((entity) => (
                    <SelectItem key={entity.id} value={entity.id}>
                      {entity.entity_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500 mt-1">
                The RFI entity that holds this account
              </p>
            </div>

            <div>
              <Label htmlFor="account_number">Account Number *</Label>
              <Input
                id="account_number"
                value={formData.account_number}
                onChange={(e) => handleChange("account_number", e.target.value)}
                placeholder="e.g., ACC-123456"
                required
                className="mt-1.5"
              />
            </div>

            <div>
              <Label htmlFor="account_type">Account Type *</Label>
              <Select
                value={formData.account_type}
                onValueChange={(value) => handleChange("account_type", value)}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="depository">Depository</SelectItem>
                  <SelectItem value="custodial">Custodial</SelectItem>
                  <SelectItem value="equity_debt_interest">Equity/Debt Interest</SelectItem>
                  <SelectItem value="cash_value_insurance">Cash Value Insurance</SelectItem>
                  <SelectItem value="annuity">Annuity</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="account_holder_type">Account Holder Type *</Label>
              <Select
                value={formData.account_holder_type}
                onValueChange={(value) => handleChange("account_holder_type", value)}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="individual">Individual</SelectItem>
                  <SelectItem value="entity">Entity</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="account_holder_name">Account Holder Name *</Label>
              <Input
                id="account_holder_name"
                value={formData.account_holder_name}
                onChange={(e) => handleChange("account_holder_name", e.target.value)}
                placeholder="Full name"
                required
                className="mt-1.5"
              />
            </div>

            {formData.account_holder_type === "individual" && (
              <div>
                <Label htmlFor="date_of_birth">Date of Birth</Label>
                <Input
                  id="date_of_birth"
                  type="date"
                  value={formData.date_of_birth}
                  onChange={(e) => handleChange("date_of_birth", e.target.value)}
                  className="mt-1.5"
                />
              </div>
            )}

            <div>
              <Label htmlFor="account_balance">Account Balance *</Label>
              <Input
                id="account_balance"
                type="number"
                step="0.01"
                value={formData.account_balance}
                onChange={(e) => handleChange("account_balance", parseFloat(e.target.value) || 0)}
                placeholder="0.00"
                required
                className="mt-1.5"
              />
            </div>

            <div>
              <Label htmlFor="currency">Currency</Label>
              <Select
                value={formData.currency}
                onValueChange={(value) => handleChange("currency", value)}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                  <SelectItem value="GBP">GBP</SelectItem>
                  <SelectItem value="CHF">CHF</SelectItem>
                  <SelectItem value="JPY">JPY</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="reporting_year">Reporting Year</Label>
              <Input
                id="reporting_year"
                value={formData.reporting_year}
                onChange={(e) => handleChange("reporting_year", e.target.value)}
                placeholder="2024"
                className="mt-1.5"
              />
            </div>

            <div>
              <Label htmlFor="reportability_status">Reportability Status</Label>
              <Select
                value={formData.reportability_status}
                onValueChange={(value) => handleChange("reportability_status", value)}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending_review">Pending Review</SelectItem>
                  <SelectItem value="reportable">Reportable</SelectItem>
                  <SelectItem value="non_reportable">Non-Reportable</SelectItem>
                  <SelectItem value="excluded">Excluded</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="address" className="space-y-4 mt-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 mb-3">Account Holder Address</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Label htmlFor="street">Street Address</Label>
                <Input
                  id="street"
                  value={formData.account_holder_address.street}
                  onChange={(e) => handleAddressChange("street", e.target.value)}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={formData.account_holder_address.city}
                  onChange={(e) => handleAddressChange("city", e.target.value)}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="state">State/Province</Label>
                <Input
                  id="state"
                  value={formData.account_holder_address.state}
                  onChange={(e) => handleAddressChange("state", e.target.value)}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="postal_code">Postal Code</Label>
                <Input
                  id="postal_code"
                  value={formData.account_holder_address.postal_code}
                  onChange={(e) => handleAddressChange("postal_code", e.target.value)}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="country">Country</Label>
                <Input
                  id="country"
                  value={formData.account_holder_address.country}
                  onChange={(e) => handleAddressChange("country", e.target.value)}
                  placeholder="e.g., United States"
                  className="mt-1.5"
                />
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="tax" className="space-y-4 mt-4">
          <TaxResidencyManager
            residencies={formData.tax_residencies}
            onChange={handleTaxResidenciesChange}
            accountHolderType={formData.account_holder_type}
          />
        </TabsContent>
      </Tabs>

      <div className="flex justify-end gap-3 pt-6 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>
          <XCircle className="w-4 h-4 mr-2" />
          Cancel
        </Button>
        <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white">
          <Save className="w-4 h-4 mr-2" />
          {account ? "Update Account" : "Create Account"}
        </Button>
      </div>
    </form>
  );
}