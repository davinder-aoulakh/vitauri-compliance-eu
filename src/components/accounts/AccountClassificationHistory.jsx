import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { History, CheckCircle2, XCircle, Clock, AlertTriangle, Users } from "lucide-react";
import { toDisplayDateTime } from "@/lib/dateUtils";
import FileUploadAnswerLinks from "@/components/shared/FileUploadAnswerLinks";

export default function AccountClassificationHistory({ history, account }) {
  // Fetch controlling persons for this account
  const { data: controllingPersons = [] } = useQuery({
    queryKey: ['controlling-persons-history', account?.id],
    queryFn: () => base44.entities.ControllingPerson.filter({ account_id: account.id }),
    enabled: !!account?.id
  });

  // Collect all unique workflow IDs referenced by history records
  const referencedWorkflowIds = [...new Set(
    (history || []).map(r => r.workflow_id).filter(Boolean)
  )];

  // Fetch ALL published workflows (any type) so entity/beneficiary/etc. steps resolve too
  const { data: allWorkflows = [] } = useQuery({
    queryKey: ['all-workflows-for-history'],
    queryFn: () => base44.entities.Workflow.filter({ status: 'published' })
  });

  // Also fetch any archived workflows that were specifically referenced
  const { data: archivedWorkflows = [] } = useQuery({
    queryKey: ['archived-workflows-for-history', referencedWorkflowIds.join(',')],
    queryFn: async () => {
      if (!referencedWorkflowIds.length) return [];
      // Fetch each referenced workflow individually (may be archived)
      const results = await Promise.all(
        referencedWorkflowIds.map(id => base44.entities.Workflow.filter({ id }))
      );
      return results.flat();
    },
    enabled: referencedWorkflowIds.length > 0
  });

  // Merge: published + any archived referenced workflows, deduped by id
  const workflows = [...allWorkflows];
  archivedWorkflows.forEach(w => {
    if (!workflows.find(existing => existing.id === w.id)) workflows.push(w);
  });

  // Build a step map from all workflows for lookup
  const stepMap = {};
  workflows.forEach(workflow => {
    workflow.steps?.forEach(step => {
      stepMap[step.step_id] = step;
    });
  });

  const resolveOptionLabel = (step, value) => {
    if (!step?.options) return value;
    const match = step.options.find(opt => opt.value === value || opt.label === value);
    return match ? (match.label || match.value) : value;
  };

  const formatAnswerValue = (step, answerValue) => {
    if (answerValue === null || answerValue === undefined) return '—';

    // Native array (multiple choice answers stored as real arrays)
    if (Array.isArray(answerValue)) {
      const labels = answerValue.map(v => resolveOptionLabel(step, v));
      return labels.join(', ');
    }

    // Native object (multi-field input, address, file upload stored as real objects)
    if (typeof answerValue === 'object') {
      // File upload object: { files: [{ name, url, ... }], date_received }
      if (Array.isArray(answerValue.files)) {
        return (
          <div className="space-y-1">
            <FileUploadAnswerLinks files={answerValue.files} />
            {answerValue.date_received && (
              <p className="text-xs text-slate-500">Received: {answerValue.date_received}</p>
            )}
          </div>
        );
      }
      // Legacy file upload object
      if (answerValue.file_name) {
        return answerValue.file_name + (answerValue.date_received ? ` (received: ${answerValue.date_received})` : '');
      }
      // Controlling persons / beneficiaries input
      if (answerValue.savedPersons || answerValue.draftPersons || answerValue.savedBeneficiaries || answerValue.draftBeneficiaries) {
        const persons = answerValue.savedPersons || answerValue.draftPersons || answerValue.savedBeneficiaries || answerValue.draftBeneficiaries || [];
        if (persons.length === 0) return 'No persons added';
        return persons.map(p => {
          const name = [p.first_name, p.last_name].filter(Boolean).join(' ') || p.full_name || 'Unknown';
          const control = p.control_type ? ` (${p.control_type.replace(/_/g, ' ')})` : '';
          return name + control;
        }).join(', ');
      }
      // Address object
      if (answerValue.street || answerValue.city || answerValue.country) {
        return [answerValue.street, answerValue.city, answerValue.state, answerValue.postal_code, answerValue.country]
          .filter(Boolean).join(', ');
      }
      // Multi-field: map field_ids to display labels
      return Object.entries(answerValue).map(([key, val]) => {
        const fieldDef = step?.multi_fields?.find(f => f.field_id === key);
        const label = fieldDef?.display_label || key;
        const displayVal = typeof val === 'boolean' ? (val ? 'Yes' : 'No') : String(val ?? '');
        return `${label}: ${displayVal}`;
      }).join(' | ');
    }

    // String — try option label lookup (handles YES/NO, FROZEN, etc.)
    return resolveOptionLabel(step, String(answerValue));
  };

  const getReadableAnswer = (stepId, answerValue) => {
    const step = stepMap[stepId];
    if (!step) {
      return { question: stepId, answer: String(answerValue ?? '') };
    }
    const question = step.step_title || step.question_text || stepId;
    const answer = formatAnswerValue(step, answerValue);
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
      },
      work_in_progress: { 
        label: "Work in progress", 
        color: "bg-slate-100 text-blue-800 border-blue-200", 
        icon: XCircle 
      },
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
                              {answer}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </details>
                )}

                {/* Controlling Persons — shown on the most recent record only, fetched live */}
                {index === 0 && controllingPersons.length > 0 && (
                  <details className="mt-3 pt-3 border-t border-slate-200" open>
                    <summary className="text-xs font-medium text-slate-600 cursor-pointer hover:text-slate-900 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5" />
                      Controlling Persons ({controllingPersons.length})
                    </summary>
                    <div className="mt-3 space-y-3">
                      {controllingPersons.map((cp) => {
                        const name = [cp.first_name, cp.last_name].filter(Boolean).join(' ') || cp.full_name || 'Unknown';
                        const address = cp.address
                          ? [cp.address.street, cp.address.city, cp.address.state, cp.address.postal_code, cp.address.country].filter(Boolean).join(', ')
                          : null;
                        const taxResidencies = (cp.tax_residencies || []).filter(r => r.country);
                        return (
                          <div key={cp.id} className="bg-blue-50 border border-blue-100 rounded-lg p-3 space-y-1.5">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <span className="font-semibold text-sm text-slate-900">{name}</span>
                              <div className="flex gap-1.5 flex-wrap">
                                {cp.control_type && (
                                  <Badge variant="outline" className="text-xs bg-white border-blue-200 text-blue-800">
                                    {cp.control_type.replace(/_/g, ' ')}
                                  </Badge>
                                )}
                                {cp.is_reportable === true && (
                                  <Badge variant="outline" className="text-xs bg-green-50 border-green-200 text-green-800">
                                    Reportable
                                  </Badge>
                                )}
                                {cp.is_reportable === false && (
                                  <Badge variant="outline" className="text-xs bg-slate-100 border-slate-200 text-slate-700">
                                    Non-Reportable
                                  </Badge>
                                )}
                              </div>
                            </div>
                            {cp.date_of_birth && (
                              <p className="text-xs text-slate-600">DOB: {cp.date_of_birth}</p>
                            )}
                            {address && (
                              <p className="text-xs text-slate-600">Address: {address}</p>
                            )}
                            {taxResidencies.length > 0 && (
                              <p className="text-xs text-slate-600">
                                Tax Residencies: {taxResidencies.map(r => `${r.country}${r.tin ? ` (TIN: ${r.tin})` : ''}`).join(', ')}
                              </p>
                            )}
                            {cp.ownership_percentage != null && (
                              <p className="text-xs text-slate-600">Ownership: {cp.ownership_percentage}%</p>
                            )}
                            {cp.self_certification_obtained && (
                              <p className="text-xs text-green-700 font-medium">✓ Self-certification obtained</p>
                            )}
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