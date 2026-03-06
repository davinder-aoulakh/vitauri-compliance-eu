import React, { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Download,
  Upload,
  Database,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  FileJson,
  Shield,
  Clock,
  Trash2
} from "lucide-react";
import { format } from "date-fns";

const ALL_ENTITIES = [
  'Tenant', 'Entity', 'Account', 'ControllingPerson', 'Beneficiary',
  'CRSReport', 'AuditLog', 'Workflow', 'WorkflowVersion', 'WorkflowAnalytics',
  'WorkflowComponent', 'WorkflowIntegration', 'DashboardConfiguration',
  'DashboardTemplate', 'FormConfiguration', 'ReferencedData', 'CrsCountryInfo',
  'JurisdictionConfig', 'CustomValidationRule', 'AutoClassificationRule',
  'EntityClassificationHistory', 'AccountClassificationHistory',
  'ControllingPersonClassificationHistory', 'RolePermission', 'PlatformSettings'
];

export default function BackupManager() {
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [lastExportMeta, setLastExportMeta] = useState(null);

  const [restoring, setRestoring] = useState(false);
  const [restoreProgress, setRestoreProgress] = useState(0);
  const [restoreReport, setRestoreReport] = useState(null);
  const [backupFileData, setBackupFileData] = useState(null);
  const [backupFileMeta, setBackupFileMeta] = useState(null);
  const [selectedEntities, setSelectedEntities] = useState([...ALL_ENTITIES]);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);

  const [message, setMessage] = useState(null);
  const fileInputRef = useRef(null);

  const handleExport = async () => {
    setExporting(true);
    setExportProgress(10);
    setMessage(null);
    try {
      setExportProgress(40);
      const response = await base44.functions.invoke('exportDatabaseBackup', {});
      setExportProgress(80);

      const backup = response.data;
      const json = JSON.stringify(backup, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const timestamp = format(new Date(), 'yyyy-MM-dd_HH-mm');
      a.href = url;
      a.download = `crs_backup_${timestamp}.json`;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      a.remove();

      setLastExportMeta(backup.metadata);
      setExportProgress(100);
      setMessage({ type: 'success', text: `Backup exported successfully — ${backup.metadata.total_records} records across ${Object.keys(backup.entities).length} entities.` });
    } catch (err) {
      setMessage({ type: 'error', text: 'Export failed: ' + (err.response?.data?.error || err.message) });
    } finally {
      setExporting(false);
      setTimeout(() => setExportProgress(0), 1500);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setMessage(null);
    setRestoreReport(null);
    setBackupFileData(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target.result);
        if (!parsed.entities || !parsed.metadata) {
          setMessage({ type: 'error', text: 'Invalid backup file. Please select a valid CRS backup JSON.' });
          return;
        }
        setBackupFileData(parsed);
        setBackupFileMeta(parsed.metadata);
        // Pre-select only entities present in the file
        setSelectedEntities(ALL_ENTITIES.filter(e => parsed.entities[e]?.length > 0));
      } catch {
        setMessage({ type: 'error', text: 'Failed to parse file. Make sure it is a valid JSON backup.' });
      }
    };
    reader.readAsText(file);
  };

  const handleRestore = async () => {
    setShowRestoreConfirm(false);
    setRestoring(true);
    setRestoreProgress(10);
    setMessage(null);
    setRestoreReport(null);
    try {
      setRestoreProgress(30);
      const response = await base44.functions.invoke('restoreDatabaseBackup', {
        backup: backupFileData,
        entities_to_restore: selectedEntities
      });
      setRestoreProgress(90);
      const { report, summary } = response.data;
      setRestoreReport({ report, summary });
      setRestoreProgress(100);
      setMessage({
        type: summary.failed > 0 ? 'warning' : 'success',
        text: `Restore complete — ${summary.restored} entities restored, ${summary.failed} failed, ${summary.skipped} skipped.`
      });
    } catch (err) {
      setMessage({ type: 'error', text: 'Restore failed: ' + (err.response?.data?.error || err.message) });
    } finally {
      setRestoring(false);
      setTimeout(() => setRestoreProgress(0), 1500);
    }
  };

  const toggleEntity = (entity) => {
    setSelectedEntities(prev =>
      prev.includes(entity) ? prev.filter(e => e !== entity) : [...prev, entity]
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
          <Database className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">Database Backup & Restore</h2>
          <p className="text-sm text-indigo-200">Export all data to JSON or restore from a previous backup</p>
        </div>
      </div>

      {/* Status message */}
      {message && (
        <Alert className={
          message.type === 'success' ? 'bg-green-900/30 border-green-500/40' :
          message.type === 'warning' ? 'bg-amber-900/30 border-amber-500/40' :
          'bg-red-900/30 border-red-500/40'
        }>
          {message.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-green-400" /> :
           <AlertTriangle className="w-4 h-4 text-amber-400" />}
          <AlertDescription className="text-white">{message.text}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* EXPORT */}
        <Card className="border-0 bg-white/10 backdrop-blur-sm border border-white/20 shadow-xl">
          <CardHeader className="border-b border-white/10">
            <CardTitle className="flex items-center gap-2 text-white">
              <Download className="w-5 h-5 text-emerald-400" />
              Export Backup
            </CardTitle>
            <CardDescription className="text-indigo-200">
              Download a complete snapshot of all {ALL_ENTITIES.length} entity tables as a single JSON file.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="bg-white/5 rounded-lg p-4 space-y-2 border border-white/10">
              {ALL_ENTITIES.map(e => (
                <div key={e} className="flex items-center justify-between text-xs">
                  <span className="text-indigo-200">{e}</span>
                  <Badge variant="outline" className="border-white/20 text-indigo-300 text-xs py-0">included</Badge>
                </div>
              ))}
            </div>

            {exportProgress > 0 && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-indigo-200">
                  <span>Exporting...</span><span>{exportProgress}%</span>
                </div>
                <Progress value={exportProgress} className="h-2" />
              </div>
            )}

            {lastExportMeta && (
              <div className="text-xs text-indigo-300 flex items-center gap-2">
                <Clock className="w-3 h-3" />
                Last export: {format(new Date(lastExportMeta.exported_at), "MMM d, yyyy h:mm a")} — {lastExportMeta.total_records} records
              </div>
            )}

            <Button
              onClick={handleExport}
              disabled={exporting}
              className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white gap-2"
            >
              {exporting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {exporting ? 'Exporting...' : 'Download Backup (.json)'}
            </Button>
          </CardContent>
        </Card>

        {/* RESTORE */}
        <Card className="border-0 bg-white/10 backdrop-blur-sm border border-white/20 shadow-xl">
          <CardHeader className="border-b border-white/10">
            <CardTitle className="flex items-center gap-2 text-white">
              <Upload className="w-5 h-5 text-amber-400" />
              Restore from Backup
            </CardTitle>
            <CardDescription className="text-indigo-200">
              Upload a backup JSON file to overwrite current data. This action cannot be undone.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-4">

            {/* File upload area */}
            <div
              className="border-2 border-dashed border-white/20 rounded-lg p-6 text-center cursor-pointer hover:border-white/40 hover:bg-white/5 transition-all"
              onClick={() => fileInputRef.current?.click()}
            >
              <FileJson className="w-8 h-8 mx-auto mb-2 text-indigo-300" />
              {backupFileMeta ? (
                <div className="space-y-1">
                  <p className="text-sm font-medium text-white">Backup loaded</p>
                  <p className="text-xs text-indigo-300">Exported: {format(new Date(backupFileMeta.exported_at), "MMM d, yyyy h:mm a")}</p>
                  <p className="text-xs text-indigo-300">by {backupFileMeta.exported_by} · {backupFileMeta.total_records} records</p>
                </div>
              ) : (
                <div>
                  <p className="text-sm text-indigo-200">Click to select backup file</p>
                  <p className="text-xs text-indigo-400 mt-1">crs_backup_*.json</p>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>

            {/* Entity selection */}
            {backupFileData && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-indigo-200 uppercase tracking-wide">Select entities to restore</p>
                  <div className="flex gap-2">
                    <button className="text-xs text-indigo-300 hover:text-white" onClick={() => setSelectedEntities([...ALL_ENTITIES])}>All</button>
                    <button className="text-xs text-indigo-300 hover:text-white" onClick={() => setSelectedEntities([])}>None</button>
                  </div>
                </div>
                <div className="bg-white/5 rounded-lg p-3 max-h-48 overflow-y-auto space-y-1.5 border border-white/10">
                  {ALL_ENTITIES.map(entity => {
                    const count = backupFileData.entities[entity]?.length || 0;
                    return (
                      <div key={entity} className="flex items-center gap-2">
                        <Checkbox
                          id={entity}
                          checked={selectedEntities.includes(entity)}
                          onCheckedChange={() => toggleEntity(entity)}
                          className="border-white/30"
                          disabled={count === 0}
                        />
                        <label htmlFor={entity} className={`text-xs flex-1 flex justify-between cursor-pointer ${count === 0 ? 'text-white/30' : 'text-indigo-200'}`}>
                          <span>{entity}</span>
                          <span className={count > 0 ? 'text-emerald-400' : 'text-white/30'}>{count} records</span>
                        </label>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {restoreProgress > 0 && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-indigo-200">
                  <span>Restoring...</span><span>{restoreProgress}%</span>
                </div>
                <Progress value={restoreProgress} className="h-2" />
              </div>
            )}

            <Alert className="bg-amber-900/20 border-amber-500/30">
              <Shield className="w-4 h-4 text-amber-400" />
              <AlertDescription className="text-amber-200 text-xs">
                Restore will <strong>delete and replace</strong> all selected entity data with the backup contents. Export a fresh backup first as a precaution.
              </AlertDescription>
            </Alert>

            <Button
              onClick={() => setShowRestoreConfirm(true)}
              disabled={!backupFileData || restoring || selectedEntities.length === 0}
              className="w-full bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white gap-2"
            >
              {restoring ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {restoring ? 'Restoring...' : `Restore ${selectedEntities.length} Entities`}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Restore report */}
      {restoreReport && (
        <Card className="border-0 bg-white/10 backdrop-blur-sm border border-white/20 shadow-xl">
          <CardHeader className="border-b border-white/10 py-3 px-5">
            <CardTitle className="text-white text-base flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              Restore Report
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5">
            <div className="grid grid-cols-3 gap-4 mb-4">
              {[
                { label: 'Restored', value: restoreReport.summary.restored, color: 'text-emerald-400' },
                { label: 'Failed', value: restoreReport.summary.failed, color: 'text-red-400' },
                { label: 'Skipped', value: restoreReport.summary.skipped, color: 'text-amber-400' },
              ].map(s => (
                <div key={s.label} className="bg-white/5 rounded-lg p-3 text-center border border-white/10">
                  <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-indigo-200 mt-1">{s.label}</p>
                </div>
              ))}
            </div>
            {restoreReport.report.failed.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-semibold text-red-300 uppercase mb-1">Failures</p>
                {restoreReport.report.failed.map((f, i) => (
                  <div key={i} className="text-xs text-red-300 bg-red-900/20 rounded px-2 py-1">
                    <strong>{f.entity}:</strong> {f.reason}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Confirm restore dialog */}
      <Dialog open={showRestoreConfirm} onOpenChange={setShowRestoreConfirm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Confirm Database Restore
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 text-sm text-slate-700">
            <p>You are about to restore <strong>{selectedEntities.length} entities</strong> from the backup file:</p>
            <div className="bg-slate-50 rounded p-3 text-xs space-y-1">
              <p><strong>Exported:</strong> {backupFileMeta ? format(new Date(backupFileMeta.exported_at), "MMM d, yyyy h:mm a") : '-'}</p>
              <p><strong>By:</strong> {backupFileMeta?.exported_by}</p>
              <p><strong>Records:</strong> {backupFileMeta?.total_records}</p>
            </div>
            <Alert className="bg-red-50 border-red-200">
              <Trash2 className="w-4 h-4 text-red-600" />
              <AlertDescription className="text-red-800 text-xs">
                All existing data in the selected entities will be <strong>permanently deleted</strong> and replaced with backup data. This cannot be undone.
              </AlertDescription>
            </Alert>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRestoreConfirm(false)}>Cancel</Button>
            <Button onClick={handleRestore} className="bg-red-600 hover:bg-red-700 text-white">
              Yes, Restore Now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}