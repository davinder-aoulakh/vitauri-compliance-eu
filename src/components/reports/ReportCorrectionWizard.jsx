import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, FileEdit, Trash2, Info } from "lucide-react";
import { generateCorrectionIds } from "./idGenerator";

export default function ReportCorrectionWizard({ originalReport, entity, onComplete, onCancel }) {
  const [correctionType, setCorrectionType] = useState("correction");
  const [correctionReason, setCorrectionReason] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!correctionReason.trim()) {
      alert("Please provide a reason for this correction/deletion");
      return;
    }

    setLoading(true);
    try {
      const { correctionMessageRefId, messageTypeIndic } = generateCorrectionIds(
        originalReport, 
        correctionType
      );

      // Extract original MessageRefId (if exists in notification_details or generate from report)
      const originalMessageRefId = originalReport.notification_details?.messageRefId || 
        `${originalReport.reporting_jurisdiction}${originalReport.reporting_year}${originalReport.reporting_jurisdiction}MSG001`;

      const correctionReportData = {
        tenant_id: originalReport.tenant_id,
        entity_id: originalReport.entity_id,
        reporting_year: originalReport.reporting_year,
        reporting_jurisdiction: originalReport.reporting_jurisdiction,
        report_type: originalReport.report_type,
        schema_version: originalReport.schema_version || "v2.0",
        status: "draft",
        message_type_indic: messageTypeIndic,
        correction_message_ref_id: originalMessageRefId,
        correction_doc_ref_id: originalReport.id,
        notification_details: {
          correction_type: correctionType,
          correction_reason: correctionReason,
          original_report_id: originalReport.id,
          created_date: new Date().toISOString()
        }
      };

      const newReport = await base44.entities.CRSReport.create(correctionReportData);
      
      // Create audit log
      await base44.entities.AuditLog.create({
        tenant_id: originalReport.tenant_id,
        action_type: correctionType === 'deletion' ? 'report_deleted' : 'report_generated',
        actor_email: (await base44.auth.me()).email,
        target_entity_type: "CRSReport",
        target_entity_id: newReport.id,
        changes: {
          correction_type: correctionType,
          original_report_id: originalReport.id,
          reason: correctionReason
        },
        timestamp: new Date().toISOString()
      });

      onComplete(newReport);
    } catch (error) {
      console.error("Error creating correction:", error);
      alert("Failed to create correction: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Alert className="bg-amber-50 border-amber-200">
        <AlertTriangle className="w-4 h-4 text-amber-600" />
        <AlertDescription className="text-sm text-amber-900">
          <strong>Important:</strong> Creating a correction or deletion will generate a new report that references 
          the original report. The original report will remain unchanged for audit purposes.
        </AlertDescription>
      </Alert>

      <Card className="border-0 shadow-lg">
        <CardHeader className="border-b bg-slate-50">
          <CardTitle>Original Report Information</CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-slate-600">Reporting Entity</p>
              <p className="text-sm font-semibold text-slate-900">{entity?.entity_name}</p>
            </div>
            <div>
              <p className="text-xs text-slate-600">Reporting Year</p>
              <p className="text-sm font-semibold text-slate-900">{originalReport.reporting_year}</p>
            </div>
            <div>
              <p className="text-xs text-slate-600">Jurisdiction</p>
              <p className="text-sm font-semibold text-slate-900">{originalReport.reporting_jurisdiction}</p>
            </div>
            <div>
              <p className="text-xs text-slate-600">Status</p>
              <Badge>{originalReport.status}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-lg">
        <CardHeader className="border-b bg-slate-50">
          <CardTitle>Correction Type</CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div className="space-y-4">
            <div 
              className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                correctionType === 'correction' 
                  ? 'border-blue-500 bg-blue-50' 
                  : 'border-slate-200 hover:border-slate-300'
              }`}
              onClick={() => setCorrectionType('correction')}
            >
              <div className="flex items-start gap-3">
                <input
                  type="radio"
                  checked={correctionType === 'correction'}
                  onChange={() => setCorrectionType('correction')}
                  className="mt-1"
                />
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <FileEdit className="w-4 h-4 text-blue-600" />
                    <h4 className="font-semibold text-slate-900">Correction (OECD2 / CRS702)</h4>
                  </div>
                  <p className="text-sm text-slate-600">
                    Correct errors or update information in the original report. 
                    The corrected data will replace the original submission.
                  </p>
                </div>
              </div>
            </div>

            <div 
              className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                correctionType === 'deletion' 
                  ? 'border-red-500 bg-red-50' 
                  : 'border-slate-200 hover:border-slate-300'
              }`}
              onClick={() => setCorrectionType('deletion')}
            >
              <div className="flex items-start gap-3">
                <input
                  type="radio"
                  checked={correctionType === 'deletion'}
                  onChange={() => setCorrectionType('deletion')}
                  className="mt-1"
                />
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Trash2 className="w-4 h-4 text-red-600" />
                    <h4 className="font-semibold text-slate-900">Deletion (OECD3 / CRS703)</h4>
                  </div>
                  <p className="text-sm text-slate-600">
                    Remove the original report data from the tax authority's records. 
                    This nullifies the previous submission.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4">
            <Label htmlFor="reason">Reason for {correctionType === 'deletion' ? 'Deletion' : 'Correction'} *</Label>
            <Textarea
              id="reason"
              value={correctionReason}
              onChange={(e) => setCorrectionReason(e.target.value)}
              placeholder={`Explain why this ${correctionType} is needed...`}
              className="mt-1.5 h-24"
            />
            <p className="text-xs text-slate-500 mt-1">
              This reason will be stored in the audit log for compliance tracking
            </p>
          </div>
        </CardContent>
      </Card>

      <Alert className="bg-blue-50 border-blue-200">
        <Info className="w-4 h-4 text-blue-600" />
        <AlertDescription className="text-sm text-blue-900">
          <strong>What happens next:</strong> A new draft report will be created with MessageTypeIndic = {correctionType === 'deletion' ? 'CRS703' : 'CRS702'}.
          You'll need to generate the XML with the correction/deletion markers and submit it to the tax authority.
        </AlertDescription>
      </Alert>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
        <Button 
          onClick={handleCreate}
          disabled={loading || !correctionReason.trim()}
          className={correctionType === 'deletion' ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700"}
        >
          {loading ? "Creating..." : `Create ${correctionType === 'deletion' ? 'Deletion' : 'Correction'} Report`}
        </Button>
      </div>
    </div>
  );
}