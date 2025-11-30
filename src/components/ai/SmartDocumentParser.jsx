import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { 
  Upload, 
  Loader2, 
  FileText, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle,
  ArrowRight
} from "lucide-react";

export default function SmartDocumentParser({ 
  onDataExtracted, 
  targetSchema,
  documentType = "self_certification",
  title = "Smart Document Upload"
}) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [extractedData, setExtractedData] = useState(null);
  const [error, setError] = useState(null);
  const [fileUrl, setFileUrl] = useState(null);

  const handleFileSelect = async (e) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setError(null);
    setExtractedData(null);
    setUploading(true);

    try {
      // Upload the file first
      const { file_url } = await base44.integrations.Core.UploadFile({ file: selectedFile });
      setFileUrl(file_url);
      setUploading(false);

      // Now parse the document using AI
      setParsing(true);

      // Define the schema for extraction based on document type
      const extractionSchema = targetSchema || getDefaultSchema(documentType);

      const result = await base44.integrations.Core.ExtractDataFromUploadedFile({
        file_url,
        json_schema: extractionSchema
      });

      if (result.status === "success" && result.output) {
        setExtractedData(result.output);
      } else {
        setError(result.details || "Failed to extract data from document");
      }
    } catch (err) {
      console.error("Error processing document:", err);
      setError("Failed to process document. Please try again.");
    } finally {
      setUploading(false);
      setParsing(false);
    }
  };

  const getDefaultSchema = (type) => {
    if (type === "self_certification") {
      return {
        type: "object",
        properties: {
          full_name: { type: "string", description: "Full legal name of the account holder" },
          date_of_birth: { type: "string", description: "Date of birth in YYYY-MM-DD format" },
          place_of_birth: { type: "string", description: "Country of birth" },
          current_address: {
            type: "object",
            properties: {
              street: { type: "string" },
              city: { type: "string" },
              state: { type: "string" },
              postal_code: { type: "string" },
              country: { type: "string" }
            }
          },
          tax_residencies: {
            type: "array",
            items: {
              type: "object",
              properties: {
                country: { type: "string", description: "Country of tax residence" },
                tin: { type: "string", description: "Tax Identification Number" }
              }
            }
          },
          signature_date: { type: "string", description: "Date when document was signed" }
        }
      };
    }

    if (type === "entity_document") {
      return {
        type: "object",
        properties: {
          entity_name: { type: "string", description: "Legal name of the entity" },
          entity_type: { type: "string", description: "Type of entity (corporation, trust, partnership, etc.)" },
          country_of_incorporation: { type: "string", description: "Country where entity is registered" },
          tax_id: { type: "string", description: "Tax identification number" },
          giin: { type: "string", description: "Global Intermediary Identification Number if applicable" },
          address: {
            type: "object",
            properties: {
              street: { type: "string" },
              city: { type: "string" },
              state: { type: "string" },
              postal_code: { type: "string" },
              country: { type: "string" }
            }
          }
        }
      };
    }

    return {
      type: "object",
      properties: {
        extracted_text: { type: "string" }
      }
    };
  };

  const handleApplyData = () => {
    if (extractedData && onDataExtracted) {
      onDataExtracted({
        data: extractedData,
        fileUrl,
        fileName: file?.name
      });
    }
  };

  const renderExtractedField = (key, value, depth = 0) => {
    if (value === null || value === undefined || value === "") return null;

    if (typeof value === "object" && !Array.isArray(value)) {
      return (
        <div key={key} className="space-y-2">
          <p className="text-sm font-semibold text-slate-700 capitalize">
            {key.replace(/_/g, " ")}
          </p>
          <div className="ml-4 space-y-1">
            {Object.entries(value).map(([k, v]) => renderExtractedField(k, v, depth + 1))}
          </div>
        </div>
      );
    }

    if (Array.isArray(value)) {
      return (
        <div key={key} className="space-y-2">
          <p className="text-sm font-semibold text-slate-700 capitalize">
            {key.replace(/_/g, " ")}
          </p>
          <div className="ml-4 space-y-2">
            {value.map((item, idx) => (
              <div key={idx} className="p-2 bg-slate-50 rounded-lg">
                {typeof item === "object" 
                  ? Object.entries(item).map(([k, v]) => renderExtractedField(k, v, depth + 1))
                  : <span className="text-sm text-slate-700">{item}</span>
                }
              </div>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div key={key} className="flex items-center justify-between py-1">
        <span className="text-sm text-slate-600 capitalize">{key.replace(/_/g, " ")}</span>
        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
          {String(value)}
        </Badge>
      </div>
    );
  };

  return (
    <Card className="border-2 border-indigo-100">
      <CardHeader className="bg-gradient-to-r from-indigo-50 to-purple-50">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Sparkles className="w-5 h-5 text-indigo-600" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6 space-y-4">
        {/* Upload Area */}
        <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:border-indigo-400 hover:bg-indigo-50/30 transition-all">
          <input
            type="file"
            onChange={handleFileSelect}
            className="hidden"
            id="smart-doc-upload"
            accept=".pdf,.jpg,.jpeg,.png"
            disabled={uploading || parsing}
          />
          <label htmlFor="smart-doc-upload" className="cursor-pointer">
            {uploading ? (
              <>
                <Loader2 className="w-12 h-12 mx-auto mb-4 text-indigo-600 animate-spin" />
                <p className="text-sm font-medium text-slate-700">Uploading document...</p>
              </>
            ) : parsing ? (
              <>
                <Sparkles className="w-12 h-12 mx-auto mb-4 text-purple-600 animate-pulse" />
                <p className="text-sm font-medium text-purple-700">AI is extracting data...</p>
                <p className="text-xs text-slate-500 mt-1">This may take a few seconds</p>
              </>
            ) : file ? (
              <>
                <FileText className="w-12 h-12 mx-auto mb-4 text-green-600" />
                <p className="text-sm font-medium text-green-700">{file.name}</p>
                <p className="text-xs text-slate-500 mt-1">Click to upload a different document</p>
              </>
            ) : (
              <>
                <Upload className="w-12 h-12 mx-auto mb-4 text-slate-400" />
                <p className="text-sm font-medium text-slate-700 mb-1">
                  Upload a document for AI extraction
                </p>
                <p className="text-xs text-slate-500">
                  PDF, JPG, or PNG • AI will extract relevant data automatically
                </p>
              </>
            )}
          </label>
        </div>

        {/* Error Display */}
        {error && (
          <Alert className="bg-red-50 border-red-200">
            <AlertCircle className="w-4 h-4 text-red-600" />
            <AlertDescription className="text-red-800">{error}</AlertDescription>
          </Alert>
        )}

        {/* Extracted Data Preview */}
        {extractedData && (
          <div className="space-y-4">
            <Alert className="bg-green-50 border-green-200">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
              <AlertDescription className="text-green-800">
                <strong>Data extracted successfully!</strong> Review the fields below and apply to form.
              </AlertDescription>
            </Alert>

            <div className="p-4 bg-slate-50 rounded-lg space-y-3 max-h-64 overflow-y-auto">
              {Object.entries(extractedData).map(([key, value]) => 
                renderExtractedField(key, value)
              )}
            </div>

            <Button 
              onClick={handleApplyData}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Apply Extracted Data to Form
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}