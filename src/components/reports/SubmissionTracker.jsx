import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Send,
  CheckCircle2,
  XCircle,
  Info,
  Save
} from "lucide-react";

export default function SubmissionTracker({ report, onUpdate }) {
  const [formData, setFormData] = useState({
    status: report?.status || 'draft',
    submission_date: report?.submission_date || '',
    submission_reference: report?.submission_reference || '',
    submitted_by: report?.submitted_by || '',
    notes: ''
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const updateData = {
        status: formData.status,
        submission_date: formData.submission_date || null,
        submission_reference: formData.submission_reference || null,
        submitted_by: formData.submitted_by || null
      };

      await base44.entities.CRSReport.update(report.id, updateData);
      onUpdate();
      alert("Submission status updated successfully");
    } catch (error) {
      console.error("Update error:", error);
      alert("Failed to update submission status: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Alert className="bg-blue-50 border-blue-200">
        <Info className="w-4 h-4 text-blue-600" />
        <AlertDescription className="text-sm text-blue-900">
          <strong>Submission Tracking:</strong> Use this form to track the status of your CRS report submission to the tax authority. 
          The actual submission must be done through the tax authority's portal or system.
        </AlertDescription>
      </Alert>

      <Card className="border-0 shadow-lg">
        <CardHeader className="border-b bg-slate-50">
          <CardTitle className="text-lg">Submission Details</CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="status">Submission Status *</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value })}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="validated">Validated</SelectItem>
                  <SelectItem value="submitted">Submitted</SelectItem>
                  <SelectItem value="accepted">Accepted by Authority</SelectItem>
                  <SelectItem value="rejected">Rejected by Authority</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="submission_date">Submission Date</Label>
              <Input
                id="submission_date"
                type="date"
                value={formData.submission_date}
                onChange={(e) => setFormData({ ...formData, submission_date: e.target.value })}
                className="mt-1.5"
              />
            </div>

            <div className="md:col-span-2">
              <Label htmlFor="submission_reference">Submission Reference Number</Label>
              <Input
                id="submission_reference"
                value={formData.submission_reference}
                onChange={(e) => setFormData({ ...formData, submission_reference: e.target.value })}
                placeholder="e.g., REF-2024-12345"
                className="mt-1.5"
              />
              <p className="text-xs text-slate-500 mt-1">
                Reference number provided by the tax authority
              </p>
            </div>

            <div className="md:col-span-2">
              <Label htmlFor="submitted_by">Submitted By</Label>
              <Input
                id="submitted_by"
                value={formData.submitted_by}
                onChange={(e) => setFormData({ ...formData, submitted_by: e.target.value })}
                placeholder="Name or email of person who submitted"
                className="mt-1.5"
              />
            </div>

            <div className="md:col-span-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Any additional notes about the submission..."
                className="mt-1.5 h-24"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Status-specific guidance */}
      {formData.status === 'submitted' && (
        <Alert className="bg-green-50 border-green-200">
          <Send className="w-4 h-4 text-green-600" />
          <AlertDescription className="text-sm text-green-900">
            <strong>Submitted:</strong> The report has been submitted to the tax authority. 
            Make sure to save the submission reference number for your records.
          </AlertDescription>
        </Alert>
      )}

      {formData.status === 'accepted' && (
        <Alert className="bg-green-50 border-green-200">
          <CheckCircle2 className="w-4 h-4 text-green-600" />
          <AlertDescription className="text-sm text-green-900">
            <strong>Accepted:</strong> The tax authority has accepted your CRS report. 
            Keep all documentation for your compliance records.
          </AlertDescription>
        </Alert>
      )}

      {formData.status === 'rejected' && (
        <Alert className="bg-red-50 border-red-200">
          <XCircle className="w-4 h-4 text-red-600" />
          <AlertDescription className="text-sm text-red-900">
            <strong>Rejected:</strong> The tax authority has rejected your submission. 
            Review the validation errors, correct the data, and regenerate the XML file.
          </AlertDescription>
        </Alert>
      )}

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="submit" disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 text-white">
          <Save className="w-4 h-4 mr-2" />
          {saving ? "Saving..." : "Update Submission Status"}
        </Button>
      </div>
    </form>
  );
}