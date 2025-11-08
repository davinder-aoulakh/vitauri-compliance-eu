import React, { useState, useEffect } from "react";
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
import { XCircle, Save, Info } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import TaxResidencyManager from "./TaxResidencyManager";
import DocumentUpload from "./DocumentUpload";

export default function AccountForm({ account, entities, onSubmit, onCancel, tenant }) {
  const [formData, setFormData] = useState(account || {
    entity_id: "",
    account_number: "",
    account_type: "depository",
    account_holder_type: "individual",
    account_holder_name: "",
    date_of_birth: "",
    is_pre_existing: false,
    account_holder_is_alive: true,
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
    tax_residencies: [],
    needs_reclassification: false,
    self_certification_document_url: null,
    self_certification_document_name: null,
    self_certification_upload_date: null,
    self_certification_obtained: false,
    self_certification_date: null
  });

  const [detectedChanges, setDetectedChanges] = useState([]);
  const [initialData, setInitialData] = useState(null);

  useEffect(() => {
    if (account) {
      setInitialData(JSON.parse(JSON.stringify(account)));
    }
  }, [account]);

  // Auto-determine if account is pre-existing based on created date
  useEffect(() => {
    if (account?.created_date) {
      const createdDate = new Date(account.created_date);
      const crsThresholdDate = new Date('2018-01-01');
      const isPreExisting = createdDate < crsThresholdDate;
      
      if (formData.is_pre_existing !== isPreExisting) {
        setFormData(prev => ({ ...prev, is_pre_existing: isPreExisting }));
      }
    }
  }, [account?.created_date]);

  useEffect(() => {
    if (!initialData || !account) return;

    const changes = [];

    // Check address country change
    if (initialData.account_holder_address?.country !== formData.account_holder_address?.country) {
      changes.push('Address country changed');
    }

    // Check tax residencies change
    if (JSON.stringify(initialData.tax_residencies) !== JSON.stringify(formData.tax_residencies)) {
      changes.push('Tax residencies modified');
    }

    // Detect foreign indicia
    const newIndicia = detectIndicia(formData, tenant?.jurisdiction);
    if (newIndicia.length > 0 && (!account.indicia_found || account.indicia_found.length === 0)) {
      changes.push(`Foreign indicia detected: ${newIndicia.join(', ')}`);
    }

    setDetectedChanges(changes);
  }, [formData, initialData, account, tenant]);

  const detectIndicia = (accountData, tenantJurisdiction) => {
    const indicia = [];

    // Foreign address
    if (accountData.account_holder_address?.country && 
        accountData.account_holder_address.country !== tenantJurisdiction) {
      indicia.push('foreign_address');
    }

    // Foreign tax residency
    const hasForeignTaxResidency = accountData.tax_residencies?.some(
      r => r.country && r.country !== tenantJurisdiction
    );
    if (hasForeignTaxResidency) {
      indicia.push('foreign_tax_residency');
    }

    return indicia;
  };

  const handleDocumentUpload = (fileUrl, fileName) => {
    setFormData(prev => ({
      ...prev,
      self_certification_document_url: fileUrl,
      self_certification_document_name: fileName,
      self_certification_upload_date: new Date().toISOString(),
      self_certification_obtained: true,
      self_certification_date: new Date().toISOString().split('T')[0]
    }));
  };

  const handleDocumentDelete = () => {
    setFormData(prev => ({
      ...prev,
      self_certification_document_url: null,
      self_certification_document_name: null,
      self_certification_upload_date: null,
      self_certification_obtained: false,
      self_certification_date: null
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Auto-detect indicia
    const newIndicia = detectIndicia(formData, tenant?.jurisdiction);
    
    // Determine if needs reclassification
    const needsReclassification = detectedChanges.length > 0 && 
      account && 
      account.reportability_status !== 'pending_review';

    const updatedData = {
      ...formData,
      indicia_found: newIndicia.length > 0 ? newIndicia : undefined,
      needs_reclassification: needsReclassification
    };

    onSubmit(updatedData);
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
      {/* Change Detection Alert */}
      {detectedChanges.length > 0 && (
        <Alert className="bg-amber-50 border-amber-200">
          <AlertTriangle className="w-4 h-4 text-amber-600" />
          <AlertDescription className="text-sm text-amber-900">
            <strong>Significant changes detected:</strong>
            <ul className="list-disc list-inside mt-1">
              {detectedChanges.map((change, idx) => (
                <li key={idx}>{change}</li>
              ))}
            </ul>
            <p className="mt-2 font-medium">
              This account will be flagged for re-classification after saving.
            </p>
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="basic" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="basic">Basic Information</TabsTrigger>
          <TabsTrigger value="address">Address</TabsTrigger>
          <TabsTrigger value="tax">Tax Information</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
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

          {/* CRS-Specific Fields */}
          <div className="mt-6 p-4 border-2 border-blue-100 rounded-lg bg-blue-50/30">
            <div className="flex items-center gap-2 mb-3">
              <Info className="w-4 h-4 text-blue-600" />
              <h3 className="text-sm font-semibold text-blue-900">CRS Classification Information</h3>
            </div>
            
            <div className="space-y-4">
              {/* Pre-existing Account */}
              <div>
                <Label htmlFor="is_pre_existing" className="text-sm font-medium text-slate-700">
                  Pre-existing Account (opened before Jan 1, 2018)
                </Label>
                {account?.created_date ? (
                  <Alert className="mt-2 bg-slate-50 border-slate-200">
                    <Info className="w-4 h-4 text-slate-600" />
                    <AlertDescription className="text-xs text-slate-700">
                      Auto-determined based on account creation date: {new Date(account.created_date).toLocaleDateString()}
                      <br />
                      <strong>Status:</strong> {formData.is_pre_existing ? "Pre-existing (before 2018)" : "New Account (2018 or later)"}
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="mt-2">
                    <RadioGroup
                      value={formData.is_pre_existing ? "yes" : "no"}
                      onValueChange={(value) => handleChange("is_pre_existing", value === "yes")}
                      className="flex gap-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="yes" id="pre_existing_yes" />
                        <Label htmlFor="pre_existing_yes" className="font-normal cursor-pointer">
                          Yes (opened before Jan 1, 2018)
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="no" id="pre_existing_no" />
                        <Label htmlFor="pre_existing_no" className="font-normal cursor-pointer">
                          No (opened Jan 1, 2018 or later)
                        </Label>
                      </div>
                    </RadioGroup>
                    <p className="text-xs text-slate-500 mt-1">
                      Pre-existing accounts may have different due diligence requirements under CRS
                    </p>
                  </div>
                )}
              </div>

              {/* Account Holder Status - Only for Individual Accounts */}
              {formData.account_holder_type === "individual" && (
                <div>
                  <Label htmlFor="account_holder_is_alive" className="text-sm font-medium text-slate-700">
                    Account Holder Status
                  </Label>
                  <div className="mt-2">
                    <RadioGroup
                      value={formData.account_holder_is_alive ? "alive" : "deceased"}
                      onValueChange={(value) => handleChange("account_holder_is_alive", value === "alive")}
                      className="flex gap-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="alive" id="holder_alive" />
                        <Label htmlFor="holder_alive" className="font-normal cursor-pointer">
                          Alive
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="deceased" id="holder_deceased" />
                        <Label htmlFor="holder_deceased" className="font-normal cursor-pointer">
                          Deceased
                        </Label>
                      </div>
                    </RadioGroup>
                    <p className="text-xs text-slate-500 mt-1">
                      CRS reporting may differ for accounts of deceased individuals
                    </p>
                  </div>
                </div>
              )}
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

        <TabsContent value="documents" className="space-y-4 mt-4">
          <DocumentUpload
            documentUrl={formData.self_certification_document_url}
            onUploadComplete={handleDocumentUpload}
            onDelete={handleDocumentDelete}
            label="Self-Certification Document"
            description="Upload the account holder's self-certification form (PDF, JPG, or PNG up to 10MB)"
          />

          {formData.self_certification_document_url && formData.self_certification_upload_date && (
            <div className="text-xs text-slate-600 mt-2">
              <p>
                <strong>Uploaded:</strong> {new Date(formData.self_certification_upload_date).toLocaleString()}
              </p>
              {formData.self_certification_document_name && (
                <p>
                  <strong>Filename:</strong> {formData.self_certification_document_name}
                </p>
              )}
            </div>
          )}
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