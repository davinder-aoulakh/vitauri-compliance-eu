import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Globe, Settings, FileCode, AlertTriangle, CheckCircle2 } from "lucide-react";

// Default jurisdiction configurations
export const JURISDICTION_CONFIGS = {
  "AU": {
    name: "Australia (ATO)",
    schemaVersion: "2.0",
    fileNamingPattern: "CRS_{YEAR}_{TIN}_{TIMESTAMP}.xml",
    docRefIdFormat: "{TIN}.{YEAR}.{DOCTYPE}.{SEQ}",
    requiresEncryption: false,
    requiresGIIN: true,
    tinFormat: "^[0-9]{9}$|^[0-9]{11}$",
    tinFormatDescription: "9 or 11 digits (ABN or TFN)",
    reportingDeadline: "July 31",
    nilReportRequired: true,
    specificRules: [
      "TFN/ABN required for all Australian residents",
      "Account balances must be in AUD",
      "Closed accounts must include closure date"
    ]
  },
  "GB": {
    name: "United Kingdom (HMRC)",
    schemaVersion: "2.0",
    fileNamingPattern: "CRS_{GIIN}_{YEAR}.xml",
    docRefIdFormat: "{GIIN}.{YEAR}.{TYPE}.{SEQ}",
    requiresEncryption: true,
    requiresGIIN: true,
    tinFormat: "^[A-Z]{2}[0-9]{6}[A-Z]?$|^[0-9]{10}$",
    tinFormatDescription: "NINO or UTR format",
    reportingDeadline: "May 31",
    nilReportRequired: true,
    specificRules: [
      "GIIN required for all reporting FIs",
      "Must include HMRC-specific message type indicator",
      "Self-certification forms must be on file"
    ]
  },
  "US": {
    name: "United States (IRS - FATCA)",
    schemaVersion: "2.0",
    fileNamingPattern: "FATCA_{GIIN}_{YEAR}.xml",
    docRefIdFormat: "{GIIN}.{YEAR}.{SEQ}",
    requiresEncryption: true,
    requiresGIIN: true,
    tinFormat: "^[0-9]{9}$",
    tinFormatDescription: "9-digit SSN or EIN",
    reportingDeadline: "March 31",
    nilReportRequired: true,
    specificRules: [
      "FATCA-specific XML schema required",
      "US TINs mandatory for US persons",
      "W-8/W-9 forms must be on file"
    ]
  },
  "CH": {
    name: "Switzerland (FTA)",
    schemaVersion: "2.0",
    fileNamingPattern: "CRS_{UID}_{YEAR}.xml",
    docRefIdFormat: "{UID}.{YEAR}.{TYPE}.{SEQ}",
    requiresEncryption: true,
    requiresGIIN: false,
    tinFormat: "^CHE[0-9]{9}$",
    tinFormatDescription: "UID format (CHE + 9 digits)",
    reportingDeadline: "June 30",
    nilReportRequired: true,
    specificRules: [
      "Swiss UID required for reporting FIs",
      "Dual reporting to multiple partner jurisdictions",
      "Special handling for collective investment schemes"
    ]
  },
  "SG": {
    name: "Singapore (IRAS)",
    schemaVersion: "2.0",
    fileNamingPattern: "CRS_{UEN}_{YEAR}.xml",
    docRefIdFormat: "{UEN}.{YEAR}.{TYPE}.{SEQ}",
    requiresEncryption: false,
    requiresGIIN: false,
    tinFormat: "^[A-Z0-9]{9,10}$",
    tinFormatDescription: "UEN format",
    reportingDeadline: "May 31",
    nilReportRequired: true,
    specificRules: [
      "UEN required for Singapore FIs",
      "Account balances in SGD or original currency",
      "Special rules for joint accounts"
    ]
  },
  "DEFAULT": {
    name: "OECD Standard",
    schemaVersion: "2.0",
    fileNamingPattern: "CRS_{TIN}_{YEAR}_{TIMESTAMP}.xml",
    docRefIdFormat: "{TIN}.{YEAR}.{TYPE}.{SEQ}",
    requiresEncryption: false,
    requiresGIIN: false,
    tinFormat: ".*",
    tinFormatDescription: "Country-specific format",
    reportingDeadline: "Varies by jurisdiction",
    nilReportRequired: false,
    specificRules: [
      "Follow OECD CRS XML Schema v2.0",
      "Include all mandatory elements",
      "Validate against official XSD"
    ]
  }
};

export default function JurisdictionConfig({ 
  jurisdiction,
  config,
  onChange,
  readOnly = false
}) {
  const baseConfig = JURISDICTION_CONFIGS[jurisdiction] || JURISDICTION_CONFIGS["DEFAULT"];
  const currentConfig = { ...baseConfig, ...config };

  const updateConfig = (key, value) => {
    if (readOnly) return;
    onChange({ ...config, [key]: value });
  };

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader className="border-b bg-gradient-to-r from-blue-50 to-transparent">
        <CardTitle className="flex items-center gap-2">
          <Globe className="w-5 h-5 text-blue-600" />
          Jurisdiction Configuration: {currentConfig.name}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6 space-y-6">
        {/* Basic Settings */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-sm font-medium">Schema Version</Label>
            <Select 
              value={currentConfig.schemaVersion}
              onValueChange={(value) => updateConfig('schemaVersion', value)}
              disabled={readOnly}
            >
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1.0">CRS XML v1.0 (Legacy)</SelectItem>
                <SelectItem value="2.0">CRS XML v2.0 (Current)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-sm font-medium">Reporting Deadline</Label>
            <Input 
              value={currentConfig.reportingDeadline}
              onChange={(e) => updateConfig('reportingDeadline', e.target.value)}
              disabled={readOnly}
              className="mt-1.5"
            />
          </div>
        </div>

        {/* File Naming */}
        <div>
          <Label className="text-sm font-medium">File Naming Pattern</Label>
          <Input 
            value={currentConfig.fileNamingPattern}
            onChange={(e) => updateConfig('fileNamingPattern', e.target.value)}
            disabled={readOnly}
            className="mt-1.5 font-mono text-sm"
          />
          <p className="text-xs text-slate-500 mt-1">
            Variables: {"{YEAR}"}, {"{TIN}"}, {"{GIIN}"}, {"{TIMESTAMP}"}, {"{SEQ}"}
          </p>
        </div>

        {/* DocRefId Format */}
        <div>
          <Label className="text-sm font-medium">Document Reference ID Format</Label>
          <Input 
            value={currentConfig.docRefIdFormat}
            onChange={(e) => updateConfig('docRefIdFormat', e.target.value)}
            disabled={readOnly}
            className="mt-1.5 font-mono text-sm"
          />
          <p className="text-xs text-slate-500 mt-1">
            Variables: {"{TIN}"}, {"{GIIN}"}, {"{YEAR}"}, {"{TYPE}"}, {"{SEQ}"}
          </p>
        </div>

        {/* TIN Validation */}
        <div>
          <Label className="text-sm font-medium">TIN Validation Pattern (Regex)</Label>
          <Input 
            value={currentConfig.tinFormat}
            onChange={(e) => updateConfig('tinFormat', e.target.value)}
            disabled={readOnly}
            className="mt-1.5 font-mono text-sm"
          />
          <p className="text-xs text-slate-500 mt-1">
            {currentConfig.tinFormatDescription}
          </p>
        </div>

        {/* Toggle Options */}
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
            <div>
              <p className="text-sm font-medium">Requires GIIN</p>
              <p className="text-xs text-slate-500">Global Intermediary Identification Number required</p>
            </div>
            <Switch 
              checked={currentConfig.requiresGIIN}
              onCheckedChange={(checked) => updateConfig('requiresGIIN', checked)}
              disabled={readOnly}
            />
          </div>

          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
            <div>
              <p className="text-sm font-medium">Requires Encryption</p>
              <p className="text-xs text-slate-500">XML file must be encrypted before submission</p>
            </div>
            <Switch 
              checked={currentConfig.requiresEncryption}
              onCheckedChange={(checked) => updateConfig('requiresEncryption', checked)}
              disabled={readOnly}
            />
          </div>

          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
            <div>
              <p className="text-sm font-medium">NIL Report Required</p>
              <p className="text-xs text-slate-500">Must file even if no reportable accounts</p>
            </div>
            <Switch 
              checked={currentConfig.nilReportRequired}
              onCheckedChange={(checked) => updateConfig('nilReportRequired', checked)}
              disabled={readOnly}
            />
          </div>
        </div>

        {/* Jurisdiction-Specific Rules */}
        <div>
          <Label className="text-sm font-medium mb-2 block">Jurisdiction-Specific Rules</Label>
          <div className="space-y-2">
            {currentConfig.specificRules?.map((rule, idx) => (
              <div key={idx} className="flex items-start gap-2 p-2 bg-amber-50 rounded border border-amber-200">
                <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-amber-800">{rule}</p>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Utility function to generate file name based on pattern
export function generateFileName(pattern, data) {
  let fileName = pattern;
  fileName = fileName.replace('{YEAR}', data.year || '');
  fileName = fileName.replace('{TIN}', data.tin || 'NOTAX');
  fileName = fileName.replace('{GIIN}', data.giin || '');
  fileName = fileName.replace('{UID}', data.uid || data.tin || '');
  fileName = fileName.replace('{UEN}', data.uen || data.tin || '');
  fileName = fileName.replace('{TIMESTAMP}', Date.now());
  fileName = fileName.replace('{SEQ}', data.sequence || '001');
  return fileName;
}

// Utility function to generate DocRefId
export function generateDocRefId(pattern, data) {
  let docRefId = pattern;
  docRefId = docRefId.replace('{TIN}', data.tin || 'NOTAX');
  docRefId = docRefId.replace('{GIIN}', data.giin || '');
  docRefId = docRefId.replace('{UID}', data.uid || data.tin || '');
  docRefId = docRefId.replace('{UEN}', data.uen || data.tin || '');
  docRefId = docRefId.replace('{YEAR}', data.year || '');
  docRefId = docRefId.replace('{TYPE}', data.type || 'ACC');
  docRefId = docRefId.replace('{SEQ}', data.sequence || '001');
  docRefId = docRefId.replace('{DOCTYPE}', data.docType || 'OECD1');
  return docRefId;
}

// Validate TIN against jurisdiction pattern
export function validateTIN(tin, jurisdiction) {
  const config = JURISDICTION_CONFIGS[jurisdiction] || JURISDICTION_CONFIGS["DEFAULT"];
  if (!tin) return { valid: false, message: "TIN is required" };
  
  const regex = new RegExp(config.tinFormat);
  if (!regex.test(tin)) {
    return { 
      valid: false, 
      message: `Invalid TIN format. Expected: ${config.tinFormatDescription}` 
    };
  }
  return { valid: true, message: "Valid" };
}