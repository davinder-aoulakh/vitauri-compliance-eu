import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { History, CheckCircle2, XCircle, Clock, AlertTriangle } from "lucide-react";
import { format } from "date-fns";

export default function AccountClassificationHistory({ history, account }) {
  // Fetch published account classification workflows to map answers
  const { data: workflows = [] } = useQuery({
    queryKey: ['account-workflows-for-history'],
    queryFn: () => base44.entities.Workflow.filter({ 
      workflow_type: 'account_reportability',
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
    
    // Try to find matching option label
    let answer = answerValue;
    if (step.options && Array.isArray(step.options)) {
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
            This account has not been classified yet. Click "Classify Account" to start the reportability assessment.
          </p>
        </CardContent>
      </Card>
    );
  }

  const getStatusBadge = (status) => {
    const config = {
      reportable: { 
        label: "Reportable", 
        color: "bg-green-100 text-green-800 border-green-200", 
        icon: CheckCircle2 
      },
      non_reportable: { 
        label: "Non-Reportable", 
        color: "bg-slate-100 text-slate-800 border-slate-200", 
        icon: XCircle 
      },
      pending_review: { 
        label: "Pending Review", 
        color: "bg-amber-100 text-amber-800 border-amber-200", 
        icon: AlertTriangle 
      },
      excluded: { 
        label: "Excluded", 
        color: "bg-red-100 text-red-800 border-red-200", 
        icon: XCircle 
      }
    };
    const { label, color, icon: Icon } = config[status] || config.pending_review;
    return (
      <Badge variant="outline" className={`${color} border`}>
        <Icon className="w-3 h-3 mr-1" />
        {label}
      </Badge>
    );
  };

  const getSelfCertBadge = (status) => {
    const config = {
      obtained: { label: "Obtained", color: "bg-green-100 text-green-800 border-green-200", icon: CheckCircle2 },
      not_obtained: { label: "Not Obtained", color: "bg-slate-100 text-slate-800 border-slate-200", icon: XCircle },
      not_required: { label: "Not Required", color: "bg-blue-100 text-blue-800 border-blue-200", icon: Clock }
    };
    const { label, color, icon: Icon } = config[status] || config.not_obtained;
    return (
      <Badge variant="outline" className={`${color} border text-xs`}>
        <Icon className="w-3 h-3 mr-1" />
        {label}
      </Badge>
    );
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
                      {format(new Date(record.classification_date), 'MMMM d, yyyy')}
                    </p>
                    <p className="text-xs text-slate-500">
                      at {format(new Date(record.classification_date), 'h:mm a')} by {record.performed_by}
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

                  {record.reportable_jurisdictions && record.reportable_jurisdictions.length > 0 && (
                    <div className="flex items-start gap-2">
                      <span className="text-xs font-medium text-slate-600 w-24 flex-shrink-0">Reportable To:</span>
                      <div className="flex flex-wrap gap-1">
                        {record.reportable_jurisdictions.map((jurisdiction, idx) => (
                          <Badge key={idx} variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">
                            {jurisdiction}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {record.indicia_found && record.indicia_found.length > 0 && (
                    <div className="flex items-start gap-2">
                      <span className="text-xs font-medium text-slate-600 w-24 flex-shrink-0">Indicia Found:</span>
                      <div className="flex flex-wrap gap-1">
                        {record.indicia_found.map((indicia, idx) => (
                          <Badge key={idx} variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs">
                            {indicia.replace(/_/g, ' ')}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-slate-600 w-24 flex-shrink-0">Self-Certification:</span>
                    {getSelfCertBadge(record.self_certification_status)}
                  </div>

                  {record.account_balance !== undefined && record.account_balance !== null && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-slate-600 w-24 flex-shrink-0">Balance:</span>
                      <span className="text-sm font-semibold text-slate-800">
                        ${Number(record.account_balance).toLocaleString()}
                      </span>
                    </div>
                  )}
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
                              {typeof answer === 'object' && answer !== null
                                ? (answer.file_name || JSON.stringify(answer))
                                : (Array.isArray(answer) ? answer.join(', ') : String(answer || ''))}
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