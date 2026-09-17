import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { History, CheckCircle2, XCircle, Clock, Globe } from "lucide-react";
import { toDisplayDateTime } from "@/lib/dateUtils";

export default function BeneficiaryClassificationHistory({ beneficiary }) {
  const { data: history = [] } = useQuery({
    queryKey: ['beneficiary-classification-history', beneficiary?.id],
    queryFn: async () => {
      // Fetch audit logs that contain classification data
      const logs = await base44.entities.AuditLog.filter({ 
        target_entity_type: "Beneficiary",
        target_entity_id: beneficiary?.id,
        action_type: "account_updated"
      });
      
      // Filter for classification events (those with classification_answers in changes)
      return logs.filter(log => 
        log.changes?.classification_answers || 
        log.changes?.reportability_status ||
        log.changes?.is_reportable
      ).map(log => ({
        id: log.id,
        classification_date: log.timestamp,
        reportability_status: log.changes?.reportability_status || 
                              (log.changes?.is_reportable ? 'reportable' : 'non_reportable'),
        classification_reason: log.changes?.reportability_reason || 'Classification completed',
        classification_source: 'workflow',
        workflow_answers: log.changes?.classification_answers || {},
        performed_by: log.actor_email,
        beneficiary_name: log.target_entity_name
      }));
    },
    enabled: !!beneficiary?.id
  });

  // Fetch published beneficiary classification workflows to map answers
  const { data: workflows = [] } = useQuery({
    queryKey: ['beneficiary-workflows-for-history'],
    queryFn: () => base44.entities.Workflow.filter({ 
      workflow_type: 'beneficiary_classification',
      status: 'published'
    })
  });

  // Build a step map from all workflows for lookup
  const stepMap = {};
  workflows.forEach(workflow => {
    workflow.steps?.forEach(step => {
      stepMap[step.step_id] = step;
    });
  });

  const getReadableAnswer = (stepId, answerValue) => {
    const step = stepMap[stepId];
    if (!step) {
      return { question: stepId, answer: answerValue };
    }

    const question = step.step_title || step.question_text || stepId;
    
    let answer = answerValue;
    
    // Handle array answers (multiple choice questions)
    if (Array.isArray(answerValue) && step.options) {
      const selectedLabels = answerValue
        .map(val => {
          const matchingOption = step.options.find(opt => opt.value === val);
          return matchingOption?.label || val;
        })
        .filter(Boolean);
      answer = selectedLabels.length > 0 ? selectedLabels.join(', ') : answerValue.join(', ');
    }
    // Handle object answers (multi-field inputs, address inputs, file uploads)
    else if (typeof answerValue === 'object' && answerValue !== null) {
      // File upload
      if (answerValue.files && Array.isArray(answerValue.files)) {
        answer = answerValue.files.map(f => f.name || 'Uploaded file').join(', ');
      }
      // Address input
      else if (answerValue.street || answerValue.city || answerValue.country) {
        const parts = [
          answerValue.street,
          answerValue.city,
          answerValue.state,
          answerValue.postal_code,
          answerValue.country
        ].filter(Boolean);
        answer = parts.join(', ');
      }
      // Multi-field input
      else if (step.multi_fields && Array.isArray(step.multi_fields)) {
        const fieldParts = step.multi_fields
          .map(field => {
            const value = answerValue[field.field_id];
            if (value === undefined || value === null || value === '') return null;
            return `${field.display_label}: ${value}`;
          })
          .filter(Boolean);
        answer = fieldParts.length > 0 ? fieldParts.join(', ') : JSON.stringify(answerValue);
      }
      else {
        answer = JSON.stringify(answerValue);
      }
    }
    // Handle single choice/yes-no questions
    else if (step.options && Array.isArray(step.options)) {
      const matchingOption = step.options.find(opt => 
        opt.value === answerValue || opt.label === answerValue
      );
      if (matchingOption) {
        answer = matchingOption.label || matchingOption.value;
      }
    }

    return { question, answer };
  };

  if (!history || history.length === 0) {
    return (
      <Card className="border-0 shadow-lg">
        <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-transparent">
          <CardTitle className="flex items-center gap-2 text-lg">
            <History className="w-5 h-5 text-slate-600" />
            Classification History
          </CardTitle>
        </CardHeader>
        <CardContent className="p-12 text-center">
          <History className="w-16 h-16 mx-auto mb-4 text-slate-300" />
          <h3 className="text-lg font-semibold text-slate-900 mb-2">No Classification History</h3>
          <p className="text-slate-600">
            This beneficiary has not been classified yet. Click "Classify" to start the reportability assessment.
          </p>
        </CardContent>
      </Card>
    );
  }

  const getStatusBadge = (status) => {
    if (status === 'reportable' || status === true) {
      return (
        <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-200 border">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Reportable
        </Badge>
      );
    } else if (status === 'non_reportable' || status === false) {
      return (
        <Badge variant="outline" className="bg-slate-100 text-slate-800 border-slate-200 border">
          <XCircle className="w-3 h-3 mr-1" />
          Non-Reportable
        </Badge>
      );
    }
  };

  // Sort by date, most recent first
  const sortedHistory = [...history].sort((a, b) => 
    new Date(b.classification_date) - new Date(a.classification_date)
  );

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-transparent">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <History className="w-5 h-5 text-slate-600" />
            Classification History
          </CardTitle>
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
            {history.length} {history.length === 1 ? 'Assessment' : 'Assessments'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        <div className="space-y-4">
          {sortedHistory.map((record, index) => (
            <div 
              key={record.id} 
              className={`relative border rounded-lg p-4 hover:shadow-md transition-shadow ${
                index === 0 ? 'border-indigo-200 bg-indigo-50/30' : 'border-slate-200 bg-white'
              }`}
            >
              {/* Current/Latest indicator */}
              {index === 0 && (
                <div className="absolute -top-2 left-4">
                  <Badge className="bg-indigo-600 text-white shadow-md">
                    <Clock className="w-3 h-3 mr-1" />
                    Current
                  </Badge>
                </div>
              )}

              <div className="space-y-3">
                {/* Header: Date & Performer */}
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {toDisplayDateTime(record.classification_date)}
                    </p>
                    <p className="text-xs text-slate-500">
                      by {record.performed_by}
                    </p>
                  </div>
                  <div className="text-right">
                    {getStatusBadge(record.reportability_status)}
                  </div>
                </div>

                {/* Classification Details */}
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <span className="text-xs font-medium text-slate-600 w-24 flex-shrink-0">Reason:</span>
                    <p className="text-sm text-slate-800 flex-1">{record.classification_reason}</p>
                  </div>
                </div>

                {/* Workflow Answers (Collapsible) - User Friendly */}
                {record.workflow_answers && Object.keys(record.workflow_answers).filter(k => !k.startsWith('_')).length > 0 && (
                  <details className="mt-3 pt-3 border-t border-slate-200">
                    <summary className="text-xs font-medium text-slate-600 cursor-pointer hover:text-slate-900">
                      View Workflow Answers ({Object.keys(record.workflow_answers).filter(k => !k.startsWith('_')).length})
                    </summary>
                    <div className="mt-3 space-y-3">
                      {Object.entries(record.workflow_answers)
                        .filter(([stepId]) => !stepId.startsWith('_'))
                        .map(([stepId, answerValue]) => {
                        const { question, answer } = getReadableAnswer(stepId, answerValue);
                        return (
                          <div key={stepId} className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                            <p className="text-xs font-medium text-slate-700 mb-1">
                              {question}
                            </p>
                            <p className="text-sm text-slate-900 font-semibold">
                              {String(answer || '—')}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </details>
                )}
              </div>

              {/* Timeline connector (not for last item) */}
              {index < sortedHistory.length - 1 && (
                <div className="absolute left-8 -bottom-4 w-0.5 h-4 bg-slate-200"></div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}