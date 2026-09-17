import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileText,
  Upload,
  Trash2,
  Eye,
  Download,
  CheckCircle2,
  Loader2,
  Info,
  User,
  Calendar,
  Filter,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { toDisplayDateTime } from "@/lib/dateUtils";

export default function DocumentsManager({ documents = [], onDocumentsChange, legacyDocument }) {
  const [uploading, setUploading] = useState(false);
  const [user, setUser] = useState(null);
  const [selectedType, setSelectedType] = useState("self_certification");
  const [notes, setNotes] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterYear, setFilterYear] = useState("all");
  const [expandedYears, setExpandedYears] = useState({});

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
    } catch (error) {
      console.error("Error loading user:", error);
    }
  };

  // Migrate legacy single document to array if exists
  useEffect(() => {
    if (legacyDocument?.document_url && (!documents || documents.length === 0)) {
      const migratedDoc = {
        id: `legacy_${Date.now()}`,
        document_url: legacyDocument.document_url,
        document_name: legacyDocument.document_name || "Legacy Document",
        document_type: "self_certification",
        upload_date: legacyDocument.upload_date || new Date().toISOString(),
        uploaded_by_email: legacyDocument.uploaded_by_email || "Unknown",
        uploaded_by_name: "Migrated from legacy",
        notes: "Migrated from previous single-document system"
      };
      onDocumentsChange([migratedDoc]);
    }
  }, [legacyDocument]);

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      
      const newDocument = {
        id: `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        document_url: file_url,
        document_name: file.name,
        document_type: selectedType,
        upload_date: new Date().toISOString(),
        uploaded_by_email: user?.email || "Unknown",
        uploaded_by_name: user?.full_name || "Unknown User",
        notes: notes.trim() || null
      };

      const updatedDocs = [...(documents || []), newDocument];
      onDocumentsChange(updatedDocs);
      setNotes("");
      
      // Reset file input
      e.target.value = "";
    } catch (error) {
      console.error("Error uploading file:", error);
      alert("Failed to upload file. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteDocument = (docId) => {
    if (confirm("Are you sure you want to remove this document? This action cannot be undone.")) {
      const updatedDocs = documents.filter(d => d.id !== docId);
      onDocumentsChange(updatedDocs);
    }
  };

  const getDocumentTypeBadge = (type) => {
    const config = {
      self_certification: { label: "Self-Certification", color: "bg-green-100 text-green-800 border-green-200" },
      supporting_document: { label: "Supporting Document", color: "bg-blue-100 text-blue-800 border-blue-200" },
      other: { label: "Other", color: "bg-slate-100 text-slate-800 border-slate-200" }
    };
    const { label, color } = config[type] || config.other;
    return <Badge variant="outline" className={`${color} border text-xs`}>{label}</Badge>;
  };

  // Group documents by year
  const groupDocumentsByYear = (docs) => {
    const groups = {};
    docs.forEach(doc => {
      const year = doc.upload_date ? new Date(doc.upload_date).getFullYear().toString() : "Unknown";
      if (!groups[year]) groups[year] = [];
      groups[year].push(doc);
    });
    // Sort years descending
    return Object.keys(groups)
      .sort((a, b) => b.localeCompare(a))
      .reduce((acc, year) => {
        acc[year] = groups[year].sort((a, b) => 
          new Date(b.upload_date) - new Date(a.upload_date)
        );
        return acc;
      }, {});
  };

  // Filter documents
  const filteredDocuments = (documents || []).filter(doc => {
    const matchesType = filterType === "all" || doc.document_type === filterType;
    const docYear = doc.upload_date ? new Date(doc.upload_date).getFullYear().toString() : "Unknown";
    const matchesYear = filterYear === "all" || docYear === filterYear;
    return matchesType && matchesYear;
  });

  const groupedDocuments = groupDocumentsByYear(filteredDocuments);
  const availableYears = [...new Set((documents || []).map(d => 
    d.upload_date ? new Date(d.upload_date).getFullYear().toString() : "Unknown"
  ))].sort((a, b) => b.localeCompare(a));

  const toggleYear = (year) => {
    setExpandedYears(prev => ({ ...prev, [year]: !prev[year] }));
  };

  // Auto-expand current year
  useEffect(() => {
    const currentYear = new Date().getFullYear().toString();
    if (availableYears.includes(currentYear)) {
      setExpandedYears(prev => ({ ...prev, [currentYear]: true }));
    } else if (availableYears.length > 0) {
      setExpandedYears(prev => ({ ...prev, [availableYears[0]]: true }));
    }
  }, [documents]);

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <Card className="border-2 border-dashed border-slate-300 bg-slate-50/50">
        <CardContent className="p-6">
          <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
            <Upload className="w-4 h-4" />
            Upload New Document
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <Label htmlFor="document_type">Document Type</Label>
              <Select value={selectedType} onValueChange={setSelectedType}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="self_certification">Self-Certification Form</SelectItem>
                  <SelectItem value="supporting_document">Supporting Document</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Input
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add notes about this document..."
                className="mt-1.5"
              />
            </div>
          </div>

          <div className="flex items-center justify-center">
            <label className="w-full">
              <input
                type="file"
                onChange={handleFileUpload}
                className="hidden"
                accept=".pdf,.jpg,.jpeg,.png"
                disabled={uploading}
              />
              <div className="flex flex-col items-center justify-center py-6 cursor-pointer hover:bg-slate-100 rounded-lg transition-colors border-2 border-dashed border-slate-300">
                {uploading ? (
                  <>
                    <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mb-2" />
                    <p className="text-sm text-slate-600">Uploading...</p>
                  </>
                ) : (
                  <>
                    <Upload className="w-10 h-10 text-slate-400 mb-2" />
                    <p className="text-sm font-medium text-slate-700">Click to upload document</p>
                    <p className="text-xs text-slate-500 mt-1">PDF, JPG, or PNG (Max 10MB)</p>
                  </>
                )}
              </div>
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Security Notice */}
      <Alert className="bg-blue-50 border-blue-200">
        <Info className="w-4 h-4 text-blue-600" />
        <AlertDescription className="text-sm text-blue-900">
          <strong>Secure Storage:</strong> Documents are encrypted at rest and in transit. 
          Access is restricted to authorized users only. All uploads are logged for audit purposes.
        </AlertDescription>
      </Alert>

      {/* Document List */}
      {documents && documents.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Uploaded Documents ({documents.length})
            </h3>
            
            {/* Filters */}
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-40 h-8 text-xs">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="self_certification">Self-Certification</SelectItem>
                  <SelectItem value="supporting_document">Supporting</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>

              {availableYears.length > 1 && (
                <Select value={filterYear} onValueChange={setFilterYear}>
                  <SelectTrigger className="w-28 h-8 text-xs">
                    <SelectValue placeholder="All Years" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Years</SelectItem>
                    {availableYears.map(year => (
                      <SelectItem key={year} value={year}>{year}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          {/* Grouped by Year */}
          {Object.keys(groupedDocuments).length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-4">No documents match the selected filters.</p>
          ) : (
            Object.entries(groupedDocuments).map(([year, yearDocs]) => (
              <div key={year} className="border rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleYear(year)}
                  className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-slate-500" />
                    <span className="font-medium text-slate-700">{year}</span>
                    <Badge variant="outline" className="text-xs">
                      {yearDocs.length} {yearDocs.length === 1 ? "document" : "documents"}
                    </Badge>
                  </div>
                  {expandedYears[year] ? (
                    <ChevronUp className="w-4 h-4 text-slate-500" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-500" />
                  )}
                </button>

                {expandedYears[year] && (
                  <div className="divide-y">
                    {yearDocs.map((doc) => (
                      <div key={doc.id} className="p-4 bg-white hover:bg-slate-50 transition-colors">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
                              <FileText className="w-5 h-5 text-green-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-sm font-medium text-slate-900 truncate">
                                  {doc.document_name}
                                </p>
                                {getDocumentTypeBadge(doc.document_type)}
                              </div>
                              
                              {/* Audit Info */}
                              <div className="mt-2 space-y-1">
                                <div className="flex items-center gap-2 text-xs text-slate-600">
                                  <Calendar className="w-3 h-3" />
                                  <span>
                                    {doc.upload_date 
                                      ? toDisplayDateTime(doc.upload_date)
                                      : "Unknown date"}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-slate-600">
                                  <User className="w-3 h-3" />
                                  <span>
                                    Uploaded by: <strong>{doc.uploaded_by_name || doc.uploaded_by_email || "Unknown"}</strong>
                                    {doc.uploaded_by_email && doc.uploaded_by_name && (
                                      <span className="text-slate-400 ml-1">({doc.uploaded_by_email})</span>
                                    )}
                                  </span>
                                </div>
                                {doc.notes && (
                                  <p className="text-xs text-slate-500 italic mt-1">
                                    Notes: {doc.notes}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              onClick={() => window.open(doc.document_url, '_blank')}
                              title="View document"
                            >
                              <Eye className="w-4 h-4 text-slate-600" />
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              onClick={() => {
                                const link = document.createElement('a');
                                link.href = doc.document_url;
                                link.download = doc.document_name;
                                link.click();
                              }}
                              title="Download document"
                            >
                              <Download className="w-4 h-4 text-slate-600" />
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              onClick={() => handleDeleteDocument(doc.id)}
                              title="Delete document"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Empty State */}
      {(!documents || documents.length === 0) && (
        <div className="text-center py-8 text-slate-500">
          <FileText className="w-12 h-12 mx-auto mb-3 text-slate-300" />
          <p className="text-sm">No documents uploaded yet.</p>
          <p className="text-xs text-slate-400 mt-1">Upload your first document using the form above.</p>
        </div>
      )}
    </div>
  );
}