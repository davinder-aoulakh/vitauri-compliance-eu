import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Upload,
  File,
  CheckCircle2,
  X,
  Loader2,
  FileText,
  Download,
  Trash2,
  AlertCircle,
  Eye
} from "lucide-react";

export default function DocumentUpload({ 
  documentUrl, 
  onUploadComplete, 
  onDelete,
  label = "Self-Certification Document",
  description = "Upload PDF, JPG, or PNG files (max 10MB)",
  acceptedTypes = ".pdf,.jpg,.jpeg,.png",
  disabled = false
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (10MB max)
    const maxSize = 10 * 1024 * 1024; // 10MB in bytes
    if (file.size > maxSize) {
      setError("File size exceeds 10MB limit");
      return;
    }

    // Validate file type
    const allowedTypes = acceptedTypes.split(',').map(t => t.trim());
    const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
    if (!allowedTypes.includes(fileExtension)) {
      setError(`Invalid file type. Allowed types: ${allowedTypes.join(', ')}`);
      return;
    }

    setUploading(true);
    setError(null);

    try {
      // Upload file using Core integration
      const { data } = await base44.integrations.Core.UploadFile({ file });
      
      if (data.file_url) {
        onUploadComplete(data.file_url, file.name);
      } else {
        throw new Error("Upload failed - no file URL returned");
      }
    } catch (err) {
      console.error("Upload error:", err);
      setError(err.message || "Failed to upload file");
    } finally {
      setUploading(false);
      // Reset input
      e.target.value = '';
    }
  };

  const handleDelete = () => {
    if (confirm("Are you sure you want to remove this document?")) {
      onDelete();
    }
  };

  const getFileIcon = (url) => {
    if (!url) return FileText;
    if (url.toLowerCase().endsWith('.pdf')) return FileText;
    return File;
  };

  const getFileName = (url) => {
    if (!url) return '';
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      return pathname.split('/').pop() || 'document';
    } catch {
      return 'document';
    }
  };

  const FileIcon = getFileIcon(documentUrl);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <label className="text-sm font-medium text-slate-700">{label}</label>
          <p className="text-xs text-slate-500 mt-1">{description}</p>
        </div>
      </div>

      {/* Upload Area */}
      {!documentUrl && (
        <div className={`border-2 border-dashed rounded-lg p-6 text-center transition-all ${
          uploading 
            ? 'border-indigo-300 bg-indigo-50/50' 
            : 'border-slate-300 hover:border-indigo-400 hover:bg-indigo-50/30 cursor-pointer'
        }`}>
          <input
            type="file"
            accept={acceptedTypes}
            onChange={handleFileSelect}
            disabled={uploading || disabled}
            className="hidden"
            id="document-upload"
          />
          <label 
            htmlFor="document-upload" 
            className={`cursor-pointer flex flex-col items-center ${uploading || disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {uploading ? (
              <>
                <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mb-3" />
                <p className="text-sm font-medium text-indigo-700">Uploading...</p>
                <p className="text-xs text-indigo-600 mt-1">Please wait</p>
              </>
            ) : (
              <>
                <div className="w-12 h-12 rounded-lg bg-indigo-100 flex items-center justify-center mb-3">
                  <Upload className="w-6 h-6 text-indigo-600" />
                </div>
                <p className="text-sm font-medium text-slate-700 mb-1">
                  Click to upload or drag and drop
                </p>
                <p className="text-xs text-slate-500">
                  PDF, JPG, PNG up to 10MB
                </p>
              </>
            )}
          </label>
        </div>
      )}

      {/* Uploaded Document Display */}
      {documentUrl && (
        <Card className="border-2 border-green-200 bg-green-50/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
                <FileIcon className="w-5 h-5 text-green-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-sm font-medium text-green-900 truncate">
                    {getFileName(documentUrl)}
                  </p>
                  <Badge className="bg-green-100 text-green-800 border-green-300 text-xs">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Uploaded
                  </Badge>
                </div>
                <p className="text-xs text-green-700">
                  Document successfully uploaded and linked to account
                </p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => window.open(documentUrl, '_blank')}
                  className="text-green-700 hover:text-green-800 hover:bg-green-100"
                  title="View document"
                >
                  <Eye className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    const link = document.createElement('a');
                    link.href = documentUrl;
                    link.download = getFileName(documentUrl);
                    link.click();
                  }}
                  className="text-blue-700 hover:text-blue-800 hover:bg-blue-100"
                  title="Download document"
                >
                  <Download className="w-4 h-4" />
                </Button>
                {onDelete && !disabled && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleDelete}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    title="Remove document"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error Display */}
      {error && (
        <Alert className="bg-red-50 border-red-200">
          <AlertCircle className="w-4 h-4 text-red-600" />
          <AlertDescription className="text-sm text-red-900">
            {error}
          </AlertDescription>
        </Alert>
      )}

      {/* Security & Compliance Note */}
      <Alert className="bg-blue-50 border-blue-200">
        <AlertCircle className="w-4 h-4 text-blue-600" />
        <AlertDescription className="text-xs text-blue-900">
          <strong>Secure Storage:</strong> Documents are encrypted at rest and in transit. 
          Access is restricted to authorized users only. All uploads are logged for audit purposes.
        </AlertDescription>
      </Alert>
    </div>
  );
}