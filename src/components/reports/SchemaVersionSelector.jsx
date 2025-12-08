import React from "react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info } from "lucide-react";

/**
 * Determines the appropriate schema version based on jurisdiction config and reporting year
 */
export function getRecommendedSchemaVersion(jurisdictionConfig, reportingYear) {
  if (!jurisdictionConfig) {
    return "v2.0"; // Default fallback
  }

  // Check year-specific mappings
  if (jurisdictionConfig.schema_version_by_year && jurisdictionConfig.schema_version_by_year[reportingYear]) {
    return jurisdictionConfig.schema_version_by_year[reportingYear];
  }

  // Use default for jurisdiction
  return jurisdictionConfig.default_schema_version || "v2.0";
}

/**
 * Schema Version Selector Component
 */
export default function SchemaVersionSelector({ 
  value, 
  onChange, 
  jurisdictionConfig, 
  reportingYear,
  disabled 
}) {
  const supportedVersions = jurisdictionConfig?.supported_schema_versions || ["v1.0", "v2.0", "v2.1"];
  const recommendedVersion = getRecommendedSchemaVersion(jurisdictionConfig, reportingYear);
  
  const schemaDescriptions = {
    "v1.0": "Legacy version - use only if required by jurisdiction",
    "v2.0": "Current OECD standard - widely supported",
    "v2.1": "Latest OECD standard - enhanced data elements",
    "FATCA-spec": "FATCA-specific schema for US reporting"
  };

  return (
    <div>
      <Label htmlFor="schema_version">CRS XML Schema Version</Label>
      <Select
        value={value}
        onValueChange={onChange}
        disabled={disabled}
      >
        <SelectTrigger className="mt-1.5">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {supportedVersions.map((version) => (
            <SelectItem key={version} value={version}>
              {version}
              {version === recommendedVersion && " (Recommended)"}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      
      {value && schemaDescriptions[value] && (
        <p className="text-xs text-slate-500 mt-1">
          {schemaDescriptions[value]}
        </p>
      )}

      {value && value !== recommendedVersion && (
        <Alert className="mt-2 bg-amber-50 border-amber-200">
          <Info className="w-4 h-4 text-amber-600" />
          <AlertDescription className="text-xs text-amber-900">
            The recommended version for {jurisdictionConfig?.jurisdiction_name || 'this jurisdiction'} 
            in {reportingYear} is <strong>{recommendedVersion}</strong>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}