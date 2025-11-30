import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
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
import { XCircle, Save, Info, Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import TaxResidencyManager from "./TaxResidencyManager";
import DocumentsManager from "./DocumentsManager";
import CountrySelect from "../shared/CountrySelect";
import CurrencySelect from "../shared/CurrencySelect";
import BeneficiaryManager from "./BeneficiaryManager";
import SmartDocumentParser from "../ai/SmartDocumentParser";
import AIFormAssistant from "../ai/AIFormAssistant";

export default function AccountForm({ account, entities, onSubmit, onCancel, tenant, onBeneficiariesChange }) {
  const [formData, setFormData] = useState(account || {
    entity_id: "",
    account_number: "",
    account_type: "depository",
    account_holder_type: "individual",
    account_holder_name: "",
    date_of_birth: "",
    place_of_birth: "",
    is_pre_existing: false,
    account_holder_is_alive: true,
    account_closed_during_period: false,
    account_holder_deceased_during_period: false,
    death_certificate_requested: false,
    death_certificate_requested_date: "",
    death_certificate_received: false,
    death_certificate_received_date: "",
    will_or_inheritance_requested: false,
    will_or_inheritance_requested_date: "",
    will_or_inheritance_received: false,
    will_or_inheritance_received_date: "",
    legacy_of_deceased_settled: false,
    legacy_settlement_date: "",
    entity_managed_by_fiduciary_trust: false,
    entity_managed_by_asset_manager: false,
    gross_income_from_financial_assets: false,
    current_address: {
      street: "",
      city: "",
      state: "",
      postal_code: "",
      country: ""
    },
    country_of_residence: "",
    current_email: "",
    current_phone: "",
    year_end_cash_value: 0,
    year_end_cash_value_currency: "USD",
    gross_payments: 0,
    gross_payments_currency: "USD",
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
    self_certification_date: null,
    documents: []
  });

  const [detectedChanges, setDetectedChanges] = useState([]);
  const [initialData, setInitialData] = useState(null);
  const [accountNumberError, setAccountNumberError] = useState("");
  const [isValidating, setIsValidating] = useState(false);

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

  const handleDocumentsChange = (newDocuments) => {
    // Check if any self-certification document exists
    const hasSelfCert = newDocuments.some(d => d.document_type === "self_certification");
    
    setFormData(prev => ({
      ...prev,
      documents: newDocuments,
      self_certification_obtained: hasSelfCert,
      self_certification_date: hasSelfCert ? new Date().toISOString().split('T')[0] : null
    }));
  };

  // Validate account number uniqueness within tenant and entity
  const validateAccountNumber = async (accountNumber, entityId) => {
    if (!accountNumber || !entityId || !tenant?.id) return true;
    
    setIsValidating(true);
    setAccountNumberError("");
    
    try {
      const existingAccounts = await base44.entities.Account.filter({
        tenant_id: tenant.id,
        entity_id: entityId,
        account_number: accountNumber
      });
      
      // If editing, exclude the current account from the check
      const duplicates = account 
        ? existingAccounts.filter(a => a.id !== account.id)
        : existingAccounts;
      
      if (duplicates.length > 0) {
        const entityName = entities.find(e => e.id === entityId)?.entity_name || "this entity";
        setAccountNumberError(`Account number "${accountNumber}" already exists for ${entityName}. Please use a unique account number.`);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error("Error validating account number:", error);
      return true; // Don't block on error
    } finally {
      setIsValidating(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate account number uniqueness
    const isValid = await validateAccountNumber(formData.account_number, formData.entity_id);
    if (!isValid) return;
    
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

  const handleCurrentAddressChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      current_address: { ...prev.current_address, [field]: value }
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
          <TabsTrigger value="crs">CRS Classification</TabsTrigger>
          <TabsTrigger value="tax">Tax Information</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>

        <TabsContent value="basic" className="space-y-4 mt-4">
          {/* Account Creation Date - Read Only */}
          {account?.created_date && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <div className="flex items-center gap-2 text-sm">
                <Info className="w-4 h-4 text-slate-500" />
                <span className="text-slate-600">Account Created:</span>
                <span className="font-medium text-slate-900">
                  {new Date(account.created_date).toLocaleDateString()} at {new Date(account.created_date).toLocaleTimeString()}
                </span>
              </div>
            </div>
          )}

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
                onChange={(e) => {
                  handleChange("account_number", e.target.value);
                  setAccountNumberError(""); // Clear error on change
                }}
                onBlur={() => {
                  if (formData.account_number && formData.entity_id) {
                    validateAccountNumber(formData.account_number, formData.entity_id);
                  }
                }}
                placeholder="e.g., ACC-123456"
                required
                className={`mt-1.5 ${accountNumberError ? 'border-red-500 focus:ring-red-500' : ''}`}
              />
              {accountNumberError && (
                <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  {accountNumberError}
                </p>
              )}
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
              <>
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

                <div>
                  <Label htmlFor="place_of_birth">Place of Birth</Label>
                  <div className="mt-1.5">
                    <CountrySelect
                      value={formData.place_of_birth}
                      onValueChange={(value) => handleChange("place_of_birth", value)}
                      placeholder="Select country..."
                    />
                  </div>
                </div>
              </>
            )}

            <div>
              <Label htmlFor="account_closed_during_period">Account Closed During Period?</Label>
              <RadioGroup
                value={formData.account_closed_during_period ? "yes" : "no"}
                onValueChange={(value) => handleChange("account_closed_during_period", value === "yes")}
                className="flex gap-4 mt-1.5"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="yes" id="closed_yes" />
                  <Label htmlFor="closed_yes" className="font-normal cursor-pointer">
                    Yes
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="no" id="closed_no" />
                  <Label htmlFor="closed_no" className="font-normal cursor-pointer">
                    No
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div>
              <Label htmlFor="country_of_residence">Country of Residence</Label>
              <div className="mt-1.5">
                <CountrySelect
                  value={formData.country_of_residence}
                  onValueChange={(value) => handleChange("country_of_residence", value)}
                  placeholder="Select country..."
                />
              </div>
            </div>

            <div>
              <Label htmlFor="current_email">Current Email Address</Label>
              <Input
                id="current_email"
                type="email"
                value={formData.current_email}
                onChange={(e) => handleChange("current_email", e.target.value)}
                placeholder="email@example.com"
                className="mt-1.5"
              />
            </div>

            <div>
              <Label htmlFor="current_phone">Current Phone Number</Label>
              <Input
                id="current_phone"
                type="tel"
                value={formData.current_phone}
                onChange={(e) => handleChange("current_phone", e.target.value)}
                placeholder="+1234567890"
                className="mt-1.5"
              />
            </div>
          </div>

          {/* Current Address Section */}
          <div className="mt-6">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Current Address</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Label htmlFor="current_street">Street Address</Label>
                <Input
                  id="current_street"
                  value={formData.current_address?.street || ""}
                  onChange={(e) => handleCurrentAddressChange("street", e.target.value)}
                  placeholder="123 Main Street"
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label htmlFor="current_city">City</Label>
                <Input
                  id="current_city"
                  value={formData.current_address?.city || ""}
                  onChange={(e) => handleCurrentAddressChange("city", e.target.value)}
                  placeholder="City"
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label htmlFor="current_state">State/Province</Label>
                <Input
                  id="current_state"
                  value={formData.current_address?.state || ""}
                  onChange={(e) => handleCurrentAddressChange("state", e.target.value)}
                  placeholder="State/Province"
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label htmlFor="current_postal_code">Postal Code</Label>
                <Input
                  id="current_postal_code"
                  value={formData.current_address?.postal_code || ""}
                  onChange={(e) => handleCurrentAddressChange("postal_code", e.target.value)}
                  placeholder="Postal Code"
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label htmlFor="current_country">Country *</Label>
                <div className="mt-1.5">
                  <CountrySelect
                    value={formData.current_address?.country || ""}
                    onValueChange={(value) => handleCurrentAddressChange("country", value)}
                    placeholder="Select country..."
                  />
                </div>
              </div>
            </div>
          </div>

          {/* CRS Reporting Values */}
          <div className="mt-6">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">CRS Reporting Values</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="year_end_cash_value">Year-end Cash or Surrender Value</Label>
                <Input
                  id="year_end_cash_value"
                  type="number"
                  step="0.01"
                  value={formData.year_end_cash_value}
                  onChange={(e) => handleChange("year_end_cash_value", parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label htmlFor="year_end_cash_value_currency">Year-end Value Currency</Label>
                <div className="mt-1.5">
                  <CurrencySelect
                    value={formData.year_end_cash_value_currency}
                    onValueChange={(value) => handleChange("year_end_cash_value_currency", value)}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="gross_payments">Gross Payments (Redemptions, Annuities)</Label>
                <Input
                  id="gross_payments"
                  type="number"
                  step="0.01"
                  value={formData.gross_payments}
                  onChange={(e) => handleChange("gross_payments", parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label htmlFor="gross_payments_currency">Gross Payments Currency</Label>
                <div className="mt-1.5">
                  <CurrencySelect
                    value={formData.gross_payments_currency}
                    onValueChange={(value) => handleChange("gross_payments_currency", value)}
                  />
                </div>
              </div>
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

        <TabsContent value="crs" className="space-y-4 mt-4">
          {/* CRS-Specific Fields */}
          <div className="p-4 border-2 border-blue-100 rounded-lg bg-blue-50/30">
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
                <div className="mt-2">
                  <RadioGroup
                    value={formData.is_pre_existing ? "yes" : "no"}
                    onValueChange={(value) => handleChange("is_pre_existing", value === "yes")}
                    className="flex gap-4"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="yes" id="pre_existing_yes" />
                      <Label htmlFor="pre_existing_yes" className="font-normal cursor-pointer">
                        Yes
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="no" id="pre_existing_no" />
                      <Label htmlFor="pre_existing_no" className="font-normal cursor-pointer">
                        No
                      </Label>
                    </div>
                  </RadioGroup>
                  <p className="text-xs text-slate-500 mt-1">
                    Pre-existing accounts may have different due diligence requirements under CRS
                  </p>
                </div>
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

          {/* Deceased Account Holder Information - Only show when account holder is deceased */}
          {formData.account_holder_type === "individual" && !formData.account_holder_is_alive && (
            <div className="p-4 border-2 border-slate-200 rounded-lg bg-slate-50/30">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Deceased Account Holder Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Account Holder Deceased During Period?</Label>
                  <RadioGroup
                    value={formData.account_holder_deceased_during_period ? "yes" : "no"}
                    onValueChange={(value) => handleChange("account_holder_deceased_during_period", value === "yes")}
                    className="flex gap-4 mt-1.5"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="yes" id="deceased_period_yes" />
                      <Label htmlFor="deceased_period_yes" className="font-normal cursor-pointer">Yes</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="no" id="deceased_period_no" />
                      <Label htmlFor="deceased_period_no" className="font-normal cursor-pointer">No</Label>
                    </div>
                  </RadioGroup>
                </div>

                <div>
                  <Label>Death Certificate Requested?</Label>
                  <RadioGroup
                    value={formData.death_certificate_requested ? "yes" : "no"}
                    onValueChange={(value) => handleChange("death_certificate_requested", value === "yes")}
                    className="flex gap-4 mt-1.5"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="yes" id="death_cert_req_yes" />
                      <Label htmlFor="death_cert_req_yes" className="font-normal cursor-pointer">Yes</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="no" id="death_cert_req_no" />
                      <Label htmlFor="death_cert_req_no" className="font-normal cursor-pointer">No</Label>
                    </div>
                  </RadioGroup>
                </div>

                <div>
                  <Label htmlFor="death_certificate_requested_date">Date Death Certificate Requested</Label>
                  <Input
                    id="death_certificate_requested_date"
                    type="date"
                    value={formData.death_certificate_requested_date}
                    onChange={(e) => handleChange("death_certificate_requested_date", e.target.value)}
                    className="mt-1.5"
                  />
                </div>

                <div>
                  <Label>Death Certificate Received?</Label>
                  <RadioGroup
                    value={formData.death_certificate_received ? "yes" : "no"}
                    onValueChange={(value) => handleChange("death_certificate_received", value === "yes")}
                    className="flex gap-4 mt-1.5"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="yes" id="death_cert_rec_yes" />
                      <Label htmlFor="death_cert_rec_yes" className="font-normal cursor-pointer">Yes</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="no" id="death_cert_rec_no" />
                      <Label htmlFor="death_cert_rec_no" className="font-normal cursor-pointer">No</Label>
                    </div>
                  </RadioGroup>
                </div>

                <div>
                  <Label htmlFor="death_certificate_received_date">Date Death Certificate Received</Label>
                  <Input
                    id="death_certificate_received_date"
                    type="date"
                    value={formData.death_certificate_received_date}
                    onChange={(e) => handleChange("death_certificate_received_date", e.target.value)}
                    className="mt-1.5"
                  />
                </div>

                <div>
                  <Label>Will or Certificate of Inheritance Requested?</Label>
                  <RadioGroup
                    value={formData.will_or_inheritance_requested ? "yes" : "no"}
                    onValueChange={(value) => handleChange("will_or_inheritance_requested", value === "yes")}
                    className="flex gap-4 mt-1.5"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="yes" id="will_req_yes" />
                      <Label htmlFor="will_req_yes" className="font-normal cursor-pointer">Yes</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="no" id="will_req_no" />
                      <Label htmlFor="will_req_no" className="font-normal cursor-pointer">No</Label>
                    </div>
                  </RadioGroup>
                </div>

                <div>
                  <Label htmlFor="will_or_inheritance_requested_date">Date Will/Inheritance Requested</Label>
                  <Input
                    id="will_or_inheritance_requested_date"
                    type="date"
                    value={formData.will_or_inheritance_requested_date}
                    onChange={(e) => handleChange("will_or_inheritance_requested_date", e.target.value)}
                    className="mt-1.5"
                  />
                </div>

                <div>
                  <Label>Will or Certificate of Inheritance Received?</Label>
                  <RadioGroup
                    value={formData.will_or_inheritance_received ? "yes" : "no"}
                    onValueChange={(value) => handleChange("will_or_inheritance_received", value === "yes")}
                    className="flex gap-4 mt-1.5"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="yes" id="will_rec_yes" />
                      <Label htmlFor="will_rec_yes" className="font-normal cursor-pointer">Yes</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="no" id="will_rec_no" />
                      <Label htmlFor="will_rec_no" className="font-normal cursor-pointer">No</Label>
                    </div>
                  </RadioGroup>
                </div>

                <div>
                  <Label htmlFor="will_or_inheritance_received_date">Date Will/Inheritance Received</Label>
                  <Input
                    id="will_or_inheritance_received_date"
                    type="date"
                    value={formData.will_or_inheritance_received_date}
                    onChange={(e) => handleChange("will_or_inheritance_received_date", e.target.value)}
                    className="mt-1.5"
                  />
                </div>

                <div>
                  <Label>Legacy of Deceased Settled?</Label>
                  <RadioGroup
                    value={formData.legacy_of_deceased_settled ? "yes" : "no"}
                    onValueChange={(value) => handleChange("legacy_of_deceased_settled", value === "yes")}
                    className="flex gap-4 mt-1.5"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="yes" id="legacy_settled_yes" />
                      <Label htmlFor="legacy_settled_yes" className="font-normal cursor-pointer">Yes</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="no" id="legacy_settled_no" />
                      <Label htmlFor="legacy_settled_no" className="font-normal cursor-pointer">No</Label>
                    </div>
                  </RadioGroup>
                </div>

                <div>
                  <Label htmlFor="legacy_settlement_date">Settlement Date of Legacy</Label>
                  <Input
                    id="legacy_settlement_date"
                    type="date"
                    value={formData.legacy_settlement_date}
                    onChange={(e) => handleChange("legacy_settlement_date", e.target.value)}
                    className="mt-1.5"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Entity Account Holder Information */}
          {formData.account_holder_type === "entity" && (
            <div className="p-4 border-2 border-slate-200 rounded-lg bg-slate-50/30">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Entity Account Holder Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Entity Professionally Managed by Fiduciary Trust?</Label>
                  <RadioGroup
                    value={formData.entity_managed_by_fiduciary_trust ? "yes" : "no"}
                    onValueChange={(value) => handleChange("entity_managed_by_fiduciary_trust", value === "yes")}
                    className="flex gap-4 mt-1.5"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="yes" id="fiduciary_yes" />
                      <Label htmlFor="fiduciary_yes" className="font-normal cursor-pointer">Yes</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="no" id="fiduciary_no" />
                      <Label htmlFor="fiduciary_no" className="font-normal cursor-pointer">No</Label>
                    </div>
                  </RadioGroup>
                </div>

                <div>
                  <Label>Entity Professionally Managed by Asset Manager?</Label>
                  <RadioGroup
                    value={formData.entity_managed_by_asset_manager ? "yes" : "no"}
                    onValueChange={(value) => handleChange("entity_managed_by_asset_manager", value === "yes")}
                    className="flex gap-4 mt-1.5"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="yes" id="asset_mgr_yes" />
                      <Label htmlFor="asset_mgr_yes" className="font-normal cursor-pointer">Yes</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="no" id="asset_mgr_no" />
                      <Label htmlFor="asset_mgr_no" className="font-normal cursor-pointer">No</Label>
                    </div>
                  </RadioGroup>
                </div>

                <div className="md:col-span-2">
                  <Label>Gross Income &gt;50% from (Re)-Investing/Trading in Financial Assets?</Label>
                  <RadioGroup
                    value={formData.gross_income_from_financial_assets ? "yes" : "no"}
                    onValueChange={(value) => handleChange("gross_income_from_financial_assets", value === "yes")}
                    className="flex gap-4 mt-1.5"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="yes" id="gross_income_yes" />
                      <Label htmlFor="gross_income_yes" className="font-normal cursor-pointer">Yes</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="no" id="gross_income_no" />
                      <Label htmlFor="gross_income_no" className="font-normal cursor-pointer">No</Label>
                    </div>
                  </RadioGroup>
                </div>
              </div>
            </div>
          )}

          {/* Beneficiaries Section - Only for Deceased Account Holders */}
          {formData.account_holder_type === "individual" && !formData.account_holder_is_alive && account?.id && (
            <div className="p-4 border-2 border-purple-200 rounded-lg bg-purple-50/30 mt-6">
              <BeneficiaryManager 
                account={account} 
                tenant={tenant}
              />
            </div>
          )}
        </TabsContent>

        <TabsContent value="tax" className="space-y-4 mt-4">
          <TaxResidencyManager
            residencies={formData.tax_residencies}
            onChange={handleTaxResidenciesChange}
            accountHolderType={formData.account_holder_type}
          />
        </TabsContent>

        <TabsContent value="documents" className="space-y-4 mt-4">
          <DocumentsManager
            documents={formData.documents || []}
            onDocumentsChange={handleDocumentsChange}
            legacyDocument={
              formData.self_certification_document_url && !formData.documents?.length
                ? {
                    document_url: formData.self_certification_document_url,
                    document_name: formData.self_certification_document_name,
                    upload_date: formData.self_certification_upload_date,
                    uploaded_by_email: formData.self_certification_uploaded_by_email
                  }
                : null
            }
          />
        </TabsContent>
      </Tabs>

      <div className="flex justify-end gap-3 pt-6 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>
          <XCircle className="w-4 h-4 mr-2" />
          Cancel
        </Button>
        <Button 
          type="submit" 
          className="bg-indigo-600 hover:bg-indigo-700 text-white"
          disabled={isValidating || !!accountNumberError}
        >
          {isValidating ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          {account ? "Update Account" : "Create Account"}
        </Button>
      </div>
    </form>
  );
}