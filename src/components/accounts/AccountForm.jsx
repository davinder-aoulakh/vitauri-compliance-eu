import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { FI_TYPE_OPTIONS, normalizeFIType } from "@/lib/fiTypeConstants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { XCircle, Save, Info, Loader2, Sparkles, AlertCircle, Lock } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import TaxResidencyManager from "./TaxResidencyManager";
import DocumentsManager from "./DocumentsManager";
import CountrySelect from "../shared/CountrySelect";
import CurrencySelect from "../shared/CurrencySelect";
import BeneficiaryManager from "./BeneficiaryManager";
import ControllingPersonManager from "./ControllingPersonManager";
import SmartDocumentParser from "../ai/SmartDocumentParser";
import AIFormAssistant from "../ai/AIFormAssistant";
import VoiceFormAssistant from "../ai/VoiceFormAssistant";

export default function AccountForm({ account, entities, onSubmit, onCancel, tenant, onBeneficiariesChange }) {
  const [isCurrentAddressSameAsOriginal, setIsCurrentAddressSameAsOriginal] = useState(false);
  const [referencedData, setReferencedData] = useState([]);
  const [formData, setFormData] = useState({
    entity_id: account?.entity_id || "",
    account_number: account?.account_number || "",
    account_creation_date: account?.account_creation_date || "",
    account_type: account?.account_type || "depository",
    account_holder_entity_type: account?.account_holder_entity_type || "",
    account_holder_type: account?.account_holder_type || "individual",
    account_holder_name: account?.account_holder_name || "",
    first_name: account?.first_name || "",
    last_name: account?.last_name || "",
    date_of_birth: account?.date_of_birth || "",
    place_of_birth: account?.place_of_birth || "",
    is_pre_existing: account?.is_pre_existing || false,
    account_holder_is_alive: account?.account_holder_is_alive !== undefined ? account.account_holder_is_alive : true,
    account_closed_during_period: account?.account_closed_during_period || false,
    account_holder_deceased_during_period: account?.account_holder_deceased_during_period || false,
    death_certificate_requested: account?.death_certificate_requested || false,
    death_certificate_requested_date: account?.death_certificate_requested_date || "",
    death_certificate_received: account?.death_certificate_received || false,
    death_certificate_received_date: account?.death_certificate_received_date || "",
    will_or_inheritance_requested: account?.will_or_inheritance_requested || false,
    will_or_inheritance_requested_date: account?.will_or_inheritance_requested_date || "",
    will_or_inheritance_received: account?.will_or_inheritance_received || false,
    will_or_inheritance_received_date: account?.will_or_inheritance_received_date || "",
    legacy_of_deceased_settled: account?.legacy_of_deceased_settled || false,
    legacy_settlement_date: account?.legacy_settlement_date || "",
    entity_managed_by_fiduciary_trust: account?.entity_managed_by_fiduciary_trust || false,
    entity_managed_by_asset_manager: account?.entity_managed_by_asset_manager || false,
    gross_income_from_financial_assets: account?.gross_income_from_financial_assets || false,
    current_address: account?.current_address || {
      street: "",
      city: "",
      state: "",
      postal_code: "",
      country: ""
    },
    country_of_residence: account?.country_of_residence || "",
    current_email: account?.current_email || "",
    current_phone: account?.current_phone || "",
    year_end_cash_value: account?.year_end_cash_value ?? 0,
    year_end_cash_value_currency: account?.year_end_cash_value_currency || "USD",
    gross_payments: account?.gross_payments ?? 0,
    gross_payments_currency: account?.gross_payments_currency || "USD",
    reporting_year: account?.reporting_year || new Date().getFullYear().toString(),
    reportability_status: account?.reportability_status || "pending_review",
    status: account?.status || "active",
    account_holder_address: account?.account_holder_address || {
      street: "",
      city: "",
      state: "",
      postal_code: "",
      country: ""
    },
    tax_residencies: account?.tax_residencies || [],
    beneficiaries_count: account?.beneficiaries_count || 0,
    controlling_persons_count: account?.controlling_persons_count || 0,
    needs_reclassification: account?.needs_reclassification || false,
    self_certification_document_url: account?.self_certification_document_url || null,
    self_certification_document_name: account?.self_certification_document_name || null,
    self_certification_upload_date: account?.self_certification_upload_date || null,
    self_certification_obtained: account?.self_certification_obtained || false,
    self_certification_date: account?.self_certification_date || null,
    self_certification_request_date: account?.self_certification_request_date || "",
    self_certification_overdue: account?.self_certification_overdue || false,
    documents: account?.documents || [],
    crs_entity_classification: account?.crs_entity_classification || "",
    fatca_entity_classification: account?.fatca_entity_classification || "",
    account_number_type: account?.account_number_type || "",
    // Individual name extras
    middle_name: account?.middle_name || "",
    name_prefix: account?.name_prefix || "",
    title: account?.title || "",
    // Entity holder extras
    date_of_incorporation: account?.date_of_incorporation || "",
    country_of_incorporation: account?.country_of_incorporation || "",
    country_of_incorporation_code: account?.country_of_incorporation_code || "",
    type_of_financial_institution: account?.type_of_financial_institution || "",
    entity_classification: account?.entity_classification || "",
    // CRS flags
    is_recalcitrant: account?.is_recalcitrant || false,
    account_frozen_at_reporting_date: account?.account_frozen_at_reporting_date || false,
    account_dormant_at_reporting_date: account?.account_dormant_at_reporting_date || false,
    acct_holder_address_unchanged: account?.acct_holder_address_unchanged || false,
    us_person_indic: account?.us_person_indic || false,
  });

  const [isPreExistingLocked, setIsPreExistingLocked] = useState(false);
  const isGrossIncomeLocked = account !== undefined && account !== null && account.gross_income_from_financial_assets !== undefined && account.gross_income_from_financial_assets !== null;

  // Investment Entity Type A: if the RFI entity is an investment_entity, fiduciary trust is always Yes and locked
  const selectedEntity = entities?.find(e => e.id === formData.entity_id);
  const isFiduciaryTrustLocked = selectedEntity?.fi_type === 'investment_entity' ||
    selectedEntity?.fi_type === 'Type A Investment entity' ||
    (typeof selectedEntity?.fi_type === 'string' && selectedEntity.fi_type.toLowerCase().includes('investment_entity')) ||
    (typeof selectedEntity?.fi_type === 'string' && selectedEntity.fi_type.toLowerCase().includes('type a') && selectedEntity.fi_type.toLowerCase().includes('investment'));
  const [detectedChanges, setDetectedChanges] = useState([]);
  const [initialData, setInitialData] = useState(null);
  const [accountNumberError, setAccountNumberError] = useState("");
  const [accountNumberTypeError, setAccountNumberTypeError] = useState("");
  const [ibanSuggestion, setIbanSuggestion] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [showSmartUpload, setShowSmartUpload] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (account) {
      setInitialData(JSON.parse(JSON.stringify(account)));
    }
    loadReferencedData();
  }, [account]);

  const loadReferencedData = async () => {
    try {
      const data = await base44.entities.ReferencedData.filter({ is_published: true });
      setReferencedData(data);
    } catch (error) {
      console.error("Error loading referenced data:", error);
    }
  };

  // Auto-determine if account is pre-existing based on account creation date
  // If a valid date is present, lock the field; otherwise leave it editable
  useEffect(() => {
    if (formData.account_creation_date) {
      const creationDate = new Date(formData.account_creation_date);
      const crsThresholdDate = new Date('2018-12-31');
      const isPreExisting = creationDate <= crsThresholdDate;
      setFormData(prev => ({ ...prev, is_pre_existing: isPreExisting }));
      setIsPreExistingLocked(true);
    } else {
      setIsPreExistingLocked(false);
    }
  }, [formData.account_creation_date]);

  // Force fiduciary trust = true for Investment Entity workflow
  useEffect(() => {
    if (isFiduciaryTrustLocked && !formData.entity_managed_by_fiduciary_trust) {
      setFormData(prev => ({ ...prev, entity_managed_by_fiduciary_trust: true }));
    }
  }, [isFiduciaryTrustLocked, formData.entity_id]);

  // Handle "Same as Original Address" checkbox
  useEffect(() => {
    if (isCurrentAddressSameAsOriginal) {
      setFormData(prev => ({
        ...prev,
        current_address: { ...prev.account_holder_address }
      }));
    }
  }, [isCurrentAddressSameAsOriginal, formData.account_holder_address]);

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

  const ACCOUNT_NUMBER_TYPE_CODE_MAP = {
    "IBAN": "OECD601",
    "Bank account number (non-IBAN)": "OECD602",
    "ISIN": "OECD603",
    "Securities account number (non-ISIN)": "OECD604",
    "Other account identifier": "OECD605",
    "No account number exists": null
  };

  const validateIBAN = (value) => /^[A-Z]{2}\d{2}[A-Z0-9]{1,30}$/.test(value) && value.length <= 34;
  const validateISIN = (value) => /^[A-Z]{2}\d{9}[0-9]$/.test(value) && value.length === 12;

  const validateAccountNumberFormat = (number, type) => {
    if (!type || type === "No account number exists") return "";
    if (!number) return "";
    if (type === "IBAN" && !validateIBAN(number.toUpperCase())) {
      return "This does not appear to be a valid IBAN. An IBAN starts with a 2-letter country code, followed by 2 digits, then up to 30 letters and numbers (maximum 34 characters total).";
    }
    if (type === "ISIN" && !validateISIN(number.toUpperCase())) {
      return "This does not appear to be a valid ISIN. An ISIN must be exactly 12 characters: a 2-letter country code, 9 digits, and 1 check digit.";
    }
    return "";
  };

  const looksLikeIBAN = (value) => value && /^[A-Z]{2}\d{2}[A-Z0-9]/.test(value.toUpperCase()) && value.length >= 15 && value.length <= 34;

  const handleAccountNumberChange = (value) => {
    handleChange("account_number", value);
    setAccountNumberError("");
    // Real-time format validation
    const formatErr = validateAccountNumberFormat(value, formData.account_number_type);
    setAccountNumberTypeError(formatErr);
    // IBAN suggestion: only show if no type set yet and looks like IBAN
    setIbanSuggestion(!formData.account_number_type && looksLikeIBAN(value));
  };

  const handleAccountNumberTypeChange = (value) => {
    handleChange("account_number_type", value);
    setIbanSuggestion(false);
    // Re-validate existing number against new type
    if (value !== "No account number exists") {
      const formatErr = validateAccountNumberFormat(formData.account_number, value);
      setAccountNumberTypeError(formatErr);
    } else {
      setAccountNumberTypeError("");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitted(true);
    
    // Validate account number uniqueness
    const isValid = await validateAccountNumber(formData.account_number, formData.entity_id);
    if (!isValid) return;

    // GAP 27: Validate account number type/format
    if (formData.account_number_type !== "No account number exists") {
      if (!formData.account_number?.trim()) {
        const holderName = formData.account_holder_name || `${formData.first_name} ${formData.last_name}`.trim() || "this account";
        alert(`Please enter an account number for ${holderName}, or select 'No account number exists' if one is not available.`);
        return;
      }
      const formatErr = validateAccountNumberFormat(formData.account_number, formData.account_number_type);
      if (formatErr) {
        setAccountNumberTypeError(formatErr);
        return;
      }
    }
    
    // Validate mandatory fields for individual accounts
    if (formData.account_holder_type === 'individual') {
      if (!formData.first_name?.trim()) {
        alert("First Name is required for individual accounts");
        return;
      }
      if (!formData.last_name?.trim()) {
        alert("Last Name is required for individual accounts");
        return;
      }

    }
    
    // Validate mandatory fields for entity accounts
    if (formData.account_holder_type === 'entity') {
      if (!formData.account_holder_name?.trim()) {
        alert("Account Holder Name is required for entity accounts");
        return;
      }
    }
    
    // Validate mandatory address fields for both individual and entity accounts
    if (!formData.current_address?.street?.trim() || !formData.current_address?.city?.trim() || 
        !formData.current_address?.state?.trim() || !formData.current_address?.postal_code?.trim() || 
        !formData.current_address?.country?.trim()) {
      alert("Current Address (all fields) is required");
      return;
    }
    if (!formData.account_holder_address?.street?.trim() || !formData.account_holder_address?.city?.trim() || 
        !formData.account_holder_address?.state?.trim() || !formData.account_holder_address?.postal_code?.trim() || 
        !formData.account_holder_address?.country?.trim()) {
      alert("Original Address (all fields) is required");
      return;
    }
    
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
    
    // For individual accounts, construct account_holder_name from first_name and last_name
    if (formData.account_holder_type === 'individual') {
      updatedData.account_holder_name = `${formData.first_name} ${formData.last_name}`.trim();
    }

    onSubmit(updatedData);
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Handle AI suggestion application
  const handleAISuggestionApply = (field, value) => {
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      setFormData(prev => ({
        ...prev,
        [parent]: { ...prev[parent], [child]: value }
      }));
    } else {
      handleChange(field, value);
    }
  };

  // Handle smart document data extraction
  const handleSmartDocumentData = ({ data, fileUrl, fileName }) => {
    const updates = {};
    
    if (data.full_name) updates.account_holder_name = data.full_name;
    if (data.date_of_birth) updates.date_of_birth = data.date_of_birth;
    if (data.place_of_birth) updates.place_of_birth = data.place_of_birth;
    if (data.current_address) {
      updates.current_address = {
        ...formData.current_address,
        ...data.current_address
      };
    }
    if (data.tax_residencies && data.tax_residencies.length > 0) {
      updates.tax_residencies = data.tax_residencies;
    }
    
    setFormData(prev => ({ ...prev, ...updates }));
    setShowSmartUpload(false);
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
      {/* AI Form Assistant */}
      <AIFormAssistant
        formData={formData}
        formType="account"
        tenant={tenant}
        onSuggestionApply={handleAISuggestionApply}
        onSubmit={() => document.getElementById("account-form-submit-btn")?.click()}
      />

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
              <Label htmlFor="entity_id" className="text-slate-700">
                Related Entity <span className="text-red-600">*</span>
              </Label>
              <Select
                value={formData.entity_id}
                onValueChange={(value) => handleChange("entity_id", value)}
              >
                <SelectTrigger className={`mt-1.5 ${submitted && !formData.entity_id ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}`}>
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

            <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Account Number Type */}
              <div>
                <Label htmlFor="account_number_type" className="text-slate-700">
                  What type of account number is this?
                </Label>
                <Select
                  value={formData.account_number_type}
                  onValueChange={handleAccountNumberTypeChange}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder="Select type..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="IBAN">IBAN (International Bank Account Number)</SelectItem>
                    <SelectItem value="Bank account number (non-IBAN)">Bank account number (non-IBAN)</SelectItem>
                    <SelectItem value="ISIN">ISIN (International Securities Identification Number)</SelectItem>
                    <SelectItem value="Securities account number (non-ISIN)">Securities account number (non-ISIN)</SelectItem>
                    <SelectItem value="Other account identifier">Other account identifier</SelectItem>
                    <SelectItem value="No account number exists">No account number exists</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Account Number — hidden when "No account number exists" */}
              {formData.account_number_type !== "No account number exists" && (
                <div>
                  <Label htmlFor="account_number" className="text-slate-700">
                    Account Number <span className="text-red-600">*</span>
                  </Label>
                  <Input
                    id="account_number"
                    value={formData.account_number}
                    onChange={(e) => handleAccountNumberChange(e.target.value)}
                    onBlur={() => {
                      if (formData.account_number && formData.entity_id) {
                        validateAccountNumber(formData.account_number, formData.entity_id);
                      }
                    }}
                    placeholder="e.g., ACC-123456"
                    className={`mt-1.5 ${accountNumberError || accountNumberTypeError ? 'border-red-500 focus:ring-red-500' : submitted && !formData.account_number ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}`}
                  />
                  {accountNumberError && (
                    <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      {accountNumberError}
                    </p>
                  )}
                  {accountNumberTypeError && (
                    <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      {accountNumberTypeError}
                    </p>
                  )}
                  {ibanSuggestion && (
                    <p className="text-xs text-amber-700 mt-1 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                      This account number looks like an IBAN — would you like to set the type to IBAN so it can be validated correctly?
                      <button
                        type="button"
                        className="ml-2 underline font-medium"
                        onClick={() => handleAccountNumberTypeChange("IBAN")}
                      >
                        Set to IBAN
                      </button>
                    </p>
                  )}
                </div>
              )}
            </div>

            <div>
              <Label htmlFor="account_creation_date" className="text-slate-700">
                Account Opening Date <span className="text-red-600">*</span>
              </Label>
              <Input
                id="account_creation_date"
                type="date"
                value={formData.account_creation_date}
                onChange={(e) => handleChange("account_creation_date", e.target.value)}
                required
                className={`mt-1.5 ${submitted && !formData.account_creation_date ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}`}
              />
              <p className="text-xs text-slate-500 mt-1">
                Date when the account was originally opened
              </p>
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

            {formData.account_holder_type === "entity" && (
            <div>
              <Label htmlFor="account_holder_entity_type" className="text-slate-700">
                Account Holder Entity Type
              </Label>
              <Select
                value={formData.account_holder_entity_type}
                onValueChange={(value) => handleChange("account_holder_entity_type", value === "__clear__" ? "" : value)}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="Select entity type..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__clear__"><span className="text-slate-400 italic">— Clear selection —</span></SelectItem>
                  {(() => {
                    // Use only ReferencedData as the single source of truth, deduplicated by value
                    const dbItems = referencedData
                      .filter(item => item.entity_name === 'Account' && item.field_name === 'account_holder_entity_type')
                      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
                    // Deduplicate by value — keep first occurrence
                    const seen = new Set();
                    const allOptions = dbItems.filter(i => {
                      if (seen.has(i.value)) return false;
                      seen.add(i.value);
                      return true;
                    }).map(i => ({ value: i.value, label: i.label }));
                    // Always include current value even if not in list (for legacy data)
                    if (formData.account_holder_entity_type && !allOptions.find(o => o.value === formData.account_holder_entity_type)) {
                      allOptions.unshift({ value: formData.account_holder_entity_type, label: formData.account_holder_entity_type });
                    }
                    return allOptions.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ));
                  })()}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500 mt-1">
                Type of entity holding this account
              </p>
            </div>
            )}

            {formData.account_holder_type === "entity" && (
              <>
                <div>
                  <Label htmlFor="account_holder_name" className="text-slate-700">
                    Account Holder Name <span className="text-red-600">*</span>
                  </Label>
                  <Input
                    id="account_holder_name"
                    value={formData.account_holder_name}
                    onChange={(e) => handleChange("account_holder_name", e.target.value)}
                    placeholder="Entity name"
                    required
                    className={`mt-1.5 ${submitted && !formData.account_holder_name ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}`}
                  />
                </div>

                <div>
                  <Label htmlFor="date_of_incorporation" className="text-slate-700">Date of Incorporation</Label>
                  <Input
                    id="date_of_incorporation"
                    type="date"
                    value={formData.date_of_incorporation}
                    onChange={(e) => handleChange("date_of_incorporation", e.target.value)}
                    className="mt-1.5"
                  />
                </div>

                <div>
                  <Label htmlFor="country_of_incorporation" className="text-slate-700">Country of Incorporation</Label>
                  <div className="mt-1.5">
                    <CountrySelect
                      value={formData.country_of_incorporation}
                      onValueChange={(value) => handleChange("country_of_incorporation", value)}
                      placeholder="Select country..."
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="entity_classification" className="text-slate-700">Entity Classification</Label>
                  <Select
                    value={formData.entity_classification}
                    onValueChange={(value) => handleChange("entity_classification", value === "__clear__" ? "" : value)}
                  >
                    <SelectTrigger className="mt-1.5">
                      <SelectValue placeholder="Select classification..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__clear__"><span className="text-slate-400 italic">— Clear selection —</span></SelectItem>
                      <SelectItem value="financial_institution">Financial Institution</SelectItem>
                      <SelectItem value="active_nfe">Active NFE</SelectItem>
                      <SelectItem value="passive_nfe">Passive NFE</SelectItem>
                      <SelectItem value="not_applicable">Not Applicable</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-slate-500 mt-1">Used to derive CRS AcctHolderType in XML</p>
                </div>

                <div>
                  <Label htmlFor="type_of_financial_institution" className="text-slate-700">Type of Financial Institution</Label>
                  <Select
                    value={formData.type_of_financial_institution || ""}
                    onValueChange={(value) => handleChange("type_of_financial_institution", value === "__clear__" ? "" : value)}
                  >
                    <SelectTrigger className="mt-1.5" id="type_of_financial_institution">
                      <SelectValue placeholder="Select type..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__clear__"><span className="text-slate-400 italic">— Clear selection —</span></SelectItem>
                      {FI_TYPE_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-slate-500 mt-1">Only if account holder is a financial institution</p>
                </div>
              </>
            )}

            {formData.account_holder_type === "individual" && (
              <>
                <div>
                  <Label htmlFor="name_prefix" className="text-slate-700">Name Prefix</Label>
                  <Input
                    id="name_prefix"
                    value={formData.name_prefix}
                    onChange={(e) => handleChange("name_prefix", e.target.value)}
                    placeholder="e.g. Mr, Mrs, Dr"
                    className="mt-1.5"
                  />
                </div>

                <div>
                  <Label htmlFor="title" className="text-slate-700">Title</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => handleChange("title", e.target.value)}
                    placeholder="e.g. Director, Prof"
                    className="mt-1.5"
                  />
                </div>

                <div>
                  <Label htmlFor="first_name" className="text-slate-700">
                    First Name <span className="text-red-600">*</span>
                  </Label>
                  <Input
                    id="first_name"
                    value={formData.first_name}
                    onChange={(e) => handleChange("first_name", e.target.value)}
                    placeholder="First name"
                    className={`mt-1.5 ${submitted && !formData.first_name ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}`}
                  />
                </div>

                <div>
                  <Label htmlFor="middle_name" className="text-slate-700">Middle Name</Label>
                  <Input
                    id="middle_name"
                    value={formData.middle_name}
                    onChange={(e) => handleChange("middle_name", e.target.value)}
                    placeholder="Middle name(s)"
                    className="mt-1.5"
                  />
                </div>

                <div>
                  <Label htmlFor="last_name" className="text-slate-700">
                    Last Name <span className="text-red-600">*</span>
                  </Label>
                  <Input
                    id="last_name"
                    value={formData.last_name}
                    onChange={(e) => handleChange("last_name", e.target.value)}
                    placeholder="Last name"
                    className={`mt-1.5 ${submitted && !formData.last_name ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}`}
                  />
                </div>
              </>
            )}

            {formData.account_holder_type === "individual" && (
              <>
                <div>
                  <Label htmlFor="date_of_birth" className="text-slate-700">
                    Date of Birth
                  </Label>
                  <Input
                    id="date_of_birth"
                    type="date"
                    value={formData.date_of_birth}
                    onChange={(e) => handleChange("date_of_birth", e.target.value)}
                    className="mt-1.5"
                  />
                </div>

                <div>
                  <Label htmlFor="place_of_birth" className="text-slate-700">
                    Place of Birth
                  </Label>
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
              <Label htmlFor="status">Account Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => handleChange("status", value)}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                  <SelectItem value="dormant">Dormant</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500 mt-1">
                Current operational status of the account
              </p>
            </div>

            <div>
              <Label htmlFor="current_email" className="text-slate-700">
                Current Email Address <span className="text-red-600">*</span>
              </Label>
              <Input
                id="current_email"
                type="email"
                value={formData.current_email}
                onChange={(e) => handleChange("current_email", e.target.value)}
                placeholder="email@example.com"
                required
                className={`mt-1.5 ${submitted && !formData.current_email ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}`}
              />
            </div>

            <div>
              <Label htmlFor="current_phone" className="text-slate-700">
                Current Phone Number <span className="text-red-600">*</span>
              </Label>
              <Input
                id="current_phone"
                type="tel"
                value={formData.current_phone}
                onChange={(e) => handleChange("current_phone", e.target.value)}
                placeholder="+1234567890"
                required
                className={`mt-1.5 ${submitted && !formData.current_phone ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}`}
              />
            </div>
          </div>

          {/* Original Address Section */}
          <div className="mt-6">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">
              Original Address <span className="text-red-600">*</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Label htmlFor="holder_street" className="text-slate-700">
                  Street Address <span className="text-red-600">*</span>
                </Label>
                <Input
                  id="holder_street"
                  value={formData.account_holder_address?.street || ""}
                  onChange={(e) => handleAddressChange("street", e.target.value)}
                  placeholder="123 Main Street"
                  autoComplete="off"
                  className={`mt-1.5 ${submitted && !formData.account_holder_address?.street ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}`}
                />
              </div>

              <div>
                <Label htmlFor="holder_city" className="text-slate-700">
                  City <span className="text-red-600">*</span>
                </Label>
                <Input
                  id="holder_city"
                  value={formData.account_holder_address?.city || ""}
                  onChange={(e) => handleAddressChange("city", e.target.value)}
                  placeholder="City"
                  autoComplete="off"
                  className={`mt-1.5 ${submitted && !formData.account_holder_address?.city ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}`}
                />
              </div>

              <div>
                <Label htmlFor="holder_state" className="text-slate-700">
                  State/Province <span className="text-red-600">*</span>
                </Label>
                <Input
                  id="holder_state"
                  value={formData.account_holder_address?.state || ""}
                  onChange={(e) => handleAddressChange("state", e.target.value)}
                  placeholder="State/Province"
                  autoComplete="off"
                  className={`mt-1.5 ${submitted && !formData.account_holder_address?.state ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}`}
                />
              </div>

              <div>
                <Label htmlFor="holder_postal_code" className="text-slate-700">
                  Postal Code <span className="text-red-600">*</span>
                </Label>
                <Input
                  id="holder_postal_code"
                  value={formData.account_holder_address?.postal_code || ""}
                  onChange={(e) => handleAddressChange("postal_code", e.target.value)}
                  placeholder="Postal Code"
                  autoComplete="off"
                  className={`mt-1.5 ${submitted && !formData.account_holder_address?.postal_code ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}`}
                />
              </div>

              <div>
                <Label htmlFor="holder_country" className="text-slate-700">
                  Country <span className="text-red-600">*</span>
                </Label>
                <div className="mt-1.5">
                  <CountrySelect
                    value={formData.account_holder_address?.country || ""}
                    onValueChange={(value) => handleAddressChange("country", value)}
                    placeholder="Select country..."
                    className={submitted && !formData.account_holder_address?.country ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Current Address Section */}
          <div className="mt-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-700">
                Current Address <span className="text-red-600">*</span>
              </h3>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="same_as_original"
                  checked={isCurrentAddressSameAsOriginal}
                  onCheckedChange={setIsCurrentAddressSameAsOriginal}
                />
                <Label htmlFor="same_as_original" className="text-sm font-normal cursor-pointer">
                  Same as Original Address
                </Label>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Label htmlFor="current_street" className="text-slate-700">
                  Street Address <span className="text-red-600">*</span>
                </Label>
                <Input
                  id="current_street"
                  value={formData.current_address?.street || ""}
                  onChange={(e) => handleCurrentAddressChange("street", e.target.value)}
                  placeholder="123 Main Street"
                  disabled={isCurrentAddressSameAsOriginal}
                  autoComplete="off"
                  className={`mt-1.5 ${submitted && !formData.current_address?.street ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}`}
                />
              </div>

              <div>
                <Label htmlFor="current_city" className="text-slate-700">
                  City <span className="text-red-600">*</span>
                </Label>
                <Input
                  id="current_city"
                  value={formData.current_address?.city || ""}
                  onChange={(e) => handleCurrentAddressChange("city", e.target.value)}
                  placeholder="City"
                  disabled={isCurrentAddressSameAsOriginal}
                  autoComplete="off"
                  className={`mt-1.5 ${submitted && !formData.current_address?.city ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}`}
                />
              </div>

              <div>
                <Label htmlFor="current_state" className="text-slate-700">
                  State/Province <span className="text-red-600">*</span>
                </Label>
                <Input
                  id="current_state"
                  value={formData.current_address?.state || ""}
                  onChange={(e) => handleCurrentAddressChange("state", e.target.value)}
                  placeholder="State/Province"
                  disabled={isCurrentAddressSameAsOriginal}
                  autoComplete="off"
                  className={`mt-1.5 ${submitted && !formData.current_address?.state ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}`}
                />
              </div>

              <div>
                <Label htmlFor="current_postal_code" className="text-slate-700">
                  Postal Code <span className="text-red-600">*</span>
                </Label>
                <Input
                  id="current_postal_code"
                  value={formData.current_address?.postal_code || ""}
                  onChange={(e) => handleCurrentAddressChange("postal_code", e.target.value)}
                  placeholder="Postal Code"
                  disabled={isCurrentAddressSameAsOriginal}
                  autoComplete="off"
                  className={`mt-1.5 ${submitted && !formData.current_address?.postal_code ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}`}
                />
              </div>

              <div>
                <Label htmlFor="current_country" className="text-slate-700">
                  Country <span className="text-red-600">*</span>
                </Label>
                <div className="mt-1.5">
                  <CountrySelect
                    value={formData.current_address?.country || ""}
                    onValueChange={(value) => handleCurrentAddressChange("country", value)}
                    placeholder="Select country..."
                    disabled={isCurrentAddressSameAsOriginal}
                    className={submitted && !formData.current_address?.country ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}
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
                  onChange={(e) => {
                    const val = e.target.value;
                    handleChange("year_end_cash_value", val === "" ? "" : parseFloat(val));
                  }}
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
                  onChange={(e) => {
                    const val = e.target.value;
                    handleChange("gross_payments", val === "" ? "" : parseFloat(val));
                  }}
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
                disabled={!account}
              >
                <SelectTrigger className="mt-1.5 bg-slate-50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending_review">Pending Review</SelectItem>
                  <SelectItem value="reportable">Reportable</SelectItem>
                  <SelectItem value="non_reportable">Non-Reportable</SelectItem>
                  <SelectItem value="excluded">Excluded</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500 mt-1">
                {!account ? "New accounts default to Pending Review status" : "Classification workflow updates this status"}
              </p>
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
                    onValueChange={isPreExistingLocked ? undefined : (value) => handleChange("is_pre_existing", value === "yes")}
                    className="flex gap-4"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="yes" id="pre_existing_yes" disabled={isPreExistingLocked} />
                      <Label htmlFor="pre_existing_yes" className={`font-normal ${isPreExistingLocked ? 'cursor-default' : 'cursor-pointer'}`}>
                        Yes
                        {isPreExistingLocked && formData.is_pre_existing && <Lock className="inline w-3 h-3 ml-1 opacity-40" />}
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="no" id="pre_existing_no" disabled={isPreExistingLocked} />
                      <Label htmlFor="pre_existing_no" className={`font-normal ${isPreExistingLocked ? 'cursor-default' : 'cursor-pointer'}`}>
                        No
                        {isPreExistingLocked && !formData.is_pre_existing && <Lock className="inline w-3 h-3 ml-1 opacity-40" />}
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
                  <Label className="flex items-center gap-1.5">
                    Entity Professionally Managed by Fiduciary Trust?
                    {isFiduciaryTrustLocked && <Lock className="w-3 h-3 text-slate-400" />}
                  </Label>
                  <RadioGroup
                    value={formData.entity_managed_by_fiduciary_trust ? "yes" : "no"}
                    onValueChange={isFiduciaryTrustLocked ? undefined : (value) => handleChange("entity_managed_by_fiduciary_trust", value === "yes")}
                    className="flex gap-4 mt-1.5"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="yes" id="fiduciary_yes" disabled={isFiduciaryTrustLocked} />
                      <Label htmlFor="fiduciary_yes" className={`font-normal ${isFiduciaryTrustLocked ? 'cursor-default' : 'cursor-pointer'}`}>Yes</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="no" id="fiduciary_no" disabled={isFiduciaryTrustLocked} />
                      <Label htmlFor="fiduciary_no" className={`font-normal ${isFiduciaryTrustLocked ? 'cursor-default' : 'cursor-pointer'}`}>No</Label>
                    </div>
                  </RadioGroup>
                  {isFiduciaryTrustLocked && (
                    <p className="text-xs text-slate-500 mt-1">
                      Automatically set — this RFI is an Investment Entity (Type A).
                    </p>
                  )}
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
                  <Label className="flex items-center gap-1.5">
                    Gross Income &gt;50% from (Re)-Investing/Trading in Financial Assets?
                    {isGrossIncomeLocked && <Lock className="w-3 h-3 text-slate-400" />}
                  </Label>
                  <RadioGroup
                    value={formData.gross_income_from_financial_assets ? "yes" : "no"}
                    onValueChange={isGrossIncomeLocked ? undefined : (value) => handleChange("gross_income_from_financial_assets", value === "yes")}
                    className="flex gap-4 mt-1.5"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="yes" id="gross_income_yes" disabled={isGrossIncomeLocked} />
                      <Label htmlFor="gross_income_yes" className={`font-normal ${isGrossIncomeLocked ? 'cursor-default opacity-60' : 'cursor-pointer'}`}>Yes</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="no" id="gross_income_no" disabled={isGrossIncomeLocked} />
                      <Label htmlFor="gross_income_no" className={`font-normal ${isGrossIncomeLocked ? 'cursor-default opacity-60' : 'cursor-pointer'}`}>No</Label>
                    </div>
                  </RadioGroup>
                  {isGrossIncomeLocked && (
                    <p className="text-xs text-slate-500 mt-1">
                      Automatically set — this value is read-only based on provided account data.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Beneficiaries Section - Only for Deceased Account Holders */}
          {formData.account_holder_type === "individual" && !formData.account_holder_is_alive && account?.id && (
            <div className="p-4 border-2 border-purple-200 rounded-lg bg-purple-50/30 mt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-slate-700">Beneficiaries</h3>
                <Badge variant="outline" className="bg-purple-100 text-purple-800">
                  {formData.beneficiaries_count || 0} Beneficiary(ies)
                </Badge>
              </div>
              <BeneficiaryManager 
                account={account} 
                tenant={tenant}
              />
            </div>
          )}

          {/* CRS Flags */}
          <div className="p-4 border-2 border-slate-200 rounded-lg bg-slate-50/30">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">CRS Reporting Flags</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-slate-700">Account Frozen at Reporting Date?</Label>
                <RadioGroup
                  value={formData.account_frozen_at_reporting_date ? "yes" : "no"}
                  onValueChange={(value) => handleChange("account_frozen_at_reporting_date", value === "yes")}
                  className="flex gap-4 mt-1.5"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="yes" id="frozen_yes" />
                    <Label htmlFor="frozen_yes" className="font-normal cursor-pointer">Yes</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="no" id="frozen_no" />
                    <Label htmlFor="frozen_no" className="font-normal cursor-pointer">No</Label>
                  </div>
                </RadioGroup>
              </div>

              <div>
                <Label className="text-sm font-medium text-slate-700">Account Dormant at Reporting Date?</Label>
                <RadioGroup
                  value={formData.account_dormant_at_reporting_date ? "yes" : "no"}
                  onValueChange={(value) => handleChange("account_dormant_at_reporting_date", value === "yes")}
                  className="flex gap-4 mt-1.5"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="yes" id="dormant_yes" />
                    <Label htmlFor="dormant_yes" className="font-normal cursor-pointer">Yes</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="no" id="dormant_no" />
                    <Label htmlFor="dormant_no" className="font-normal cursor-pointer">No</Label>
                  </div>
                </RadioGroup>
              </div>

              <div>
                <Label className="text-sm font-medium text-slate-700">Account Holder Address Unchanged?</Label>
                <RadioGroup
                  value={formData.acct_holder_address_unchanged ? "yes" : "no"}
                  onValueChange={(value) => handleChange("acct_holder_address_unchanged", value === "yes")}
                  className="flex gap-4 mt-1.5"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="yes" id="addr_unchanged_yes" />
                    <Label htmlFor="addr_unchanged_yes" className="font-normal cursor-pointer">Yes</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="no" id="addr_unchanged_no" />
                    <Label htmlFor="addr_unchanged_no" className="font-normal cursor-pointer">No</Label>
                  </div>
                </RadioGroup>
                <p className="text-xs text-slate-500 mt-1">Address unchanged since last reporting period</p>
              </div>

              {formData.account_holder_type === "individual" && (
                <div>
                  <Label className="text-sm font-medium text-slate-700">
                    Recalcitrant Account Holder?
                  </Label>
                  <RadioGroup
                    value={formData.is_recalcitrant ? "yes" : "no"}
                    onValueChange={(value) => handleChange("is_recalcitrant", value === "yes")}
                    className="flex gap-4 mt-1.5"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="yes" id="recalcitrant_yes" />
                      <Label htmlFor="recalcitrant_yes" className="font-normal cursor-pointer">Yes</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="no" id="recalcitrant_no" />
                      <Label htmlFor="recalcitrant_no" className="font-normal cursor-pointer">No</Label>
                    </div>
                  </RadioGroup>
                  <p className="text-xs text-slate-500 mt-1">Mandatory for Individual AccountHolder in CRS XML (Section 6.3.2.3.2.1)</p>
                </div>
              )}

              <div>
                <Label className="text-sm font-medium text-slate-700">US Person Indicator (FATCA)?</Label>
                <RadioGroup
                  value={formData.us_person_indic ? "yes" : "no"}
                  onValueChange={(value) => handleChange("us_person_indic", value === "yes")}
                  className="flex gap-4 mt-1.5"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="yes" id="us_person_yes" />
                    <Label htmlFor="us_person_yes" className="font-normal cursor-pointer">Yes</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="no" id="us_person_no" />
                    <Label htmlFor="us_person_no" className="font-normal cursor-pointer">No</Label>
                  </div>
                </RadioGroup>
                <p className="text-xs text-slate-500 mt-1">Indicates US status per FATCA</p>
              </div>
            </div>
          </div>

          {/* GAP 19: CRS & FATCA Organisation Classification */}
          {formData.account_holder_type === "entity" && (() => {
            const taxCountries = (formData.tax_residencies || []).map(r => r.country);
            const hasNonUS = taxCountries.some(c => c && c !== 'US');
            const hasUS = taxCountries.includes('US');
            if (!hasNonUS && !hasUS) return null;
            return (
              <div className="p-4 border-2 border-amber-200 rounded-lg bg-amber-50/30 mt-4 space-y-4">
                <h3 className="text-sm font-semibold text-slate-700">Organisation Tax Classification</h3>

                {hasNonUS && (
                  <div>
                    <Label className="text-sm font-medium text-slate-700">
                      What best describes this organisation's status for CRS reporting? <span className="text-red-600">*</span>
                    </Label>
                    <p className="text-xs text-slate-500 mt-0.5 mb-2">Required because this organisation has non-US tax residencies.</p>
                    <Select
                      value={formData.crs_entity_classification}
                      onValueChange={(value) => handleChange("crs_entity_classification", value === "__clear__" ? "" : value)}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select CRS classification..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__clear__"><span className="text-slate-400 italic">— Clear selection —</span></SelectItem>
                        <SelectItem value="CRS101">Passive entity (e.g. holding company, trust, foundation) with one or more controlling persons who are tax residents of a reportable country</SelectItem>
                        <SelectItem value="CRS102">Active or financial entity that is itself a tax resident of a reportable country</SelectItem>
                        <SelectItem value="CRS103">Passive entity that is itself also a tax resident of a reportable country</SelectItem>
                      </SelectContent>
                    </Select>
                    {formData.crs_entity_classification === 'CRS102' || formData.crs_entity_classification === 'CRS103' ? (
                      <p className="text-xs text-blue-700 mt-1 bg-blue-50 border border-blue-200 rounded px-2 py-1">
                        Controlling Persons are not required for this classification and will not be emitted in the XML.
                      </p>
                    ) : null}
                  </div>
                )}

                {hasUS && (
                  <div>
                    <Label className="text-sm font-medium text-slate-700">
                      What best describes this organisation's US tax status? <span className="text-red-600">*</span>
                    </Label>
                    <p className="text-xs text-slate-500 mt-0.5 mb-2">Required because this organisation has a US tax residency.</p>
                    <Select
                      value={formData.fatca_entity_classification}
                      onValueChange={(value) => handleChange("fatca_entity_classification", value === "__clear__" ? "" : value)}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select FATCA classification..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__clear__"><span className="text-slate-400 italic">— Clear selection —</span></SelectItem>
                        <SelectItem value="FATCA101">Entity that documents its US owners (Owner-Documented FI)</SelectItem>
                        <SelectItem value="FATCA102">Passive entity with substantial US owners (e.g. passive holding company owned by US persons)</SelectItem>
                        <SelectItem value="FATCA103">Non-participating foreign financial institution</SelectItem>
                        <SelectItem value="FATCA104">Specified US Person (US company or individual-equivalent entity)</SelectItem>
                        <SelectItem value="FATCA105">Direct Reporting NFFE</SelectItem>
                      </SelectContent>
                    </Select>
                    {['FATCA101', 'FATCA102'].includes(formData.fatca_entity_classification) ? (
                      <p className="text-xs text-amber-700 mt-1 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                        At least one Substantial Owner (Controlling Person) must be added for this classification.
                      </p>
                    ) : null}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Controlling Persons Section - Only for Entity Account Holders */}
          {formData.account_holder_type === "entity" && account?.id && (() => {
            const crsClass = formData.crs_entity_classification;
            const fatcaClass = formData.fatca_entity_classification;
            // CRS102/CRS103: hide controlling persons
            if (crsClass === 'CRS102' || crsClass === 'CRS103') return null;
            // If only FATCA is set and it's FATCA103/104/105: hide controlling persons
            if (!crsClass && ['FATCA103', 'FATCA104', 'FATCA105'].includes(fatcaClass)) return null;
            return (
              <div className="p-4 border-2 border-indigo-200 rounded-lg bg-indigo-50/30 mt-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-slate-700">Controlling Persons</h3>
                  <Badge variant="outline" className="bg-indigo-100 text-indigo-800">
                    {formData.controlling_persons_count || 0} Controlling Person(s)
                  </Badge>
                </div>
                <ControllingPersonManager 
                  account={account} 
                  tenant={tenant}
                />
              </div>
            );
          })()}
        </TabsContent>

        <TabsContent value="tax" className="space-y-4 mt-4">
          <TaxResidencyManager
            residencies={formData.tax_residencies}
            onChange={handleTaxResidenciesChange}
            accountHolderType={formData.account_holder_type}
          />
        </TabsContent>

        <TabsContent value="documents" className="space-y-4 mt-4">
          {/* Self-Certification Tracking */}
          <div className="p-4 border-2 border-amber-100 rounded-lg bg-amber-50/30">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Self-Certification Tracking</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="self_certification_request_date">Request Date</Label>
                <Input
                  id="self_certification_request_date"
                  type="date"
                  value={formData.self_certification_request_date}
                  onChange={(e) => handleChange("self_certification_request_date", e.target.value)}
                  className="mt-1.5"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Date when new self-certification was requested
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <Label>Overdue Status</Label>
                  {formData.self_certification_overdue && (
                    <Badge className="bg-red-100 text-red-800 border-red-300 text-xs">
                      <AlertCircle className="w-3 h-3 mr-1" />
                      90+ Days Overdue
                    </Badge>
                  )}
                </div>
                <div className="mt-2 p-3 bg-slate-50 border border-slate-200 rounded">
                  <p className="text-xs text-slate-600">
                    {formData.self_certification_overdue 
                      ? "This account is flagged as overdue (90+ days since request)"
                      : formData.self_certification_request_date
                        ? "Monitoring for 90-day threshold"
                        : "No request date set"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Smart Document Parser */}
          {showSmartUpload ? (
            <div className="space-y-4">
              <SmartDocumentParser
                onDataExtracted={handleSmartDocumentData}
                documentType="self_certification"
                title="AI-Powered Document Upload"
              />
              <Button 
                variant="outline" 
                onClick={() => setShowSmartUpload(false)}
                className="w-full"
              >
                Cancel Smart Upload
              </Button>
            </div>
          ) : (
            <div className="mb-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowSmartUpload(true)}
                className="w-full bg-gradient-to-r from-purple-50 to-indigo-50 hover:from-purple-100 hover:to-indigo-100 border-purple-200"
              >
                <Sparkles className="w-4 h-4 mr-2 text-purple-600" />
                Smart Upload: Auto-extract data from document
              </Button>
            </div>
          )}

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
          id="account-form-submit-btn"
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