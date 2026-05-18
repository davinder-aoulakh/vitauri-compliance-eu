import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { FileText, Play, Download, Loader2, CheckCircle2, AlertCircle, GitBranch, ChevronRight } from "lucide-react";
import WorkflowAISuggestions from "@/components/workflows/WorkflowAISuggestions";
import WorkflowHealthMap from "@/components/workflows/WorkflowHealthMap";

const STATUS_COLORS = {
  reportable: "bg-red-100 text-red-700 border-red-200",
  non_reportable: "bg-green-100 text-green-700 border-green-200",
  pending_review: "bg-yellow-100 text-yellow-700 border-yellow-200",
  excluded: "bg-gray-100 text-gray-700 border-gray-200",
  terminal: "bg-slate-100 text-slate-700 border-slate-200",
  cycle_detected: "bg-orange-100 text-orange-700 border-orange-200",
  missing_step: "bg-purple-100 text-purple-700 border-purple-200",
  unknown: "bg-slate-100 text-slate-600 border-slate-200",
};

export default function WorkflowTestRunnerPage() {
  const [user, setUser] = useState(null);
  const [tenants, setTenants] = useState([]);
  const [workflows, setWorkflows] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [tenantId, setTenantId] = useState("");
  const [selectedWorkflowId, setSelectedWorkflowId] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingWorkflows, setLoadingWorkflows] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    base44.auth.me().then(u => {
      setUser(u);
      if (u?.tenant_id) setTenantId(u.tenant_id);
    });
    base44.entities.Tenant.list().then(setTenants).catch(() => {});
  }, []);

  useEffect(() => {
    if (!tenantId) return;
    setLoadingWorkflows(true);
    setSelectedWorkflowId("");
    setSelectedAccountId("");
    Promise.all([
      base44.entities.Workflow.filter({ status: "published" }),
      base44.entities.Account.filter({ tenant_id: tenantId }, "-updated_date", 100)
    ]).then(([wfs, accs]) => {
      setWorkflows(wfs);
      setAccounts(accs);
    }).finally(() => setLoadingWorkflows(false));
  }, [tenantId]);

  const handleRun = async () => {
    if (!tenantId || !selectedWorkflowId) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await base44.functions.invoke("workflowTestRunner", {
        tenantId,
        workflowId: selectedWorkflowId,
        accountId: selectedAccountId || null
      });
      setResult(res.data);
    } catch (err) {
      setError(err?.response?.data?.error || err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const selectedWorkflow = workflows.find(w => w.id === selectedWorkflowId);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-indigo-100">
          <GitBranch className="w-6 h-6 text-indigo-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Workflow Test Runner</h1>
          <p className="text-sm text-slate-500">Automatically traverse all workflow paths and generate a PDF test report</p>
        </div>
      </div>

      {/* Configuration Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Test Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>Tenant</Label>
              <Select value={tenantId} onValueChange={setTenantId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select tenant..." />
                </SelectTrigger>
                <SelectContent>
                  {tenants.map(t => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name || t.short_name || t.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Workflow</Label>
              <Select value={selectedWorkflowId} onValueChange={setSelectedWorkflowId} disabled={loadingWorkflows}>
                <SelectTrigger>
                  <SelectValue placeholder={loadingWorkflows ? "Loading..." : "Select workflow..."} />
                </SelectTrigger>
                <SelectContent>
                  {workflows.map(w => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.workflow_name}
                      <span className="ml-2 text-xs text-slate-400">{w.workflow_type}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Account (optional)</Label>
              <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select account (optional)..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No specific account</SelectItem>
                  {accounts.map(a => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.account_number} — {a.account_holder_name || "Unknown"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {selectedWorkflow && (
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200 text-sm">
              <GitBranch className="w-4 h-4 text-slate-500 shrink-0" />
              <span className="text-slate-600">
                <strong>{selectedWorkflow.workflow_name}</strong>
                {" — "}{selectedWorkflow.steps?.length || 0} steps defined
                {" · "}<span className="capitalize">{selectedWorkflow.workflow_type?.replace(/_/g, ' ')}</span>
              </span>
              <Badge variant="outline" className="ml-auto capitalize">{selectedWorkflow.status}</Badge>
            </div>
          )}

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
            <strong>Note:</strong> This runner traverses all possible answer combinations (up to 200 paths). Complex workflows may take 30–60 seconds to process.
          </div>

          <Button
            onClick={handleRun}
            disabled={loading || !tenantId || !selectedWorkflowId}
            className="w-full bg-indigo-600 hover:bg-indigo-700"
          >
            {loading ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Traversing workflow paths...</>
            ) : (
              <><Play className="w-4 h-4 mr-2" /> Run Workflow Test</>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <Alert className="bg-red-50 border-red-200">
          <AlertCircle className="w-4 h-4 text-red-600" />
          <span className="ml-2 text-red-700 text-sm">{error}</span>
        </Alert>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Summary Bar */}
          <Card className="border-green-200 bg-green-50">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                  <div>
                    <p className="font-semibold text-green-900">Test complete: {result.workflow_name}</p>
                    <p className="text-sm text-green-700">{result.total_paths} unique paths discovered</p>
                  </div>
                </div>
                {result.pdf_base64 && (
                  <Button
                    variant="outline"
                    className="border-green-400 text-green-700 hover:bg-green-100"
                    onClick={() => {
                      const byteChars = atob(result.pdf_base64);
                      const byteArray = new Uint8Array(byteChars.length);
                      for (let i = 0; i < byteChars.length; i++) byteArray[i] = byteChars.charCodeAt(i);
                      const blob = new Blob([byteArray], { type: 'application/pdf' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `workflow_test_${result.workflow_name?.replace(/\s+/g, '_')}.pdf`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download PDF Report
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Outcome Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Outcome Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              {(() => {
                const counts = {};
                result.paths_summary.forEach(p => {
                  counts[p.final_status] = (counts[p.final_status] || 0) + 1;
                });
                return (
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(counts).map(([status, count]) => (
                      <span key={status} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border ${STATUS_COLORS[status] || STATUS_COLORS.unknown}`}>
                        {status.replace(/_/g, ' ').toUpperCase()} — {count} path{count > 1 ? 's' : ''}
                      </span>
                    ))}
                  </div>
                );
              })()}
            </CardContent>
          </Card>

          {/* Workflow Health Map */}
          <WorkflowHealthMap
            pathsSummary={result.paths_summary}
            workflowName={result.workflow_name}
            workflowSteps={selectedWorkflow?.steps}
          />

          {/* AI Suggestions */}
          <WorkflowAISuggestions
            pathsSummary={result.paths_summary}
            workflowName={result.workflow_name}
            workflowStepCount={selectedWorkflow?.steps?.length || 0}
            workflow={selectedWorkflow}
          />

          {/* Paths Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="w-4 h-4" />
                All Paths ({result.paths_summary.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-auto max-h-[480px]">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                    <tr>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide w-12">#</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide w-16">Steps</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Step IDs Traversed</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide w-36">Outcome</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.paths_summary.map((path, idx) => (
                      <tr key={idx} className={`border-b border-slate-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                        <td className="px-4 py-2.5 text-slate-500 font-mono text-xs">{path.path_number}</td>
                        <td className="px-4 py-2.5 text-slate-700 font-mono text-xs">{path.steps_count}</td>
                        <td className="px-4 py-2.5">
                          <div className="flex flex-wrap gap-1">
                            {path.step_ids.map((sid, i) => (
                              <React.Fragment key={i}>
                                <span className="font-mono text-xs text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">{sid}</span>
                                {i < path.step_ids.length - 1 && <ChevronRight className="w-3 h-3 text-slate-300 self-center" />}
                              </React.Fragment>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_COLORS[path.final_status] || STATUS_COLORS.unknown}`}>
                            {path.final_status?.replace(/_/g, ' ')}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}