import React from "react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, Upload, Loader2, FileCheck, Calendar } from "lucide-react";
import CountrySelect from "../shared/CountrySelect";
import MultiFieldRenderer from "./MultiFieldRenderer";
import BeneficiaryInputRenderer from "../accounts/BeneficiaryInputRenderer";
import ControllingPersonInputRenderer from "../accounts/ControllingPersonInputRenderer";
import { base44 } from "@/api/base44Client";

export default function QuestionRenderer({
  currentNode,
  selectedValue,
  setSelectedValue,
  dateValue,
  setDateValue,
  multiFieldValues,
  setMultiFieldValues,
  multiFieldErrors,
  setMultiFieldErrors,
  addressValues,
  setAddressValues,
  account,
  latestAccountData,
  answers,
  setAnswers,
  workflow,
  stepMap,
  refetchAccount,
  user,
  dateReceivedValue,
  setDateReceivedValue,
  uploadingFile,
  setUploadingFile,
  dragActive,
  setDragActive,
  setPreviewDocument,
  setShowDocumentPreview
}) {
  if (!currentNode) return null;

  if (currentNode.question_type === "yes_no") {
    const options = currentNode.options || [
      { value: "YES", label: "Yes" },
      { value: "NO", label: "No" }
    ];

    return (
      <div className="space-y-3">
        <RadioGroup value={selectedValue} onValueChange={setSelectedValue}>
          {options.map((option) => (
            <div
              key={option.value}
              className="flex items-center space-x-3 p-4 rounded-lg border-2 border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50 transition-all cursor-pointer"
              onClick={() => setSelectedValue(option.value)}
            >
              <RadioGroupItem value={option.value} id={option.value} />
              <Label htmlFor={option.value} className="flex-1 cursor-pointer font-medium text-slate-900">
                {option.label}
              </Label>
              {option.value === selectedValue && (
                <CheckCircle2 className="w-5 h-5 text-indigo-600" />
              )}
            </div>
          ))}
        </RadioGroup>
      </div>
    );
  }

  if (currentNode.question_type === "single_choice") {
    return (
      <div className="space-y-4">
        <Select value={selectedValue} onValueChange={setSelectedValue}>
          <SelectTrigger className="w-full h-12">
            <SelectValue placeholder="Select an option..." />
          </SelectTrigger>
          <SelectContent>
            {currentNode.options?.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  if (currentNode.question_type === "multiple_choice") {
    const selectedOptions = selectedValue ? selectedValue.split(',').filter(Boolean) : [];

    const handleCheckboxChange = (optionValue, checked) => {
      let newSelected;
      if (checked) {
        newSelected = [...selectedOptions, optionValue];
      } else {
        newSelected = selectedOptions.filter(v => v !== optionValue);
      }
      setSelectedValue(newSelected.join(','));
    };

    return (
      <div className="space-y-3">
        {currentNode.options?.map((option) => (
          <div
            key={option.value}
            className={`flex items-center space-x-3 p-4 rounded-lg border-2 transition-all cursor-pointer ${
              selectedOptions.includes(option.value)
                ? 'border-indigo-400 bg-indigo-50'
                : 'border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50'
            }`}
            onClick={() => handleCheckboxChange(option.value, !selectedOptions.includes(option.value))}
          >
            <Checkbox
              checked={selectedOptions.includes(option.value)}
              onCheckedChange={(checked) => handleCheckboxChange(option.value, checked)}
              id={`option-${option.value}`}
            />
            <Label htmlFor={`option-${option.value}`} className="flex-1 cursor-pointer font-medium text-slate-900">
              {option.label}
            </Label>
            {selectedOptions.includes(option.value) && (
              <CheckCircle2 className="w-5 h-5 text-indigo-600" />
            )}
          </div>
        ))}
        {selectedOptions.length > 0 && (
          <p className="text-sm text-slate-600 mt-2">
            {selectedOptions.length} option(s) selected
          </p>
        )}
      </div>
    );
  }

  if (currentNode.question_type === "text_input") {
    return (
      <Alert className="bg-green-50 border-green-200">
        <CheckCircle2 className="w-4 h-4 text-green-600" />
        <AlertDescription className="text-green-900 font-medium">
          {currentNode.help_text || "Classification complete!"}
        </AlertDescription>
      </Alert>
    );
  }

  if (currentNode.question_type === "date_input") {
    const displayDate = dateValue ? (dateValue.includes('T') ? dateValue.split('T')[0] : dateValue) : '';

    return (
      <div className="space-y-3">
        <Input
          type="date"
          value={displayDate}
          onChange={(e) => {
            setDateValue(e.target.value);
            setSelectedValue(e.target.value);
          }}
          className="w-full h-12"
        />
      </div>
    );
  }

  if (currentNode.question_type === "number_input") {
    return (
      <div className="space-y-3">
        <Input
          type="number"
          value={selectedValue}
          onChange={(e) => setSelectedValue(e.target.value)}
          placeholder="Enter a number..."
          className="w-full h-12"
        />
      </div>
    );
  }

  if (currentNode.question_type === "file_upload") {
    const fileConfig = currentNode.file_upload_config || {};
    const requireDateReceived = fileConfig.require_date_received || false;

    const handleFileUpload = async (file) => {
      if (!file) return;

      setUploadingFile(true);
      try {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });

        const uploadMetadata = {
          file_url,
          file_name: file.name,
          upload_date: new Date().toISOString(),
          uploaded_by: user?.email,
          date_received: dateReceivedValue || ""
        };

        setSelectedValue(uploadMetadata);
      } catch (error) {
        console.error("Error uploading file:", error);
        alert("Failed to upload file. Please try again.");
      } finally {
        setUploadingFile(false);
      }
    };

    const handleDrag = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.type === "dragenter" || e.type === "dragover") {
        setDragActive(true);
      } else if (e.type === "dragleave") {
        setDragActive(false);
      }
    };

    const handleDrop = (e) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);

      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleFileUpload(e.dataTransfer.files[0]);
      }
    };

    const handleDateReceivedChange = (date) => {
      setDateReceivedValue(date);
      if (selectedValue && typeof selectedValue === 'object' && selectedValue.file_url) {
        setSelectedValue({
          ...selectedValue,
          date_received: date
        });
      }
    };

    return (
      <div className="space-y-4">
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-all ${
            dragActive
              ? 'border-indigo-500 bg-indigo-50'
              : 'border-slate-300 hover:border-indigo-400 hover:bg-slate-50'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <input
            type="file"
            onChange={(e) => handleFileUpload(e.target.files?.[0])}
            className="hidden"
            id="file-upload"
            accept=".pdf,.jpg,.jpeg,.png"
            disabled={uploadingFile}
          />

          {uploadingFile ? (
            <div className="space-y-2">
              <Loader2 className="w-12 h-12 mx-auto text-indigo-600 animate-spin" />
              <p className="text-sm font-medium text-slate-700">Uploading...</p>
            </div>
          ) : selectedValue?.file_url ? (
            <div className="space-y-4">
              <CheckCircle2 className="w-12 h-12 mx-auto text-green-600" />
              <p className="text-sm font-medium text-green-900">
                {selectedValue.file_name}
              </p>
              <p className="text-xs text-green-700">Uploaded successfully</p>

              <div className="flex gap-3 justify-center">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setPreviewDocument(selectedValue);
                    setShowDocumentPreview(true);
                  }}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700"
                >
                  <FileCheck className="w-4 h-4 mr-2" />
                  Preview Document
                </Button>
                <label
                  htmlFor="file-upload"
                  className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 cursor-pointer transition-colors"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Different File
                </label>
              </div>
            </div>
          ) : (
            <>
              <Upload className={`w-12 h-12 mx-auto mb-4 ${dragActive ? 'text-indigo-600' : 'text-slate-400'}`} />
              <p className="text-sm font-medium text-slate-700 mb-2">
                {dragActive ? 'Drop file here' : 'Drag and drop file here'}
              </p>
              <p className="text-xs text-slate-500 mb-4">or</p>
              <label
                htmlFor="file-upload"
                className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 cursor-pointer transition-colors"
              >
                <Upload className="w-4 h-4 mr-2" />
                Choose File
              </label>
              <p className="text-xs text-slate-500 mt-3">
                PDF, JPG, or PNG (Max 10MB)
              </p>
            </>
          )}
        </div>

        {requireDateReceived && (
          <div className="mt-4">
            <Label className="text-sm font-medium text-slate-700 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Date Received
              <span className="text-red-600">*</span>
            </Label>
            <Input
              type="date"
              value={dateReceivedValue}
              onChange={(e) => handleDateReceivedChange(e.target.value)}
              className="mt-1.5"
              placeholder="Select date received"
            />
          </div>
        )}
      </div>
    );
  }

  if (currentNode.question_type === "multi_field_input") {
    return (
      <div className="space-y-3">
        <MultiFieldRenderer
          fields={currentNode.multi_fields || []}
          values={multiFieldValues}
          onChange={setMultiFieldValues}
          errors={multiFieldErrors}
        />
      </div>
    );
  }

  if (currentNode.question_type === "address_input") {
    const targetField = currentNode.address_config?.target_field || "current_address";
    const currentAccount = latestAccountData || account;
    const existingAddress = currentAccount[targetField] || {};

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4">
          <div>
            <Label htmlFor="address_street" className="text-sm font-medium text-slate-700">
              Street Address <span className="text-red-600">*</span>
            </Label>
            <Input
              id="address_street"
              value={addressValues.street}
              onChange={(e) => setAddressValues({ ...addressValues, street: e.target.value })}
              placeholder="123 Main Street"
              className="mt-1.5"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="address_city" className="text-sm font-medium text-slate-700">
                City <span className="text-red-600">*</span>
              </Label>
              <Input
                id="address_city"
                value={addressValues.city}
                onChange={(e) => setAddressValues({ ...addressValues, city: e.target.value })}
                placeholder="City"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="address_state" className="text-sm font-medium text-slate-700">
                State/Province <span className="text-red-600">*</span>
              </Label>
              <Input
                id="address_state"
                value={addressValues.state}
                onChange={(e) => setAddressValues({ ...addressValues, state: e.target.value })}
                placeholder="State/Province"
                className="mt-1.5"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="address_postal" className="text-sm font-medium text-slate-700">
                Postal Code <span className="text-red-600">*</span>
              </Label>
              <Input
                id="address_postal"
                value={addressValues.postal_code}
                onChange={(e) => setAddressValues({ ...addressValues, postal_code: e.target.value })}
                placeholder="Postal Code"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="address_country" className="text-sm font-medium text-slate-700">
                Country <span className="text-red-600">*</span>
              </Label>
              <div className="mt-1.5">
                <CountrySelect
                  value={addressValues.country}
                  onValueChange={(value) => setAddressValues({ ...addressValues, country: value })}
                  placeholder="Select country..."
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (currentNode.question_type === "beneficiary_input") {
    const existingAnswer = answers[currentNode.step_id];

    return (
      <BeneficiaryInputRenderer
        account={latestAccountData || account}
        tenant={null}
        initialBeneficiaries={existingAnswer?.draftBeneficiaries}
        savedBeneficiaries={existingAnswer?.savedBeneficiaries}
        onBeneficiariesChange={(beneficiaries) => {
          setAnswers(prev => ({
            ...prev,
            [currentNode.step_id]: {
              ...prev[currentNode.step_id],
              draftBeneficiaries: beneficiaries
            }
          }));
        }}
        onBeneficiariesAdded={async (savedBeneficiaries) => {
          setAnswers(prev => ({
            ...prev,
            [currentNode.step_id]: {
              savedBeneficiaries: savedBeneficiaries,
              draftBeneficiaries: savedBeneficiaries
            }
          }));
          
          if (account?.id) {
            try {
              await base44.entities.Account.update(account.id, {
                beneficiaries_count: savedBeneficiaries.length
              });
              refetchAccount();
            } catch (error) {
              console.error("Error updating beneficiaries count:", error);
            }
          }
        }}
      />
    );
  }

  if (currentNode.question_type === "controlling_person_input") {
    const existingAnswer = answers[currentNode.step_id];

    return (
      <ControllingPersonInputRenderer
        account={latestAccountData || account}
        initialPersons={existingAnswer?.draftPersons}
        savedPersons={existingAnswer?.savedPersons}
        onPersonsChange={(persons) => {
          setAnswers(prev => ({
            ...prev,
            [currentNode.step_id]: {
              ...prev[currentNode.step_id],
              draftPersons: persons
            }
          }));
        }}
        onControllingPersonsAdded={async (savedPersons) => {
          setAnswers(prev => ({
            ...prev,
            [currentNode.step_id]: {
              savedPersons: savedPersons,
              draftPersons: savedPersons
            }
          }));
          
          if (account?.id) {
            try {
              await base44.functions.invoke('syncAccountControllingPersons', { accountId: account.id });
              refetchAccount();
            } catch (error) {
              console.error("Error syncing controlling persons:", error);
            }
          }
        }}
      />
    );
  }

  return null;
}