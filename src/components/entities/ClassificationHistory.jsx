import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { History, CheckCircle2, XCircle, AlertTriangle, Clock } from "lucide-react";
import { toDisplayDateTime } from "@/lib/dateUtils";

export default function ClassificationHistory({ history, entity }) {
  // Fetch published entity classification workflows to map answers
  const { data: workflows = [] } = useQuery({
    queryKey: ['entity-workflows-for-history'],
    queryFn: () => base44.entities.Workflow.filter({ 
      workflow_type: 'entity_rfi_classification',
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
            This entity has not been classified yet. Click "Classify Entity" to start the classification workflow.
          </p>
        </CardContent>
      </Card>
    );
  }

  const getStatusBadge = (status) => {
    const config = {
      reporting_fi: { 
        label: "Reporting FI", 
        color: "bg-green-100 text-green-800 border-green-200", 
        icon: CheckCircle2 
      },
      non_reporting_fi: { 
        label: "Non-Reporting FI", 
        color: "bg-slate-100 text-slate-800 border-slate-200", 
        icon: XCircle 
      },
      nfe_active: { 
        label: "Active NFE", 
        color: "bg-blue-100 text-blue-800 border-blue-200", 
        icon: AlertTriangle 
      },
      nfe_passive: { 
        label: "Passive NFE", 
        color: "bg-purple-100 text-purple-800 border-purple-200", 
        icon: AlertTriangle 
      }
    };
    const { label, color, icon: Icon } = config[status] || config.non_reporting_fi;
    return (
      <Badge variant="outline" className={`${color} border`}>
        <Icon className="w-3 h-3 mr-1" />
        {label}
      </Badge>
    );
  };

  const getFITypeBadge = (fiType) => {
    if (!fiType || fiType === "not_applicable") return null;
    
    const labels = {
      custodial_institution: "Custodial Institution",
      depository_institution: "Depository Institution",
      investment_entity: "Investment Entity",
      specified_insurance_company: "Insurance Company"
    };
    
    return (
      <Badge variant="secondary" className="bg-indigo-50 text-indigo-700 border-indigo-200">
        {labels[fiType] || fiType}
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
            {history.length} {history.length === 1 ? 'Event' : 'Events'}
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
                    {getStatusBadge(record.classification_result)}
                  </div>
                </div>

                {/* Classification Details */}
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <span className="text-xs font-medium text-slate-600 w-20 flex-shrink-0">Reason:</span>
                    <p className="text-sm text-slate-800 flex-1">{record.classification_reason}</p>
                  </div>

                  {record.fi_type && record.fi_type !== "not_applicable" && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-slate-600 w-20 flex-shrink-0">FI Type:</span>
                      <div>{getFITypeBadge(record.fi_type)}</div>
                    </div>
                  )}

                  {record.entity_type && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-slate-600 w-20 flex-shrink-0">Entity Type:</span>
                      <Badge variant="outline" className="capitalize text-xs">
                        {record.entity_type.replace(/_/g, " ")}
                      </Badge>
                    </div>
                  )}
                </div>

                {/* Workflow Answers (Collapsible) - User Friendly */}
                {record.workflow_answers && Object.keys(record.workflow_answers).length > 0 && (
                  <details className="mt-3 pt-3 border-t border-slate-200">
                    <summary className="text-xs font-medium text-slate-600 cursor-pointer hover:text-slate-900">
                      View Workflow Answers ({Object.keys(record.workflow_answers).length})
                    </summary>
                    <div className="mt-3 space-y-3">
                      {Object.entries(record.workflow_answers).map(([stepId, answerValue]) => {
                        const { question, answer } = getReadableAnswer(stepId, answerValue);
                        return (
                          <div key={stepId} className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                            <p className="text-xs font-medium text-slate-700 mb-1">
                              {question}
                            </p>
                            <p className="text-sm text-slate-900 font-semibold">
                              {answer}
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