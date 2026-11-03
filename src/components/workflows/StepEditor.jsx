import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Plus, Trash2, Save, Settings, Copy, Link as LinkIcon, HelpCircle, Zap, Sparkles, Info, Lock } from "lucide-react";
import MultiFieldEditor from "./MultiFieldEditor";
import ConditionGroupsBuilder from "./ConditionGroupsBuilder";
import MultiChoiceRoutingBuilder from "./MultiChoiceRoutingBuilder";
import SelectionCountBranching from "./SelectionCountBranching";
import StepTransitionConfig from "./StepTransitionConfig";

// Helper function to determine the field type of a workflow question
const getQuestionFieldType = (questionType) => {
  switch (questionType) {
    case 'yes_no': return 'boolean';
    case 'text_input':
    case 'single_choice':
    case 'multiple_choice': return 'string';
    case 'number_input': return 'number';
    case 'date_input': return 'date';
    case 'address_input': return 'object';
    default: return null;
  }
};

const ACCOUNT_FIELDS_SCHEMA = [
  // Core Account Fields
  { value: "account_number", label: "Account Number", type: "string" },
  { value: "account_number_type", label: "Account Number Type", type: "enum", enum: ["IBAN", "Bank account number (non-IBAN)", "ISIN", "Securities account number (non-ISIN)", "Other account identifier", "No account number exists"] },
  { value: "account_creation_date", label: "Account Creation Date", type: "date" },
  { value: "account_type", label: "Account Type", type: "enum", enum: ["depository", "custodial", "equity_debt_interest", "cash_value_insurance", "annuity"] },
  { value: "status", label: "Status", type: "enum", enum: ["active", "closed", "dormant"] },
  // Account Holder Identity
  { value: "account_holder_type", label: "Account Holder Type", type: "enum", enum: ["individual", "entity"] },
  { value: "account_holder_name", label: "Account Holder Name", type: "string" },
  { value: "account_holder_entity_type", label: "Account Holder Entity Type", type: "string" },
  { value: "first_name", label: "First Name", type: "string" },
  { value: "last_name", label: "Last Name", type: "string" },
  { value: "middle_name", label: "Middle Name", type: "string" },
  { value: "name_prefix", label: "Name Prefix", type: "string" },
  { value: "title", label: "Title", type: "string" },
  { value: "date_of_birth", label: "Date of Birth", type: "date" },
  { value: "place_of_birth", label: "Place of Birth", type: "string", isCountry: true },
  { value: "date_of_incorporation", label: "Date of Incorporation", type: "date" },
  { value: "country_of_incorporation_code", label: "Country of Incorporation Code", type: "string" },
  // Account Status Flags
  { value: "is_pre_existing", label: "Is Pre-existing", type: "boolean" },
  { value: "is_recalcitrant", label: "Is Recalcitrant", type: "boolean" },
  { value: "account_holder_is_alive", label: "Account Holder Is Alive", type: "boolean" },
  { value: "account_holder_deceased_during_period", label: "Account Holder Deceased During Period", type: "boolean" },
  { value: "account_closed_during_period", label: "Account Closed During Period", type: "boolean" },
  { value: "account_frozen_at_reporting_date", label: "Account Frozen at Reporting Date", type: "boolean" },
  { value: "account_dormant_at_reporting_date", label: "Account Dormant at Reporting Date", type: "boolean" },
  { value: "acct_holder_address_unchanged", label: "Account Holder Address Unchanged", type: "boolean" },
  // Deceased Workflow
  { value: "death_certificate_requested", label: "Death Certificate Requested", type: "boolean" },
  { value: "death_certificate_requested_date", label: "Death Certificate Requested Date", type: "date" },
  { value: "death_certificate_received", label: "Death Certificate Received", type: "boolean" },
  { value: "death_certificate_received_date", label: "Death Certificate Received Date", type: "date" },
  { value: "will_or_inheritance_requested", label: "Will or Inheritance Requested", type: "boolean" },
  { value: "will_or_inheritance_requested_date", label: "Will or Inheritance Requested Date", type: "date" },
  { value: "will_or_inheritance_received", label: "Will or Inheritance Received", type: "boolean" },
  { value: "will_or_inheritance_received_date", label: "Will or Inheritance Received Date", type: "date" },
  { value: "legacy_of_deceased_settled", label: "Legacy of Deceased Settled", type: "boolean" },
  { value: "legacy_settlement_date", label: "Legacy Settlement Date", type: "date" },
  // Entity Management
  { value: "entity_managed_by_fiduciary_trust", label: "Entity Managed by Fiduciary Trust", type: "boolean" },
  { value: "entity_managed_by_asset_manager", label: "Entity Managed by Asset Manager", type: "boolean" },
  { value: "gross_income_from_financial_assets", label: "Gross Income From Financial Assets", type: "boolean" },
  { value: "gross_income_50_passive", label: "Gross Income 50% Passive", type: "boolean" },
  // CRS Classification
  { value: "type_of_financial_institution", label: "Type of Financial Institution", type: "enum", enum: ["custodial_institution", "depository_institution", "investment_entity_type_a", "investment_entity_type_b", "specified_insurance_company"] },
  { value: "entity_classification", label: "Entity Classification", type: "enum", enum: ["financial_institution", "active_nfe", "passive_nfe", "not_applicable"] },
  { value: "crs_entity_classification", label: "CRS Entity Classification", type: "enum", enum: ["CRS101", "CRS102", "CRS103"] },
  { value: "fatca_entity_classification", label: "FATCA Entity Classification", type: "enum", enum: ["FATCA101", "FATCA102", "FATCA103", "FATCA104", "FATCA105"] },
  { value: "non_reportable_exception_type", label: "Non-Reportable Exception Type", type: "enum", enum: ["inheritance_estate", "escrow_court_decree", "qualifying_pension", "overdraft_deposit", "pre_existing_dormant_below_1k", "publicly_traded", "purely_domestic", "international_organization", "liquidation_dissolution", "none"] },
  { value: "potential_exception_type", label: "Potential Exception Type", type: "enum", enum: ["None", "DGA", "Foundation", "STAK", "HoldCo", "TreasuryCtr", "RealEstateFund"] },
  // Treasury Centre Fields
  { value: "treasury_activities_operational", label: "Treasury Activities Operational", type: "boolean" },
  { value: "treasury_part_of_nonfinancial_group", label: "Treasury Part of Non-Financial Group", type: "boolean" },
  { value: "treasury_main_fn_finance_hedge_group", label: "Treasury Main Function Finance/Hedge Group", type: "boolean" },
  { value: "treasury_50pct_passive_income_fails", label: "Treasury 50% Passive Income Fails", type: "boolean" },
  { value: "treasury_still_operational_despite_failing_50pct", label: "Treasury Still Operational Despite Failing 50%", type: "boolean" },
  // Contact & Address
  { value: "country_of_residence", label: "Country of Residence", type: "string", isCountry: true },
  { value: "current_email", label: "Current Email", type: "string" },
  { value: "current_phone", label: "Current Phone", type: "string" },
  { value: "current_address", label: "Current Address (Object)", type: "object" },
  { value: "current_address.street", label: "Current Address - Street", type: "string" },
  { value: "current_address.city", label: "Current Address - City", type: "string" },
  { value: "current_address.state", label: "Current Address - State", type: "string" },
  { value: "current_address.postal_code", label: "Current Address - Postal Code", type: "string" },
  { value: "current_address.country", label: "Current Address - Country", type: "string", isCountry: true },
  { value: "account_holder_address", label: "Account Holder Address (Object)", type: "object" },
  { value: "account_holder_address.street", label: "Account Holder Address - Street", type: "string" },
  { value: "account_holder_address.city", label: "Account Holder Address - City", type: "string" },
  { value: "account_holder_address.state", label: "Account Holder Address - State", type: "string" },
  { value: "account_holder_address.postal_code", label: "Account Holder Address - Postal Code", type: "string" },
  { value: "account_holder_address.country", label: "Account Holder Address - Country", type: "string", isCountry: true },
  // Tax Residency
  { value: "tax_residencies.country", label: "Tax Residency - Country", type: "string", isCountry: true },
  { value: "tax_residencies.tin", label: "Tax Residency - TIN", type: "string" },
  // Financial Values
  { value: "year_end_cash_value", label: "Year End Cash Value", type: "number" },
  { value: "year_end_cash_value_currency", label: "Year End Cash Value Currency", type: "string" },
  { value: "gross_payments", label: "Gross Payments", type: "number" },
  { value: "gross_payments_currency", label: "Gross Payments Currency", type: "string" },
  { value: "reporting_year", label: "Reporting Year", type: "string" },
  // Reportability
  { value: "reportability_status", label: "Reportability Status", type: "enum", enum: ["pending_review", "reportable", "non_reportable", "excluded", "work_in_progress"] },
  { value: "reportability_reason", label: "Reportability Reason", type: "string" },
  { value: "needs_reclassification", label: "Needs Reclassification", type: "boolean" },
  // US Indicia / FATCA
  { value: "us_person_indic", label: "US Person Indicia", type: "boolean" },
  { value: "indicia_details.citizenship", label: "Indicia - Citizenship", type: "string" },
  { value: "indicia_details.us_address", label: "Indicia - US Address", type: "boolean" },
  { value: "indicia_details.us_phone", label: "Indicia - US Phone", type: "boolean" },
  { value: "indicia_details.power_of_attorney", label: "Indicia - Power of Attorney", type: "boolean" },
  { value: "indicia_details.standing_instructions", label: "Indicia - Standing Instructions", type: "boolean" },
  // Self-Certification
  { value: "self_certification_obtained", label: "Self-Certification Obtained", type: "boolean" },
  { value: "self_certification_date", label: "Self-Certification Date", type: "date" },
  { value: "self_certification_request_date", label: "Self-Certification Request Date", type: "date" },
  { value: "self_certification_overdue", label: "Self-Certification Overdue", type: "boolean" },
  // Controlling Persons / Beneficiaries
  { value: "beneficiaries_count", label: "Beneficiaries Count", type: "number" },
  { value: "controlling_persons_count", label: "Controlling Persons Count", type: "number" },
  { value: "has_unclassified_controlling_persons", label: "Has Unclassified Controlling Persons", type: "boolean" },
];

const ENTITY_FIELDS_SCHEMA = [
  { value: "entity_name", label: "Entity Name", type: "string" },
  { value: "entity_type", label: "Entity Type", type: "string" },
  { value: "country_of_incorporation", label: "Country of Incorporation", type: "string", isCountry: true },
  { value: "tax_id", label: "Tax ID", type: "string" },
  { value: "giin", label: "GIIN", type: "string" },
  { value: "rfi_status", label: "RFI Status", type: "string" },
  { value: "fi_type", label: "FI Type", type: "string" },
  { value: "non_reporting_reason", label: "Non-Reporting Reason", type: "string" },
  { value: "classification_completed_date", label: "Classification Completed Date", type: "date" },
  { value: "address", label: "Address (Object)", type: "object" },
  { value: "address.street", label: "Address Street", type: "string" },
  { value: "address.city", label: "Address City", type: "string" },
  { value: "address.state", label: "Address State", type: "string" },
  { value: "address.postal_code", label: "Address Postal Code", type: "string" },
  { value: "address.country", label: "Address Country", type: "string", isCountry: true },
  { value: "status", label: "Status", type: "string" }
];

const CONTROLLING_PERSON_FIELDS_SCHEMA = [
  { value: "first_name", label: "First Name", type: "string" },
  { value: "last_name", label: "Last Name", type: "string" },
  { value: "full_name", label: "Full Name", type: "string" },
  { value: "date_of_birth", label: "Date of Birth", type: "date" },
  { value: "address.street", label: "Address - Street", type: "string" },
  { value: "address.city", label: "Address - City", type: "string" },
  { value: "address.state", label: "Address - State", type: "string" },
  { value: "address.postal_code", label: "Address - Postal Code", type: "string" },
  { value: "address.country", label: "Address - Country", type: "string", isCountry: true },
  { value: "tax_residencies.country", label: "Tax Residency - Country", type: "string", isCountry: true },
  { value: "tax_residencies.tin", label: "Tax Residency - TIN", type: "string" },
  { value: "control_type", label: "Control Type", type: "enum" },
  { value: "ownership_percentage", label: "Ownership Percentage", type: "number" },
  { value: "is_reportable", label: "Is Reportable", type: "boolean" },
  { value: "us_person_indic", label: "US Person Indicator", type: "boolean" },
  { value: "self_certification_request_date", label: "Self-Certification Request Date", type: "date" },
  { value: "self_certification_overdue", label: "Self-Certification Overdue", type: "boolean" }
];

const BENEFICIARY_FIELDS_SCHEMA = [
  { value: "first_name", label: "First Name", type: "string" },
  { value: "last_name", label: "Last Name", type: "string" },
  { value: "full_name", label: "Full Name", type: "string" },
  { value: "date_of_birth", label: "Date of Birth", type: "date" },
  { value: "place_of_birth", label: "Place of Birth", type: "string", isCountry: true },
  { value: "address.street", label: "Address - Street", type: "string" },
  { value: "address.city", label: "Address - City", type: "string" },
  { value: "address.state", label: "Address - State", type: "string" },
  { value: "address.postal_code", label: "Address - Postal Code", type: "string" },
  { value: "address.country", label: "Address - Country", type: "string", isCountry: true },
  { value: "tax_residencies.country", label: "Tax Residency - Country", type: "string", isCountry: true },
  { value: "tax_residencies.tin", label: "Tax Residency - TIN", type: "string" },
  { value: "reportability_status", label: "Reportability Status", type: "enum", enum: ["pending_review", "reportable", "non_reportable", "excluded", "work_in_progress"] },
  { value: "reportability_reason", label: "Reportability Reason", type: "string" }
];

const getFieldsForEntity = (entityType) => {
  let schema;
  switch (entityType) {
    case "Entity": schema = ENTITY_FIELDS_SCHEMA; break;
    case "Account": schema = ACCOUNT_FIELDS_SCHEMA; break;
    case "ControllingPerson": schema = CONTROLLING_PERSON_FIELDS_SCHEMA; break;
    case "Beneficiary": schema = BENEFICIARY_FIELDS_SCHEMA; break;
    default: schema = ACCOUNT_FIELDS_SCHEMA;
  }
  return schema.reduce((acc, field) => {
    acc[field.value] = { label: field.label, type: field.type, ...(field.enum ? { enum: field.enum } : {}) };
    return acc;
  }, {});
};

const getSuggestedValuesForField = (entityType, fieldName, referencedDataList = []) => {
  const referencedOptions = referencedDataList.filter(rd =>
    rd.entity_name === entityType && rd.field_name === fieldName
  );
  if (referencedOptions.length > 0) {
    return referencedOptions.sort((a, b) => (a.order || 0) - (b.order || 0)).map(rd => ({ value: rd.value, label: rd.label }));
  }
  const schema = getFieldsForEntity(entityType);
  const field = schema[fieldName];
  if (field?.enum) {
    return field.enum.map(val => ({ value: val, label: val.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) }));
  }
  if (field?.type === "boolean") {
    return [{ value: "true", label: "True" }, { value: "false", label: "False" }];
  }
  return null;
};

export { getFieldsForEntity, getSuggestedValuesForField };

export default function StepEditor({ step, allSteps, currentWorkflowId, onUpdate, onClose }) {
  const normalizedConditionalLogic = step.conditional_logic ? {
    ...step.conditional_logic,
    conditions: (step.conditional_logic.conditions || []).map(c => ({
      ...c,
      value_type: c.value_type || "static"
    })),
    option_values: Array.isArray(step.conditional_logic.option_values) ? step.conditional_logic.option_values : (step.conditional_logic.option_values ? [step.conditional_logic.option_values] : [])
  } : { conditions: [], next_step: "", else_step: "", option_values: [] };

  const [editedStep, setEditedStep] = useState({
    ...step,
    default_next_step: step.default_next_step || "",
    conditional_logic: normalizedConditionalLogic,
    mapped_field: step.mapped_field || { entity_type: "", field_name: "" }
  });
  const [showAdvancedLogic, setShowAdvancedLogic] = useState(step.conditional_logic?.conditions?.length > 0);
  const [isLoadingFields] = React.useState(false);

  const { data: referencedData = [] } = useQuery({
    queryKey: ['referenced-data-workflow-builder'],
    queryFn: () => base44.entities.ReferencedData.filter({ is_published: true }),
    staleTime: 60000
  });

  const accountFields = React.useMemo(() => ACCOUNT_FIELDS_SCHEMA.map(f => ({ ...f, group: "Account Fields" })), []);
  const entityFields = React.useMemo(() => ENTITY_FIELDS_SCHEMA.map(f => ({ ...f, group: "Entity Fields" })), []);
  const controllingPersonFields = React.useMemo(() => CONTROLLING_PERSON_FIELDS_SCHEMA.map(f => ({ ...f, group: "Controlling Person Fields" })), []);
  const beneficiaryFields = React.useMemo(() => BENEFICIARY_FIELDS_SCHEMA.map(f => ({ ...f, group: "Beneficiary Fields" })), []);

  const availableConditionFields = React.useMemo(() => {
    const fields = [];
    const currentStepIndex = allSteps.findIndex(s => s.step_id === editedStep.step_id);

    allSteps.forEach((s, idx) => {
      if (idx > currentStepIndex) return;
      fields.push({ value: s.step_id, label: `Step: ${s.step_title}`, type: s.question_type, isCountry: false, group: 'Workflow Steps' });
      if (s.question_type === 'multi_field_input' && s.multi_fields?.length > 0) {
        s.multi_fields.forEach(mf => {
          const isCountryField = mf.field_type === 'select' && (mf.referenced_data_key?.toLowerCase().includes('country') || mf.display_label?.toLowerCase().includes('country'));
          fields.push({ value: `${s.step_id}.${mf.field_id}`, label: `${s.step_title} → ${mf.display_label}`, type: mf.field_type, isCountry: isCountryField, group: 'Multi-Field Inputs' });
        });
      }
      if (s.question_type === 'address_input') {
        ['street', 'city', 'state', 'postal_code', 'country', 'tax_residency_country', 'tax_residency_tin'].forEach(id => {
          const labelMap = { tax_residency_country: 'Country of Tax Residence', tax_residency_tin: 'TIN' };
          fields.push({ value: `${s.step_id}.${id}`, label: `${s.step_title} → ${labelMap[id] || id}`, type: 'string', isCountry: id === 'country' || id === 'tax_residency_country', group: 'Address Inputs' });
        });
      }
    });

    allSteps.forEach(s => {
      if (s.question_type === 'address_input' && !fields.some(f => f.value === `${s.step_id}.country`)) {
        ['street', 'city', 'state', 'postal_code', 'country', 'tax_residency_country', 'tax_residency_tin'].forEach(id => {
          const labelMap = { tax_residency_country: 'Country of Tax Residence', tax_residency_tin: 'TIN' };
          fields.push({ value: `${s.step_id}.${id}`, label: `${s.step_title} → ${labelMap[id] || id}`, type: 'string', isCountry: id === 'country' || id === 'tax_residency_country', group: 'Address Inputs' });
        });
      }
    });

    [...accountFields, ...entityFields, ...controllingPersonFields, ...beneficiaryFields].forEach(f => fields.push(f));
    return fields;
  }, [allSteps, editedStep.step_id, accountFields, entityFields, controllingPersonFields, beneficiaryFields]);

  const handleChange = (field, value) => setEditedStep({ ...editedStep, [field]: value });

  const handleOptionChange = (index, field, value) => {
    const newOptions = [...editedStep.options];
    newOptions[index] = { ...newOptions[index], [field]: value };
    setEditedStep({ ...editedStep, options: newOptions });
  };

  const handleAddOption = () => setEditedStep({ ...editedStep, options: [...editedStep.options, { value: "", label: "", next_step: "", help_text: "" }] });
  const handleRemoveOption = (index) => setEditedStep({ ...editedStep, options: editedStep.options.filter((_, i) => i !== index) });

  const handleAddAction = () => {
    const currentActions = editedStep.post_completion_actions || [];
    setEditedStep({ ...editedStep, post_completion_actions: [...currentActions, { action_type: "update_entity_field", target_entity_type: "Entity", field_to_update: "", value_source: "from_step_answer", value: "" }] });
  };
  const handleRemoveAction = (index) => setEditedStep({ ...editedStep, post_completion_actions: editedStep.post_completion_actions.filter((_, i) => i !== index) });
  const handleActionChange = (index, field, value, additionalUpdates = {}) => {
    const newActions = [...editedStep.post_completion_actions];
    newActions[index] = { ...newActions[index], [field]: value, ...additionalUpdates };
    setEditedStep({ ...editedStep, post_completion_actions: newActions });
  };

  const handleAddCondition = () => {
    const newConditions = [...(editedStep.conditional_logic?.conditions || []), { field: "", operator: "=", value: "", value_type: "static", logic_operator: "AND" }];
    setEditedStep({ ...editedStep, conditional_logic: { ...editedStep.conditional_logic, conditions: newConditions } });
  };
  const handleRemoveCondition = (index) => {
    const newConditions = editedStep.conditional_logic.conditions.filter((_, i) => i !== index);
    setEditedStep({ ...editedStep, conditional_logic: { ...editedStep.conditional_logic, conditions: newConditions } });
  };
  const handleConditionChange = (index, field, value) => {
    const newConditions = [...editedStep.conditional_logic.conditions];
    const currentCondition = newConditions[index];
    newConditions[index] = { ...currentCondition, value_type: currentCondition.value_type || "static", [field]: value };
    if (field === 'field') {
      const selectedField = availableConditionFields.find(f => f.value === value);
      if (!selectedField?.isCountry && (newConditions[index].operator === 'is_crs' || newConditions[index].operator === 'is_not_crs')) {
        newConditions[index].operator = '=';
      }
    }
    setEditedStep({ ...editedStep, conditional_logic: { ...editedStep.conditional_logic, conditions: newConditions } });
  };
  const handleConditionalLogicChange = (field, value) => setEditedStep(prev => ({ ...prev, conditional_logic: { ...prev.conditional_logic, [field]: value } }));
  const handleMappedFieldChange = (field, value) => setEditedStep(prev => ({ ...prev, mapped_field: { ...prev.mapped_field, [field]: value } }));

  const filteredMappedFields = React.useMemo(() => {
    if (!editedStep.mapped_field?.entity_type) return [];
    let allFields = [];
    switch (editedStep.mapped_field.entity_type) {
      case "Account": allFields = accountFields; break;
      case "Entity": allFields = entityFields; break;
      case "ControllingPerson": allFields = controllingPersonFields; break;
      case "Beneficiary": allFields = beneficiaryFields; break;
      default: return [];
    }
    const questionFieldType = getQuestionFieldType(editedStep.question_type);
    if (!questionFieldType) return [];
    return allFields.filter(field => {
      if (editedStep.question_type === 'address_input') return field.type === 'object' && (field.value === 'current_address' || field.value === 'account_holder_address' || field.value === 'address');
      if (editedStep.question_type === 'yes_no') {
        if (field.isCountry) return true;
        if (field.type === 'number') return true;
        const hasDropdownOptions = getSuggestedValuesForField(editedStep.mapped_field.entity_type, field.value, referencedData);
        if (hasDropdownOptions && hasDropdownOptions.length > 0) return true;
      }
      // enum fields are compatible with string-type questions (single_choice, multiple_choice, text_input)
      if (field.type === 'enum' && questionFieldType === 'string') return true;
      return field.type === questionFieldType;
    });
  }, [editedStep.mapped_field?.entity_type, editedStep.question_type, accountFields, entityFields, controllingPersonFields, beneficiaryFields, referencedData]);

  const handleSave = () => {
    onUpdate(editedStep);
    onClose();
  };

  const renderFieldGroups = (fields) => {
    return Object.entries(fields.reduce((acc, field) => {
      if (!acc[field.group]) acc[field.group] = [];
      acc[field.group].push(field);
      return acc;
    }, {})).map(([group, groupFields]) => (
      <React.Fragment key={group}>
        <div className="px-2 py-1.5 text-xs font-semibold text-slate-500 border-t mt-1 first:border-t-0 first:mt-0">{group}</div>
        {groupFields.map(field => (
          <SelectItem key={`field-${field.value}`} value={field.value}>{field.label} {field.isCountry && '🌍'}</SelectItem>
        ))}
      </React.Fragment>
    ));
  };

  return (
    <div className="space-y-6">
      <div>
        <Label htmlFor="step_title">Step Title *</Label>
        <Input id="step_title" value={editedStep.step_title} onChange={(e) => handleChange("step_title", e.target.value)} className="mt-1.5" />
      </div>
      <div>
        <Label htmlFor="question_text">Question Text</Label>
        <Textarea id="question_text" value={editedStep.question_text} onChange={(e) => handleChange("question_text", e.target.value)} rows={3} className="mt-1.5" />
      </div>
      <div>
        <Label htmlFor="question_type">Question Type</Label>
        <Select value={editedStep.question_type} onValueChange={(value) => handleChange("question_type", value)}>
          <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="yes_no">Yes/No</SelectItem>
            <SelectItem value="single_choice">Single Choice</SelectItem>
            <SelectItem value="multiple_choice">Multiple Choice</SelectItem>
            <SelectItem value="text_input">Text Input</SelectItem>
            <SelectItem value="number_input">Number Input</SelectItem>
            <SelectItem value="date_input">Date Input</SelectItem>
            <SelectItem value="file_upload">File Upload</SelectItem>
            <SelectItem value="multi_field_input">Multi-Field Input</SelectItem>
            <SelectItem value="address_input">Address Input</SelectItem>
            <SelectItem value="beneficiary_input">Beneficiary Input</SelectItem>
            <SelectItem value="controlling_person_input">Controlling Person Input</SelectItem>
            <SelectItem value="info">Info (Display Only)</SelectItem>
            <SelectItem value="result">Result (End Step)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {editedStep.question_type === "result" && (
        <div className="p-4 border-2 border-green-100 rounded-lg bg-green-50/30 space-y-4">
          <div className="flex items-start gap-2 text-xs text-slate-600 bg-white p-3 rounded border border-green-200">
            <Info className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
            <p><strong>Result Step:</strong> This is a final step that shows the classification result.</p>
          </div>
          <div>
            <Label htmlFor="result_status" className="text-sm">Result Status</Label>
            <Select value={editedStep.result_status || ""} onValueChange={(value) => handleChange("result_status", value)}>
              <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select result status..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="reportable">Reportable</SelectItem>
                <SelectItem value="non_reportable">Non-Reportable</SelectItem>
                <SelectItem value="pending_review">Pending Review</SelectItem>
                <SelectItem value="excluded">Excluded</SelectItem>
                <SelectItem value="work_in_progress">Work in progress</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="result_description" className="text-sm">Result Description</Label>
            <Textarea id="result_description" value={editedStep.result_description || ""} onChange={(e) => handleChange("result_description", e.target.value)} rows={2} className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="result_action" className="text-sm">Post-Classification Action (Optional)</Label>
            <Select value={editedStep.result_action || ""} onValueChange={(value) => handleChange("result_action", value)}>
              <SelectTrigger className="mt-1.5"><SelectValue placeholder="No action (just close)" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={null}>No Action</SelectItem>
                <SelectItem value="manage_controlling_persons">Open Controlling Person Manager</SelectItem>
                <SelectItem value="manual_report_total">Manual Report Total</SelectItem>
                <SelectItem value="report_per_beneficiary">Report Per Beneficiary</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {editedStep.question_type === "info" && (
        <div className="p-4 border-2 border-blue-100 rounded-lg bg-blue-50/30 space-y-4">
          <div className="flex items-start gap-2 text-xs text-slate-600 bg-white p-3 rounded border border-blue-200">
            <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <p><strong>Info Step:</strong> Displays information to the user. Optionally set a result status and post-classification action.</p>
          </div>
          <div>
            <Label htmlFor="info_result_status" className="text-sm">Result Status (Optional)</Label>
            <Select value={editedStep.result_status || ""} onValueChange={(value) => handleChange("result_status", value)}>
              <SelectTrigger className="mt-1.5"><SelectValue placeholder="No status change..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value={null}>No Status Change</SelectItem>
                <SelectItem value="reportable">Reportable</SelectItem>
                <SelectItem value="non_reportable">Non-Reportable</SelectItem>
                <SelectItem value="pending_review">Pending Review</SelectItem>
                <SelectItem value="excluded">Excluded</SelectItem>
                <SelectItem value="work_in_progress">Work in Progress</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="info_result_description" className="text-sm">Result Description (Optional)</Label>
            <Textarea id="info_result_description" value={editedStep.result_description || ""} onChange={(e) => handleChange("result_description", e.target.value)} rows={2} className="mt-1.5" placeholder="Describe the outcome shown to the user..." />
          </div>
          <div>
            <Label htmlFor="info_result_action" className="text-sm">Post-Classification Action (Optional)</Label>
            <Select value={editedStep.result_action || ""} onValueChange={(value) => handleChange("result_action", value)}>
              <SelectTrigger className="mt-1.5"><SelectValue placeholder="No action (just continue)" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={null}>No Action</SelectItem>
                <SelectItem value="manage_controlling_persons">Open Controlling Person Manager</SelectItem>
                <SelectItem value="manual_report_total">Manual Report Total</SelectItem>
                <SelectItem value="report_per_beneficiary">Report Per Beneficiary</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {editedStep.question_type === "file_upload" && (
        <div className="p-4 border-2 border-indigo-100 rounded-lg bg-indigo-50/30">
          <div className="flex items-center gap-2 mb-3">
            <Checkbox checked={editedStep.file_upload_config?.require_date_received || false}
              onCheckedChange={(checked) => setEditedStep({ ...editedStep, file_upload_config: { ...editedStep.file_upload_config, require_date_received: checked } })}
              id="require-date-received" />
            <Label htmlFor="require-date-received" className="text-sm cursor-pointer">Require "Date Received" field</Label>
          </div>
        </div>
      )}

      {editedStep.question_type === "address_input" && (
        <div className="p-4 border-2 border-teal-100 rounded-lg bg-teal-50/30 space-y-3">
          <div>
            <Label className="text-sm">Target Address Field</Label>
            <Select value={editedStep.address_config?.target_field || "current_address"} onValueChange={(value) => setEditedStep({ ...editedStep, address_config: { ...editedStep.address_config, target_field: value } })}>
              <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="current_address">Current Address</SelectItem>
                <SelectItem value="account_holder_address">Account Holder Address</SelectItem>
                <SelectItem value="controlling_person_address">Controlling Person Address</SelectItem>
                <SelectItem value="beneficiary_address">Beneficiary Address</SelectItem>
                <SelectItem value="address">Entity Address</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox checked={editedStep.address_config?.track_changes !== false}
              onCheckedChange={(checked) => setEditedStep({ ...editedStep, address_config: { ...editedStep.address_config, track_changes: checked } })}
              id="track-address-changes" />
            <Label htmlFor="track-address-changes" className="text-sm cursor-pointer">Track address changes in audit log</Label>
          </div>
        </div>
      )}

      <div>
        <Label htmlFor="help_text">Help Text</Label>
        <Textarea id="help_text" value={editedStep.help_text} onChange={(e) => handleChange("help_text", e.target.value)} rows={2} placeholder="Additional guidance for users..." className="mt-1.5" />
      </div>

      {(editedStep.question_type === "yes_no" || editedStep.question_type === "single_choice" || editedStep.question_type === "multiple_choice") && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <Label>Answer Options</Label>
            <Button size="sm" onClick={handleAddOption} variant="outline"><Plus className="w-3 h-3 mr-1" />Add Option</Button>
          </div>
          <div className="space-y-3">
            {editedStep.options?.map((option, index) => (
              <div key={index} className="p-3 border rounded-lg space-y-2">
                <div className="flex gap-2">
                  <Input placeholder="Value" value={option.value} onChange={(e) => handleOptionChange(index, "value", e.target.value)} className="flex-1" />
                  <Input placeholder="Label" value={option.label} onChange={(e) => handleOptionChange(index, "label", e.target.value)} className="flex-1" />
                  <Button variant="ghost" size="icon" onClick={() => handleRemoveOption(index)} className="text-red-600"><Trash2 className="w-4 h-4" /></Button>
                </div>
                <div className="flex items-center gap-2">
                  <LinkIcon className="w-4 h-4 text-slate-400" />
                  <Label className="text-xs text-slate-600">Next Step:</Label>
                  <Select value={option.next_step || ""} onValueChange={(value) => handleOptionChange(index, "next_step", value)}>
                    <SelectTrigger className="flex-1"><SelectValue placeholder="Select next step..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={null}>None (End)</SelectItem>
                      {allSteps.filter(s => s.step_id !== editedStep.step_id).map(s => (
                        <SelectItem key={s.step_id} value={s.step_id}>{s.step_title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {editedStep.question_type !== "yes_no" && (
                  <Input
                    value={option.help_text || ""}
                    onChange={(e) => handleOptionChange(index, "help_text", e.target.value)}
                    placeholder="Help Text (optional — shown in Previous Answers instead of Label)"
                    className="text-xs"
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {editedStep.question_type === "multi_field_input" && (
        <div className="border-t pt-4">
          <MultiFieldEditor fields={editedStep.multi_fields || []} onChange={(fields) => setEditedStep({ ...editedStep, multi_fields: fields })} />
        </div>
      )}

      {(editedStep.question_type === "text_input" || editedStep.question_type === "number_input" || editedStep.question_type === "date_input" || editedStep.question_type === "file_upload" || editedStep.question_type === "multi_field_input" || editedStep.question_type === "address_input" || editedStep.question_type === "beneficiary_input" || editedStep.question_type === "controlling_person_input") && (
        <div className="p-4 border rounded-lg bg-slate-50">
          <div className="flex items-center gap-2">
            <LinkIcon className="w-4 h-4 text-slate-400" />
            <Label className="text-sm font-medium text-slate-700">Next Step:</Label>
          </div>
          <Select value={editedStep.default_next_step || ""} onValueChange={(value) => handleChange("default_next_step", value)}>
            <SelectTrigger className="mt-2"><SelectValue placeholder="Select next step..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value={null}>None (End Workflow)</SelectItem>
              {allSteps.filter(s => s.step_id !== editedStep.step_id).map(s => (
                <SelectItem key={s.step_id} value={s.step_id}>{s.step_title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Advanced Conditional Logic */}
      <div className="border-t pt-4">
        <div className="flex items-center justify-between mb-3">
          <Label className="flex items-center gap-2"><Zap className="w-4 h-4 text-purple-600" />Advanced Conditional Logic</Label>
          <Badge variant="outline" className="text-xs">{editedStep.conditional_logic?.conditions?.length || 0} conditions</Badge>
        </div>
        {!showAdvancedLogic ? (
          <Button size="sm" variant="outline" onClick={() => setShowAdvancedLogic(true)} className="w-full">
            <Plus className="w-3 h-3 mr-1" />Enable Advanced Conditional Logic
          </Button>
        ) : (
          <div className="space-y-4 p-4 border-2 border-purple-100 rounded-lg bg-purple-50/30">
            <div className="bg-white p-3 rounded border border-purple-200">
              <Label className="text-xs font-semibold text-purple-700 mb-2 block">Trigger (Optional)</Label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Trigger on Step</Label>
                  <Select value={editedStep.conditional_logic?.trigger_field || ""} onValueChange={(value) => handleConditionalLogicChange("trigger_field", value)}>
                    <SelectTrigger className="h-8 text-xs mt-1"><SelectValue placeholder="Select step..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={null}>None (Always Evaluate)</SelectItem>
                      {allSteps.map(s => <SelectItem key={s.step_id} value={s.step_id}>{s.step_title}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">When Answer Equals</Label>
                  <Input value={editedStep.conditional_logic?.trigger_value || ""} onChange={(e) => handleConditionalLogicChange("trigger_value", e.target.value)} placeholder="e.g., NO, YES" className="h-8 text-xs mt-1" />
                </div>
              </div>
            </div>

            {editedStep.question_type === "multiple_choice" && (
              <div className="bg-white p-3 rounded border border-blue-200">
                <Label className="text-xs font-semibold text-blue-700 mb-2 block">Multiple Choice Branching</Label>
                <Tabs defaultValue="options" className="w-full">
                  <TabsList className="grid w-full grid-cols-3 mb-3">
                    <TabsTrigger value="options" className="text-xs">By Selected Options</TabsTrigger>
                    <TabsTrigger value="count" className="text-xs">By Selection Count</TabsTrigger>
                    <TabsTrigger value="routing-groups" className="text-xs">Routing Groups</TabsTrigger>
                  </TabsList>
                  <TabsContent value="options" className="space-y-3 mt-0">
                    <div className="space-y-2">
                      {editedStep.options?.map((opt, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <Checkbox id={`opt-branch-${idx}`}
                            checked={editedStep.conditional_logic?.option_values?.includes(opt.value) || false}
                            onCheckedChange={(checked) => {
                              const currentValues = editedStep.conditional_logic?.option_values || [];
                              handleConditionalLogicChange("option_values", checked ? [...currentValues, opt.value] : currentValues.filter(v => v !== opt.value));
                            }} />
                          <Label htmlFor={`opt-branch-${idx}`} className="text-xs cursor-pointer">{opt.label} ({opt.value})</Label>
                        </div>
                      ))}
                    </div>
                    {editedStep.conditional_logic?.option_values?.length > 0 && (
                      <div className="grid grid-cols-2 gap-3 pt-3 border-t">
                        <div>
                          <Label className="text-xs text-green-700 font-semibold">If ANY selected → Go to:</Label>
                          <Select value={editedStep.conditional_logic?.option_values_next_step || ""} onValueChange={(value) => handleConditionalLogicChange("option_values_next_step", value)}>
                            <SelectTrigger className="h-8 text-xs mt-1 border-green-300"><SelectValue placeholder="Select step..." /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value={null}>None (End)</SelectItem>
                              {allSteps.filter(s => s.step_id !== editedStep.step_id).map(s => <SelectItem key={s.step_id} value={s.step_id}>{s.step_title}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs text-red-700 font-semibold">Otherwise → Go to:</Label>
                          <Select value={editedStep.conditional_logic?.option_values_else_step || ""} onValueChange={(value) => handleConditionalLogicChange("option_values_else_step", value)}>
                            <SelectTrigger className="h-8 text-xs mt-1 border-red-300"><SelectValue placeholder="Select step..." /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value={null}>None (End)</SelectItem>
                              {allSteps.filter(s => s.step_id !== editedStep.step_id).map(s => <SelectItem key={s.step_id} value={s.step_id}>{s.step_title}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}
                  </TabsContent>
                  <TabsContent value="count" className="mt-0">
                    <SelectionCountBranching conditionalLogic={editedStep.conditional_logic} allSteps={allSteps} currentStepId={editedStep.step_id} optionsCount={editedStep.options?.length || 0} onConditionalLogicChange={handleConditionalLogicChange} />
                  </TabsContent>
                  <TabsContent value="routing-groups" className="mt-0">
                    <MultiChoiceRoutingBuilder routingGroups={editedStep.conditional_logic?.multi_choice_routing_groups || []} defaultStep={editedStep.conditional_logic?.multi_choice_default_step || ""} availableOptions={editedStep.options || []} allSteps={allSteps} currentStepId={editedStep.step_id} availableConditionFields={availableConditionFields} onGroupsChange={(groups) => handleConditionalLogicChange("multi_choice_routing_groups", groups)} onDefaultStepChange={(step) => handleConditionalLogicChange("multi_choice_default_step", step)} />
                  </TabsContent>
                </Tabs>
              </div>
            )}

            <Tabs defaultValue="simple" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-3">
                <TabsTrigger value="simple" className="text-xs">Simple Conditions</TabsTrigger>
                <TabsTrigger value="groups" className="text-xs">Condition Groups</TabsTrigger>
              </TabsList>
              <TabsContent value="simple" className="space-y-4 mt-0">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <Label className="text-sm">Conditions ({editedStep.conditional_logic?.conditions?.length || 0})</Label>
                    <Button size="sm" onClick={handleAddCondition} variant="outline"><Plus className="w-3 h-3 mr-1" />Add Condition</Button>
                  </div>
                  {(!editedStep.conditional_logic?.conditions || editedStep.conditional_logic.conditions.length === 0) ? (
                    <p className="text-xs text-slate-500 italic p-3 bg-white rounded border">No conditions defined.</p>
                  ) : (
                    <div className="space-y-3">
                      {editedStep.conditional_logic.conditions.map((condition, index) => {
                        const selectedField = availableConditionFields.find(f => f.value === condition.field);
                        const isCountryField = selectedField?.isCountry;
                        return (
                          <div key={index} className="p-3 bg-white border-2 border-purple-200 rounded-lg space-y-3">
                            <div className="flex items-center justify-between">
                              <Badge variant="outline" className="bg-purple-100 text-purple-800">Condition {index + 1}</Badge>
                              <Button variant="ghost" size="icon" onClick={() => handleRemoveCondition(index)} className="h-6 w-6 text-red-600"><Trash2 className="w-3 h-3" /></Button>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                              <div>
                                <Label className="text-xs">Step ID / Field</Label>
                                <Select value={condition.field} onValueChange={(value) => handleConditionChange(index, "field", value)}>
                                  <SelectTrigger className="h-8 text-xs mt-1"><SelectValue placeholder="Select field..." /></SelectTrigger>
                                  <SelectContent className="max-h-[300px]">{renderFieldGroups(availableConditionFields)}</SelectContent>
                                </Select>
                              </div>
                              <div>
                                <Label className="text-xs">Operator</Label>
                                <Select value={condition.operator} onValueChange={(value) => handleConditionChange(index, "operator", value)}>
                                  <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="=">Equals (=)</SelectItem>
                                    <SelectItem value="!=">Not Equals (≠)</SelectItem>
                                    <SelectItem value=">">Greater Than</SelectItem>
                                    <SelectItem value="<">Less Than</SelectItem>
                                    <SelectItem value=">=">Greater or Equal</SelectItem>
                                    <SelectItem value="<=">Less or Equal</SelectItem>
                                    <SelectItem value="contains">Contains</SelectItem>
                                    <SelectItem value="in">In</SelectItem>
                                    <SelectItem value="not_in">Not In</SelectItem>
                                    {isCountryField && <>
                                      <SelectItem value="is_crs">Is CRS Country 🌍</SelectItem>
                                      <SelectItem value="is_not_crs">Is Not CRS Country 🌍</SelectItem>
                                    </>}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <Label className="text-xs">Value Type</Label>
                                <Select value={condition.value_type || "static"} onValueChange={(value) => {
                                  const newConditions = [...editedStep.conditional_logic.conditions];
                                  newConditions[index] = { ...newConditions[index], value_type: value, value: "" };
                                  setEditedStep({ ...editedStep, conditional_logic: { ...editedStep.conditional_logic, conditions: newConditions } });
                                }}>
                                  <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="static">Static Value</SelectItem>
                                    <SelectItem value="field_reference">Field Reference</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            <div>
                              <Label className="text-xs">{condition.value_type === 'field_reference' ? 'Reference Field' : 'Value'}</Label>
                              {condition.value_type === 'field_reference' ? (
                                <Select value={condition.value} onValueChange={(value) => handleConditionChange(index, "value", value)}>
                                  <SelectTrigger className="h-8 text-xs mt-1"><SelectValue placeholder="Select field to compare..." /></SelectTrigger>
                                  <SelectContent className="max-h-[300px]">{renderFieldGroups(availableConditionFields)}</SelectContent>
                                </Select>
                              ) : (
                                <Input type={selectedField?.type === 'number' ? 'number' : 'text'} value={condition.value} onChange={(e) => handleConditionChange(index, "value", e.target.value)} placeholder={condition.operator === 'is_crs' || condition.operator === 'is_not_crs' ? 'N/A (CRS lookup)' : 'value'} className="h-8 text-xs mt-1" disabled={condition.operator === 'is_crs' || condition.operator === 'is_not_crs'} />
                              )}
                            </div>
                            {index < editedStep.conditional_logic.conditions.length - 1 && (
                              <div>
                                <Label className="text-xs">Logic Operator</Label>
                                <Select value={condition.logic_operator || "AND"} onValueChange={(value) => handleConditionChange(index, "logic_operator", value)}>
                                  <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="AND">AND</SelectItem>
                                    <SelectItem value="OR">OR</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-green-700 font-semibold">Then (conditions match)</Label>
                    <Select value={editedStep.conditional_logic?.next_step || ""} onValueChange={(value) => handleConditionalLogicChange("next_step", value)}>
                      <SelectTrigger className="h-8 text-xs mt-1 border-green-300"><SelectValue placeholder="Select next step..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={null}>None (End)</SelectItem>
                        {allSteps.filter(s => s.step_id !== editedStep.step_id).map(s => <SelectItem key={s.step_id} value={s.step_id}>{s.step_title}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-red-700 font-semibold">Else (conditions don't match)</Label>
                    <Select value={editedStep.conditional_logic?.else_step || ""} onValueChange={(value) => handleConditionalLogicChange("else_step", value)}>
                      <SelectTrigger className="h-8 text-xs mt-1 border-red-300"><SelectValue placeholder="Select next step..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={null}>None (End)</SelectItem>
                        {allSteps.filter(s => s.step_id !== editedStep.step_id).map(s => <SelectItem key={s.step_id} value={s.step_id}>{s.step_title}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </TabsContent>
              <TabsContent value="groups" className="space-y-4 mt-0">
                <ConditionGroupsBuilder
                  conditionGroups={editedStep.conditional_logic?.condition_groups || []}
                  overallLogicOperator={editedStep.conditional_logic?.overall_logic_operator || "OR"}
                  overallTrueStep={editedStep.conditional_logic?.overall_true_step || ""}
                  overallFalseStep={editedStep.conditional_logic?.overall_false_step || ""}
                  availableConditionFields={availableConditionFields}
                  allSteps={allSteps}
                  currentStepId={editedStep.step_id}
                  onGroupsChange={(groups) => setEditedStep({ ...editedStep, conditional_logic: { ...editedStep.conditional_logic, condition_groups: groups } })}
                  onOverallOperatorChange={(op) => setEditedStep({ ...editedStep, conditional_logic: { ...editedStep.conditional_logic, overall_logic_operator: op } })}
                  onOverallTrueStepChange={(step) => setEditedStep({ ...editedStep, conditional_logic: { ...editedStep.conditional_logic, overall_true_step: step } })}
                  onOverallFalseStepChange={(step) => setEditedStep({ ...editedStep, conditional_logic: { ...editedStep.conditional_logic, overall_false_step: step } })}
                  isLoadingFields={isLoadingFields}
                />
              </TabsContent>
            </Tabs>
            <Button size="sm" variant="ghost" onClick={() => { setShowAdvancedLogic(false); setEditedStep({ ...editedStep, conditional_logic: { conditions: [], condition_groups: [], next_step: "", else_step: "", overall_logic_operator: "OR", overall_true_step: "", overall_false_step: "" } }); }} className="w-full text-xs text-slate-600">
              Disable Advanced Logic
            </Button>
          </div>
        )}
      </div>

      {editedStep.question_type !== "result" && (
        <StepTransitionConfig
          step={editedStep}
          allSteps={allSteps}
          currentWorkflowId={currentWorkflowId}
          onChange={(wt) => setEditedStep(prev => ({ ...prev, workflow_transition: wt }))}
        />
      )}

      {/* Post-Completion Actions */}
      <div className="border-t pt-4">
        <div className="flex items-center justify-between mb-3">
          <Label className="flex items-center gap-2"><Zap className="w-4 h-4 text-amber-600" />Post-Completion Actions</Label>
          <Button size="sm" onClick={handleAddAction} variant="outline"><Plus className="w-3 h-3 mr-1" />Add Action</Button>
        </div>
        {(!editedStep.post_completion_actions || editedStep.post_completion_actions.length === 0) ? (
          <p className="text-xs text-slate-500 italic">No actions configured for this step</p>
        ) : (
          <div className="space-y-3">
            {editedStep.post_completion_actions.map((action, index) => {
              const fieldsSchema = getFieldsForEntity(action.target_entity_type);
              const fieldOptions = Object.entries(fieldsSchema).map(([key, val]) => ({ value: key, label: val.label }));
              const suggestedValues = action.value_source === "static_value" ? getSuggestedValuesForField(action.target_entity_type, action.field_to_update, referencedData) : null;
              return (
                <div key={index} className="p-3 border rounded-lg bg-amber-50 border-amber-200 space-y-2">
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant="outline" className="bg-amber-100 text-amber-800">Action {index + 1}</Badge>
                    <Button variant="ghost" size="icon" onClick={() => handleRemoveAction(index)} className="h-6 w-6 text-red-600"><Trash2 className="w-3 h-3" /></Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Target Entity</Label>
                      <Select value={action.target_entity_type || "Entity"} onValueChange={(value) => handleActionChange(index, "target_entity_type", value, { field_to_update: "", value: "" })}>
                        <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Entity">Entity</SelectItem>
                          <SelectItem value="Account">Account</SelectItem>
                          <SelectItem value="ControllingPerson">Controlling Person</SelectItem>
                          <SelectItem value="Beneficiary">Beneficiary</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Field to Update</Label>
                      <Select value={action.field_to_update || ""} onValueChange={(value) => handleActionChange(index, "field_to_update", value, { value: "" })}>
                        <SelectTrigger className="h-8 text-xs mt-1"><SelectValue placeholder="Select field..." /></SelectTrigger>
                        <SelectContent className="max-h-[300px]">
                          {fieldOptions.map(opt => <SelectItem key={`field-${opt.value}`} value={opt.value}>{opt.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-indigo-700">Execution Timing</Label>
                    <Select value={action.execution_timing || "after_step"} onValueChange={(value) => handleActionChange(index, "execution_timing", value)}>
                      <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="after_step">After This Step</SelectItem>
                        <SelectItem value="after_workflow">After Entire Workflow</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Value Source</Label>
                      <Select value={action.value_source || "from_step_answer"} onValueChange={(value) => handleActionChange(index, "value_source", value, { value: "" })}>
                        <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="from_step_answer">From Step Answer</SelectItem>
                          <SelectItem value="static_value">Static Value</SelectItem>
                          <SelectItem value="from_workflow_outcome">From Workflow Outcome</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">{action.value_source === "from_step_answer" ? "Step ID" : "Value"}</Label>
                      {action.value_source === "from_step_answer" ? (
                        <Select value={action.value || ""} onValueChange={(value) => handleActionChange(index, "value", value)}>
                          <SelectTrigger className="h-8 text-xs mt-1"><SelectValue placeholder="Select step..." /></SelectTrigger>
                          <SelectContent>{allSteps.map(s => <SelectItem key={`step-${s.step_id}`} value={s.step_id}>{s.step_title}</SelectItem>)}</SelectContent>
                        </Select>
                      ) : suggestedValues ? (
                        <Select value={action.value || ""} onValueChange={(value) => handleActionChange(index, "value", value)}>
                          <SelectTrigger className="h-8 text-xs mt-1"><SelectValue placeholder="Select value..." /></SelectTrigger>
                          <SelectContent>{suggestedValues.map(opt => <SelectItem key={`val-${opt.value}`} value={opt.value}>{opt.label}</SelectItem>)}</SelectContent>
                        </Select>
                      ) : (
                        <Input value={action.value || ""} onChange={(e) => handleActionChange(index, "value", e.target.value)} placeholder="Enter value..." className="h-8 text-xs mt-1" />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Mapped Field Configuration */}
      <div className="border-t pt-4">
        <Label className="flex items-center gap-2 mb-2"><LinkIcon className="w-4 h-4 text-emerald-600" />Map to Entity/Account Field (Optional)</Label>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-xs">Target Entity Type</Label>
            <Select value={editedStep.mapped_field?.entity_type || ""} onValueChange={(value) => handleMappedFieldChange("entity_type", value)}>
              <SelectTrigger className="h-8 text-xs mt-1"><SelectValue placeholder="Select entity type..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value={null}>None</SelectItem>
                <SelectItem value="Account">Account</SelectItem>
                <SelectItem value="Entity">Entity</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Target Field</Label>
            <Select value={editedStep.mapped_field?.field_name || ""} onValueChange={(value) => { handleMappedFieldChange("field_name", value); handleMappedFieldChange("prefill_config", null); }} disabled={!editedStep.mapped_field?.entity_type}>
              <SelectTrigger className="h-8 text-xs mt-1"><SelectValue placeholder="Select field..." /></SelectTrigger>
              <SelectContent className="max-h-[200px]">
                {filteredMappedFields.length === 0 ? (
                  <div className="p-2 text-xs text-slate-500 italic">{editedStep.mapped_field?.entity_type ? "No compatible fields" : "Select entity type first"}</div>
                ) : (
                  filteredMappedFields.map(field => <SelectItem key={`mapped-field-${field.value}`} value={field.value}>{field.label}</SelectItem>)
                )}
              </SelectContent>
            </Select>
          </div>
        </div>
        {editedStep.mapped_field?.entity_type && editedStep.mapped_field?.field_name && (
          <p className="text-xs text-emerald-600 mt-2 flex items-center gap-1">
            <LinkIcon className="w-3 h-3" />
            Maps to: {editedStep.mapped_field.entity_type}.{editedStep.mapped_field.field_name}
          </p>
        )}

      </div>

      {/* Smart Pre-fill Rules - available for yes_no and single_choice steps */}
      {(editedStep.question_type === 'yes_no' || editedStep.question_type === 'single_choice') && (
        <div className="border-t pt-4">
          <div className="p-4 bg-emerald-50 border-2 border-emerald-200 rounded-lg space-y-3">
            <Label className="text-xs font-semibold text-emerald-800 flex items-center gap-2"><Sparkles className="w-4 h-4" />Smart Pre-fill Rules</Label>
            {(() => {
              const hasMappedField = !!(editedStep.mapped_field?.entity_type && editedStep.mapped_field?.field_name);
              const selectedMappedField = hasMappedField ? filteredMappedFields.find(f => f.value === editedStep.mapped_field.field_name) : null;
              const isCountryField = selectedMappedField?.isCountry;
              const dropdownOptions = hasMappedField ? getSuggestedValuesForField(editedStep.mapped_field.entity_type, editedStep.mapped_field.field_name, referencedData) : null;
              const prefillType = editedStep.mapped_field?.prefill_config?.prefill_type;
              const readOnly = editedStep.mapped_field?.read_only !== false; // default true

              const numericFields = (() => {
                let schema;
                switch (editedStep.mapped_field?.entity_type) {
                  case "Account": schema = ACCOUNT_FIELDS_SCHEMA; break;
                  case "Entity": schema = ENTITY_FIELDS_SCHEMA; break;
                  default: schema = ACCOUNT_FIELDS_SCHEMA;
                }
                return schema.filter(f => f.type === 'number');
              })();

              // For single_choice: show only the Read Only checkbox (no prefill-type selector)
              if (editedStep.question_type === 'single_choice') {
                return (
                  <div className="space-y-3">
                    <p className="text-xs text-emerald-700">
                      When a Target Field is mapped, the answer will be prefilled from the mapped field value automatically.
                    </p>
                    <div className={`flex items-center gap-2 pt-1 ${!hasMappedField ? 'opacity-50' : ''}`}>
                      <Checkbox
                        id="single-choice-readonly"
                        checked={readOnly}
                        disabled={!hasMappedField}
                        onCheckedChange={(checked) => handleMappedFieldChange("read_only", checked)}
                      />
                      <Label htmlFor="single-choice-readonly" className={`text-xs flex items-center gap-1.5 ${hasMappedField ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
                        <Lock className="w-3.5 h-3.5 text-emerald-700" />
                        Read Only — lock the prefilled answer so the user cannot change it
                      </Label>
                    </div>
                    {!hasMappedField && (
                      <p className="text-xs text-slate-400 italic">Set a Target Field above to enable Read Only.</p>
                    )}
                  </div>
                );
              }

              const handlePrefillTypeChange = (value) => {
                // Preserve existing read_only when changing prefill type
                const existingReadOnly = editedStep.mapped_field?.read_only;
                if (!value) {
                  handleMappedFieldChange("prefill_config", null);
                } else if (value === 'computed_comparison') {
                  handleMappedFieldChange("prefill_config", { prefill_type: 'computed_comparison', field_one: '', computation_operator: 'add', field_two: '', comparison_operator: 'greater_than', threshold_value: 0, prefill_if_true: true });
                } else if (value === 'date_difference') {
                  handleMappedFieldChange("prefill_config", { prefill_type: 'date_difference', source_step_id: '', source_subfield_id: '', anchor_date_type: 'current_date', comparison_operator: 'greater_than', threshold_days: 90, prefill_if_true: true });
                } else {
                  handleMappedFieldChange("prefill_config", { prefill_type: value, match_values: [] });
                }
                // Re-apply read_only after prefill_config change (it lives on mapped_field, not prefill_config)
                if (existingReadOnly !== undefined) {
                  setTimeout(() => handleMappedFieldChange("read_only", existingReadOnly), 0);
                }
              };

              const updateComputedConfig = (key, value) => {
                handleMappedFieldChange("prefill_config", { ...editedStep.mapped_field.prefill_config, [key]: value });
              };

              return (
                <div className="space-y-3">
                  <Select value={prefillType || ""} onValueChange={handlePrefillTypeChange}>
                    <SelectTrigger className="h-8 text-xs mt-1"><SelectValue placeholder="Select pre-fill rule..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={null}>No Pre-fill Rule</SelectItem>
                      {isCountryField && <SelectItem value="country_crs">YES if CRS Country, NO otherwise 🌍</SelectItem>}
                      {dropdownOptions && dropdownOptions.length > 0 && <SelectItem value="enum_match">YES if field value matches specific options</SelectItem>}
                      <SelectItem value="computed_comparison">YES/NO based on computed field comparison ∑</SelectItem>
                      <SelectItem value="date_difference">YES/NO based on days between today and a previous step's date 📅</SelectItem>
                    </SelectContent>
                  </Select>

                  {prefillType === "enum_match" && dropdownOptions && (
                    <div className="space-y-2 max-h-48 overflow-y-auto p-3 bg-white rounded border">
                      {dropdownOptions.map((opt, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <Checkbox id={`prefill-opt-${idx}`} checked={editedStep.mapped_field?.prefill_config?.match_values?.includes(opt.value) || false}
                            onCheckedChange={(checked) => {
                              const currentValues = editedStep.mapped_field?.prefill_config?.match_values || [];
                              handleMappedFieldChange("prefill_config", { ...editedStep.mapped_field.prefill_config, match_values: checked ? [...currentValues, opt.value] : currentValues.filter(v => v !== opt.value) });
                            }} />
                          <Label htmlFor={`prefill-opt-${idx}`} className="text-xs cursor-pointer">{opt.label}</Label>
                        </div>
                      ))}
                    </div>
                  )}

                  {prefillType === "date_difference" && (() => {
                    const currentStepIndex = allSteps.findIndex(s => s.step_id === editedStep.step_id);
                    const dateStepSources = [];
                    allSteps.forEach((s, idx) => {
                      if (idx >= currentStepIndex) return;
                      if (s.question_type === 'date_input') dateStepSources.push({ value: s.step_id, label: `${s.step_title} (date)` });
                      if (s.question_type === 'multi_field_input' && s.multi_fields?.length > 0) {
                        s.multi_fields.filter(mf => mf.field_type === 'date').forEach(mf => {
                          dateStepSources.push({ value: `${s.step_id}||${mf.field_id}`, label: `${s.step_title} → ${mf.display_label}` });
                        });
                      }
                    });
                    const cfg = editedStep.mapped_field?.prefill_config || {};
                    const updateDateDiffConfig = (key, value) => {
                      const current = editedStep.mapped_field?.prefill_config || {};
                      if (key === 'source_step_id') {
                        if (value.includes('||')) {
                          const [stepId, subfieldId] = value.split('||');
                          handleMappedFieldChange("prefill_config", { ...current, source_step_id: stepId, source_subfield_id: subfieldId });
                        } else {
                          handleMappedFieldChange("prefill_config", { ...current, source_step_id: value, source_subfield_id: '' });
                        }
                        return;
                      }
                      handleMappedFieldChange("prefill_config", { ...current, [key]: value });
                    };
                    const sourceValue = cfg.source_subfield_id ? `${cfg.source_step_id}||${cfg.source_subfield_id}` : (cfg.source_step_id || '');
                    return (
                      <div className="space-y-3 p-3 bg-white rounded border border-emerald-300">
                        <p className="text-xs text-slate-600 font-medium">Compare: days between today and a date answered in a previous step</p>
                        <div>
                          <Label className="text-xs">Source Step (date answer)</Label>
                          <Select value={sourceValue} onValueChange={(v) => updateDateDiffConfig('source_step_id', v)}>
                            <SelectTrigger className="h-8 text-xs mt-1"><SelectValue placeholder="Select a previous date step..." /></SelectTrigger>
                            <SelectContent>
                              {dateStepSources.length === 0
                                ? <div className="p-2 text-xs text-slate-400 italic">No prior date steps found</div>
                                : dateStepSources.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-xs">Days Difference Is</Label>
                            <Select value={cfg.comparison_operator || 'greater_than'} onValueChange={(v) => updateDateDiffConfig('comparison_operator', v)}>
                              <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="greater_than">Greater Than (&gt;)</SelectItem>
                                <SelectItem value="less_than">Less Than (&lt;)</SelectItem>
                                <SelectItem value="equals">Equals (=)</SelectItem>
                                <SelectItem value="greater_than_or_equal">Greater or Equal (≥)</SelectItem>
                                <SelectItem value="less_than_or_equal">Less or Equal (≤)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-xs">Threshold Days</Label>
                            <Input type="number" value={cfg.threshold_days ?? 90} onChange={(e) => updateDateDiffConfig('threshold_days', Number(e.target.value))} className="h-8 text-xs mt-1" />
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs">When condition is TRUE, pre-fill answer as:</Label>
                          <Select value={String(cfg.prefill_if_true !== false)} onValueChange={(v) => updateDateDiffConfig('prefill_if_true', v === 'true')}>
                            <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="true">YES (condition true → pre-fill YES)</SelectItem>
                              <SelectItem value="false">NO (condition true → pre-fill NO)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    );
                  })()}

                  {prefillType === "computed_comparison" && (
                    <div className="space-y-3 p-3 bg-white rounded border border-emerald-300">
                      <p className="text-xs text-slate-600 font-medium">Compute: Field 1 [operation] Field 2, then compare result to threshold</p>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <Label className="text-xs">Field 1</Label>
                          <Select value={editedStep.mapped_field?.prefill_config?.field_one || ""} onValueChange={(v) => updateComputedConfig('field_one', v)}>
                            <SelectTrigger className="h-8 text-xs mt-1"><SelectValue placeholder="Select..." /></SelectTrigger>
                            <SelectContent>{numericFields.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs">Operation</Label>
                          <Select value={editedStep.mapped_field?.prefill_config?.computation_operator || "add"} onValueChange={(v) => updateComputedConfig('computation_operator', v)}>
                            <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="add">Add (+)</SelectItem>
                              <SelectItem value="subtract">Subtract (-)</SelectItem>
                              <SelectItem value="multiply">Multiply (×)</SelectItem>
                              <SelectItem value="divide">Divide (÷)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs">Field 2</Label>
                          <Select value={editedStep.mapped_field?.prefill_config?.field_two || ""} onValueChange={(v) => updateComputedConfig('field_two', v)}>
                            <SelectTrigger className="h-8 text-xs mt-1"><SelectValue placeholder="Select..." /></SelectTrigger>
                            <SelectContent>{numericFields.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs">Comparison</Label>
                          <Select value={editedStep.mapped_field?.prefill_config?.comparison_operator || "greater_than"} onValueChange={(v) => updateComputedConfig('comparison_operator', v)}>
                            <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="greater_than">Greater Than (&gt;)</SelectItem>
                              <SelectItem value="less_than">Less Than (&lt;)</SelectItem>
                              <SelectItem value="equals">Equals (=)</SelectItem>
                              <SelectItem value="greater_than_or_equal">Greater or Equal (≥)</SelectItem>
                              <SelectItem value="less_than_or_equal">Less or Equal (≤)</SelectItem>
                              <SelectItem value="not_equals">Not Equals (≠)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs">Threshold Value</Label>
                          <Input type="number" value={editedStep.mapped_field?.prefill_config?.threshold_value ?? 0} onChange={(e) => updateComputedConfig('threshold_value', Number(e.target.value))} className="h-8 text-xs mt-1" />
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs">When condition is TRUE, pre-fill answer as:</Label>
                        <Select value={String(editedStep.mapped_field?.prefill_config?.prefill_if_true !== false)} onValueChange={(v) => updateComputedConfig('prefill_if_true', v === 'true')}>
                          <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="true">YES (condition true → pre-fill YES)</SelectItem>
                            <SelectItem value="false">NO (condition true → pre-fill NO)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}

                  {/* Read Only checkbox — shown for yes_no when a prefill rule is selected */}
                  <div className={`flex items-center gap-2 pt-2 border-t border-emerald-200 ${!prefillType ? 'opacity-50' : ''}`}>
                    <Checkbox
                      id="yes-no-readonly"
                      checked={readOnly}
                      disabled={!prefillType}
                      onCheckedChange={(checked) => handleMappedFieldChange("read_only", checked)}
                    />
                    <Label htmlFor="yes-no-readonly" className={`text-xs flex items-center gap-1.5 ${prefillType ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
                      <Lock className="w-3.5 h-3.5 text-emerald-700" />
                      Read Only — lock the prefilled answer so the user cannot change it
                    </Label>
                  </div>
                  {!prefillType && (
                    <p className="text-xs text-slate-400 italic">Select a Pre-fill Rule above to enable Read Only.</p>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} className="bg-indigo-600 hover:bg-indigo-700 text-white">
          <Save className="w-4 h-4 mr-2" />Save Step
        </Button>
      </div>
    </div>
  );
}