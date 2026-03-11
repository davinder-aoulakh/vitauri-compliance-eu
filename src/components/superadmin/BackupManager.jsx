import React, { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
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
  Trash2,
  CalendarClock,
  Table2,
  PlayCircle,
  History,
  Eye,
  ChevronDown,
  ChevronUp,
  Lock,
  LockOpen
} from "lucide-react";
import { format } from "date-fns";
import BackupHistoryPanel from "./BackupHistoryPanel";
import { encryptBackup, decryptBackup, isEncryptedBackup } from "./backupCrypto";

const ALL_ENTITIES = [
  'Tenant', 'Entity', 'Account', 'ControllingPerson', 'Beneficiary',
  'CRSReport', 'AuditLog', 'Workflow', 'WorkflowVersion', 'WorkflowAnalytics',
  'WorkflowComponent', 'WorkflowIntegration', 'DashboardConfiguration',
  'DashboardTemplate', 'FormConfiguration', 'ReferencedData', 'CrsCountryInfo',
  'JurisdictionConfig', 'CustomValidationRule', 'AutoClassificationRule',
  'EntityClassificationHistory', 'AccountClassificationHistory',
  'ControllingPersonClassificationHistory', 'RolePermission', 'PlatformSettings'
];

// ─── DB ENV SELECTOR ──────────────────────────────────────────────────────────
function DbEnvSelector({ value, onChange }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-indigo-300 font-semibold uppercase tracking-wide">Database:</span>
      <div className="flex rounded-lg overflow-hidden border border-white/20">
        {[
          { label: '🟢 Production', val: 'prod' },
          { label: '🧪 Test', val: 'dev' },
        ].map(({ label, val }) => (
          <button
            key={val}
            onClick={() => onChange(val)}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${
              value === val
                ? val === 'prod'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-amber-500 text-white'
                : 'bg-white/5 text-indigo-300 hover:bg-white/10'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {value === 'dev' && (
        <span className="text-xs text-amber-300 bg-amber-500/20 border border-amber-500/30 px-2 py-0.5 rounded">
          Test DB
        </span>
      )}
    </div>
  );
}

function PasswordField({ value, onChange, label = "Encrypt with password (optional)" }) {
  const [show, setShow] = useState(false);
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-indigo-200 uppercase tracking-wide flex items-center gap-1.5">
        <Lock className="w-3 h-3" /> {label}
      </label>
      <div className="relative">
        <Input
          type={show ? "text" : "password"}
          placeholder="Leave blank to skip encryption"
          value={value}
          onChange={e => onChange(e.target.value)}
          className="bg-white/5 border-white/20 text-white placeholder:text-indigo-400 pr-16 text-sm"
        />
        <button
          type="button"
          onClick={() => setShow(s => !s)}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-indigo-400 hover:text-white transition-colors text-xs px-1"
        >
          {show ? "Hide" : "Show"}
        </button>
      </div>
      {value && (
        <p className="text-xs text-amber-300 flex items-center gap-1">
          <Lock className="w-3 h-3" /> File will be AES-256 encrypted — keep this password safe.
        </p>
      )}
    </div>
  );
}

function StatusMessage({ message }) {
  if (!message) return null;
  const cls = message.type === 'success' ? 'bg-green-900/30 border-green-500/40' :
              message.type === 'warning' ? 'bg-amber-900/30 border-amber-500/40' :
              'bg-red-900/30 border-red-500/40';
  return (
    <Alert className={cls}>
      {message.type === 'success'
        ? <CheckCircle2 className="w-4 h-4 text-green-400" />
        : <AlertTriangle className="w-4 h-4 text-amber-400" />}
      <AlertDescription className="text-white">{message.text}</AlertDescription>
    </Alert>
  );
}

// ─── FULL DATABASE EXPORT ─────────────────────────────────────────────────────
function FullExportPanel() {
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [lastMeta, setLastMeta] = useState(null);
  const [message, setMessage] = useState(null);
  const [dbEnv, setDbEnv] = useState('prod');
  const [password, setPassword] = useState('');

  const handleExport = async () => {
    setExporting(true);
    setProgress(20);
    setMessage(null);
    try {
      setProgress(50);
      const response = await base44.functions.invoke('exportDatabaseBackup', { mode: 'full', data_env: dbEnv });
      setProgress(70);
      const backup = response.data;
      let fileContent = JSON.stringify(backup, null, 2);
      let fileName = `crs_full_backup_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.json`;
      if (password) {
        fileContent = await encryptBackup(fileContent, password);
        fileName = fileName.replace('.json', '.enc.json');
      }
      setProgress(90);
      const blob = new Blob([fileContent], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      a.remove();
      setLastMeta(backup.metadata);
      setProgress(100);
      setMessage({ type: 'success', text: `Full backup downloaded${password ? ' (encrypted)' : ''} — ${backup.metadata.total_records} records across ${Object.keys(backup.entities).length} entities.` });
    } catch (err) {
      setMessage({ type: 'error', text: 'Export failed: ' + (err.response?.data?.error || err.message) });
    } finally {
      setExporting(false);
      setTimeout(() => setProgress(0), 1500);
    }
  };

  return (
    <Card className="border-0 bg-white/10 backdrop-blur-sm border border-white/20 shadow-xl">
      <CardHeader className="border-b border-white/10">
        <CardTitle className="flex items-center gap-2 text-white">
          <Download className="w-5 h-5 text-emerald-400" />
          Full Database Export
        </CardTitle>
        <CardDescription className="text-indigo-200">
          Download all {ALL_ENTITIES.length} entity tables as a single JSON file.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-6 space-y-4">
        <DbEnvSelector value={dbEnv} onChange={setDbEnv} />
        <PasswordField value={password} onChange={setPassword} />
        <div className="bg-white/5 rounded-lg p-4 max-h-48 overflow-y-auto space-y-1.5 border border-white/10">
          {ALL_ENTITIES.map(e => (
            <div key={e} className="flex items-center justify-between text-xs">
              <span className="text-indigo-200">{e}</span>
              <Badge variant="outline" className="border-white/20 text-indigo-300 py-0">included</Badge>
            </div>
          ))}
        </div>
        {progress > 0 && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-indigo-200">
              <span>Exporting...</span><span>{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}
        {lastMeta && (
          <div className="text-xs text-indigo-300 flex items-center gap-2">
            <Clock className="w-3 h-3" />
            Last export: {format(new Date(lastMeta.exported_at), "MMM d, yyyy h:mm a")} — {lastMeta.total_records} records
          </div>
        )}
        <StatusMessage message={message} />
        <Button onClick={handleExport} disabled={exporting}
          className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white gap-2">
          {exporting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          {exporting ? 'Exporting...' : 'Download Full Backup (.json)'}
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── INDIVIDUAL TABLE EXPORT ──────────────────────────────────────────────────
function TableExportPanel() {
  const [downloading, setDownloading] = useState(null);
  const [message, setMessage] = useState(null);
  const [dbEnv, setDbEnv] = useState('prod');
  const [password, setPassword] = useState('');

  const handleTableExport = async (entityName) => {
    setDownloading(entityName);
    setMessage(null);
    try {
      const response = await base44.functions.invoke('exportDatabaseBackup', { mode: 'table', entity: entityName, data_env: dbEnv });
      const data = response.data;
      let fileContent = JSON.stringify(data, null, 2);
      let fileName = `crs_${entityName}_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.json`;
      if (password) {
        fileContent = await encryptBackup(fileContent, password);
        fileName = fileName.replace('.json', '.enc.json');
      }
      const blob = new Blob([fileContent], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      a.remove();
      setMessage({ type: 'success', text: `${entityName} exported${password ? ' (encrypted)' : ''} — ${data.metadata.total_records} records.` });
    } catch (err) {
      setMessage({ type: 'error', text: `Failed to export ${entityName}: ` + (err.response?.data?.error || err.message) });
    } finally {
      setDownloading(null);
    }
  };

  return (
    <Card className="border-0 bg-white/10 backdrop-blur-sm border border-white/20 shadow-xl">
      <CardHeader className="border-b border-white/10">
        <CardTitle className="flex items-center gap-2 text-white">
          <Table2 className="w-5 h-5 text-blue-400" />
          Individual Table Export
        </CardTitle>
        <CardDescription className="text-indigo-200">
          Download any single entity table as its own JSON file.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-6 space-y-4">
        <DbEnvSelector value={dbEnv} onChange={setDbEnv} />
        <PasswordField value={password} onChange={setPassword} />
        <StatusMessage message={message} />
        <div className="space-y-1.5 max-h-80 overflow-y-auto">
          {ALL_ENTITIES.map(entity => (
            <div key={entity} className="flex items-center justify-between bg-white/5 border border-white/10 rounded-lg px-3 py-2">
              <span className="text-sm text-indigo-200">{entity}</span>
              <Button
                size="sm"
                variant="outline"
                disabled={downloading === entity}
                onClick={() => handleTableExport(entity)}
                className="h-7 px-3 text-xs border-white/20 text-white hover:bg-white/10 gap-1"
              >
                {downloading === entity
                  ? <RefreshCw className="w-3 h-3 animate-spin" />
                  : <Download className="w-3 h-3" />}
                {downloading === entity ? 'Saving...' : 'Export'}
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── SCHEDULED / ADHOC BACKUP ─────────────────────────────────────────────────
function ScheduledBackupPanel() {
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState(null);
  const [lastRun, setLastRun] = useState(null);
  const [dbEnv, setDbEnv] = useState('prod');

  const handleAdhoc = async () => {
    setRunning(true);
    setMessage(null);
    try {
      const response = await base44.functions.invoke('scheduledDailyBackup', { data_env: dbEnv });
      const { metadata } = response.data;
      setLastRun(metadata);
      setMessage({ type: 'success', text: `Ad-hoc backup completed — ${metadata.total_records} records across ${metadata.entity_count} entities.` });
    } catch (err) {
      setMessage({ type: 'error', text: 'Ad-hoc backup failed: ' + (err.response?.data?.error || err.message) });
    } finally {
      setRunning(false);
    }
  };

  return (
    <Card className="border-0 bg-white/10 backdrop-blur-sm border border-white/20 shadow-xl">
      <CardHeader className="border-b border-white/10">
        <CardTitle className="flex items-center gap-2 text-white">
          <CalendarClock className="w-5 h-5 text-purple-400" />
          Automated Backup Schedule
        </CardTitle>
        <CardDescription className="text-indigo-200">
          Daily backups run automatically at midnight (Australia/Perth, AWST UTC+8). You can also trigger a backup manually below.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-6 space-y-5">
        <DbEnvSelector value={dbEnv} onChange={setDbEnv} />
        {/* Schedule info */}
        <div className="bg-white/5 border border-white/10 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-indigo-300 font-semibold uppercase tracking-wide">Schedule</span>
            <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30">Active</Badge>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-white/5 rounded p-2 border border-white/10">
              <p className="text-indigo-400 mb-1">Frequency</p>
              <p className="text-white font-medium">Daily</p>
            </div>
            <div className="bg-white/5 rounded p-2 border border-white/10">
              <p className="text-indigo-400 mb-1">Time</p>
              <p className="text-white font-medium">Midnight (AWST)</p>
            </div>
            <div className="bg-white/5 rounded p-2 border border-white/10">
              <p className="text-indigo-400 mb-1">Timezone</p>
              <p className="text-white font-medium">Australia/Perth</p>
            </div>
            <div className="bg-white/5 rounded p-2 border border-white/10">
              <p className="text-indigo-400 mb-1">UTC Equivalent</p>
              <p className="text-white font-medium">16:00 UTC</p>
            </div>
          </div>
          <p className="text-xs text-indigo-300">
            Each run captures a full snapshot of all {ALL_ENTITIES.length} entity tables and logs an audit entry.
          </p>
        </div>

        {lastRun && (
          <div className="text-xs text-indigo-300 flex items-center gap-2">
            <Clock className="w-3 h-3" />
            Last ad-hoc run: {format(new Date(lastRun.exported_at), "MMM d, yyyy h:mm a")} — {lastRun.total_records} records
          </div>
        )}

        <StatusMessage message={message} />

        <Button
          onClick={handleAdhoc}
          disabled={running}
          className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white gap-2"
        >
          {running ? <RefreshCw className="w-4 h-4 animate-spin" /> : <PlayCircle className="w-4 h-4" />}
          {running ? 'Running Backup...' : 'Run Ad-Hoc Backup Now'}
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── RESTORE PANEL ────────────────────────────────────────────────────────────
function RestorePanel() {
  const [restoring, setRestoring] = useState(false);
  const [restoreProgress, setRestoreProgress] = useState(0);
  const [restoreReport, setRestoreReport] = useState(null);
  const [backupFileData, setBackupFileData] = useState(null);
  const [backupFileMeta, setBackupFileMeta] = useState(null);
  const [selectedEntities, setSelectedEntities] = useState([]);
  const [showConfirm, setShowConfirm] = useState(false);
  const [message, setMessage] = useState(null);
  const [previewExpanded, setPreviewExpanded] = useState(true);
  const [dbEnv, setDbEnv] = useState('prod');
  const [preflight, setPreflight] = useState(null); // null | { running, results }
  const [preflightExpanded, setPreflightExpanded] = useState(true);
  const [restorePassword, setRestorePassword] = useState('');
  const [encryptedRawFile, setEncryptedRawFile] = useState(null); // raw string if file is encrypted
  const [decryptError, setDecryptError] = useState(null);
  const fileInputRef = useRef(null);

  // Run pre-flight schema validation
  const runPreflight = async (parsedData) => {
    setPreflight({ running: true, results: [] });
    const results = [];
    const entities = Object.keys(parsedData.entities);

    for (const entityName of entities) {
      const records = parsedData.entities[entityName];
      if (!records?.length) continue;

      try {
        const schema = await base44.entities[entityName]?.schema?.();
        if (!schema?.properties) {
          results.push({ entity: entityName, status: 'unknown', issues: ['Could not load current schema for comparison'] });
          continue;
        }

        const currentFields = new Set(Object.keys(schema.properties));
        const backupFields = new Set(Object.keys(records[0]));

        // Remove built-in fields from comparison
        const builtIn = new Set(['id', 'created_date', 'updated_date', 'created_by', 'created_by_id', 'is_sample']);
        builtIn.forEach(f => { currentFields.delete(f); backupFields.delete(f); });

        const missingInSchema = [...backupFields].filter(f => !currentFields.has(f) && !builtIn.has(f));
        const missingInBackup = [...currentFields].filter(f => !backupFields.has(f));

        const issues = [];
        if (missingInSchema.length > 0)
          issues.push(`Extra fields in backup (not in current schema): ${missingInSchema.join(', ')}`);
        if (missingInBackup.length > 0)
          issues.push(`Fields in current schema missing from backup: ${missingInBackup.join(', ')}`);

        results.push({
          entity: entityName,
          recordCount: records.length,
          status: issues.length === 0 ? 'ok' : 'warn',
          issues
        });
      } catch {
        results.push({ entity: entityName, status: 'unknown', issues: ['Schema check failed'] });
      }
    }

    setPreflight({ running: false, results });
  };

  const handleDecryptAndLoad = async (rawString) => {
    setDecryptError(null);
    if (!restorePassword) {
      setDecryptError('This file is encrypted. Enter the decryption password.');
      return;
    }
    try {
      const decrypted = await decryptBackup(rawString, restorePassword);
      parseAndSetBackup(decrypted);
      setEncryptedRawFile(null);
    } catch {
      setDecryptError('Incorrect password or corrupted file. Please try again.');
    }
  };

  const parseAndSetBackup = (rawString) => {
    try {
      const parsed = JSON.parse(rawString);
      if (parsed.entity && parsed.records) {
        const syntheticFull = {
          metadata: { ...parsed.metadata, mode: 'table', entity: parsed.entity },
          entities: { [parsed.entity]: parsed.records }
        };
        setBackupFileData(syntheticFull);
        setBackupFileMeta(syntheticFull.metadata);
        setSelectedEntities([parsed.entity]);
        runPreflight(syntheticFull);
      } else if (parsed.entities && parsed.metadata) {
        setBackupFileData(parsed);
        setBackupFileMeta(parsed.metadata);
        setSelectedEntities(ALL_ENTITIES.filter(e => parsed.entities[e]?.length > 0));
        runPreflight(parsed);
      } else {
        setMessage({ type: 'error', text: 'Invalid backup file. Please select a valid CRS backup JSON.' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to parse file. Make sure it is a valid JSON backup.' });
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setMessage(null);
    setRestoreReport(null);
    setBackupFileData(null);
    setBackupFileMeta(null);
    setSelectedEntities([]);
    setPreflight(null);
    setEncryptedRawFile(null);
    setDecryptError(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const raw = ev.target.result;
      if (isEncryptedBackup(raw)) {
        setEncryptedRawFile(raw);
        setDecryptError('This file is encrypted. Enter the decryption password and click "Decrypt & Load".');
      } else {
        parseAndSetBackup(raw);
      }
    };
    reader.readAsText(file);
  };

  const handleRestore = async () => {
    setShowConfirm(false);
    setRestoring(true);
    setRestoreProgress(10);
    setMessage(null);
    setRestoreReport(null);
    try {
      setRestoreProgress(30);
      const response = await base44.functions.invoke('restoreDatabaseBackup', {
        backup: backupFileData,
        entities_to_restore: selectedEntities,
        data_env: dbEnv
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

  const availableEntities = backupFileData
    ? ALL_ENTITIES.filter(e => backupFileData.entities[e] !== undefined)
    : [];

  return (
    <Card className="border-0 bg-white/10 backdrop-blur-sm border border-white/20 shadow-xl">
      <CardHeader className="border-b border-white/10">
        <CardTitle className="flex items-center gap-2 text-white">
          <Upload className="w-5 h-5 text-amber-400" />
          Restore from Backup
        </CardTitle>
        <CardDescription className="text-indigo-200">
          Upload a full or single-table backup file. Select which tables to restore.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-6 space-y-4">
        <DbEnvSelector value={dbEnv} onChange={setDbEnv} />
        {/* File drop zone */}
        <div
          className="border-2 border-dashed border-white/20 rounded-lg p-6 text-center cursor-pointer hover:border-white/40 hover:bg-white/5 transition-all"
          onClick={() => fileInputRef.current?.click()}
        >
          <FileJson className="w-8 h-8 mx-auto mb-2 text-indigo-300" />
          {backupFileMeta ? (
            <div className="space-y-1">
              <p className="text-sm font-medium text-white">Backup loaded
                {backupFileMeta.mode === 'table' && (
                  <Badge className="ml-2 bg-blue-500/20 text-blue-300 border-blue-500/30 text-xs">Single Table</Badge>
                )}
              </p>
              <p className="text-xs text-indigo-300">Exported: {format(new Date(backupFileMeta.exported_at), "MMM d, yyyy h:mm a")}</p>
              <p className="text-xs text-indigo-300">by {backupFileMeta.exported_by} · {backupFileMeta.total_records} records</p>
              {backupFileMeta.entity && <p className="text-xs text-blue-300">Table: {backupFileMeta.entity}</p>}
            </div>
          ) : (
            <div>
              <p className="text-sm text-indigo-200">Click to select backup file</p>
              <p className="text-xs text-indigo-400 mt-1">Full DB or single-table .json</p>
            </div>
          )}
          <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleFileSelect} />
        </div>

        {/* Entity selection */}
        {backupFileData && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-indigo-200 uppercase tracking-wide">Select tables to restore</p>
              <div className="flex gap-2">
                <button className="text-xs text-indigo-300 hover:text-white" onClick={() => setSelectedEntities(availableEntities)}>All</button>
                <button className="text-xs text-indigo-300 hover:text-white" onClick={() => setSelectedEntities([])}>None</button>
              </div>
            </div>
            <div className="bg-white/5 rounded-lg p-3 max-h-48 overflow-y-auto space-y-1.5 border border-white/10">
              {availableEntities.map(entity => {
                const count = backupFileData.entities[entity]?.length || 0;
                return (
                  <div key={entity} className="flex items-center gap-2">
                    <Checkbox
                      id={entity}
                      checked={selectedEntities.includes(entity)}
                      onCheckedChange={() => toggleEntity(entity)}
                      className="border-white/30"
                    />
                    <label htmlFor={entity} className="text-xs flex-1 flex justify-between cursor-pointer text-indigo-200">
                      <span>{entity}</span>
                      <span className="text-emerald-400">{count} records</span>
                    </label>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Pre-flight Validation ───────────────────────────────────────── */}
        {preflight && (
          <div className="border border-white/20 rounded-lg overflow-hidden">
            <button
              className="w-full flex items-center justify-between px-4 py-3 bg-white/5 hover:bg-white/10 transition-colors text-left"
              onClick={() => setPreflightExpanded(p => !p)}
            >
              <span className="flex items-center gap-2 text-sm font-semibold text-white">
                {preflight.running ? (
                  <RefreshCw className="w-4 h-4 text-indigo-300 animate-spin" />
                ) : preflight.results.some(r => r.status === 'warn') ? (
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                )}
                Pre-flight Schema Check
                {!preflight.running && (
                  <span className="text-xs font-normal text-indigo-300">
                    — {preflight.results.filter(r => r.status === 'ok').length} ok,{' '}
                    {preflight.results.filter(r => r.status === 'warn').length} warnings,{' '}
                    {preflight.results.filter(r => r.status === 'unknown').length} unknown
                  </span>
                )}
              </span>
              {preflightExpanded ? <ChevronUp className="w-4 h-4 text-indigo-300" /> : <ChevronDown className="w-4 h-4 text-indigo-300" />}
            </button>

            {preflightExpanded && (
              <div className="bg-white/5 p-4 space-y-2 max-h-72 overflow-y-auto">
                {preflight.running ? (
                  <p className="text-xs text-indigo-300 text-center py-4">Checking schemas...</p>
                ) : preflight.results.length === 0 ? (
                  <p className="text-xs text-indigo-300 text-center py-4">No entities to check.</p>
                ) : (
                  preflight.results.map(r => (
                    <div key={r.entity} className={`rounded-lg px-3 py-2 border text-xs space-y-1 ${
                      r.status === 'ok'
                        ? 'bg-emerald-900/20 border-emerald-500/30'
                        : r.status === 'warn'
                        ? 'bg-amber-900/20 border-amber-500/30'
                        : 'bg-slate-900/30 border-white/10'
                    }`}>
                      <div className="flex items-center gap-2">
                        {r.status === 'ok'
                          ? <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                          : r.status === 'warn'
                          ? <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
                          : <span className="w-3 h-3 rounded-full border border-white/30 shrink-0 inline-block" />}
                        <span className="font-semibold text-white">{r.entity}</span>
                        {r.recordCount !== undefined && (
                          <span className="text-indigo-400 ml-auto">{r.recordCount} records</span>
                        )}
                      </div>
                      {r.issues.map((issue, i) => (
                        <p key={i} className="text-amber-300 pl-5">{issue}</p>
                      ))}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Preview Summary ─────────────────────────────────────────────── */}
        {backupFileData && (
          <div className="border border-indigo-500/30 rounded-lg overflow-hidden">
            <button
              className="w-full flex items-center justify-between px-4 py-3 bg-indigo-600/20 hover:bg-indigo-600/30 transition-colors text-left"
              onClick={() => setPreviewExpanded(p => !p)}
            >
              <span className="flex items-center gap-2 text-sm font-semibold text-white">
                <Eye className="w-4 h-4 text-indigo-300" />
                Preview Restore
                <span className="text-xs font-normal text-indigo-300">
                  — {selectedEntities.length} table{selectedEntities.length !== 1 ? 's' : ''} selected,{' '}
                  {selectedEntities.reduce((sum, e) => sum + (backupFileData.entities[e]?.length || 0), 0).toLocaleString()} records total
                </span>
              </span>
              {previewExpanded
                ? <ChevronUp className="w-4 h-4 text-indigo-300" />
                : <ChevronDown className="w-4 h-4 text-indigo-300" />}
            </button>

            {previewExpanded && (
              <div className="bg-white/5 p-4 space-y-3">
                {/* Summary stats */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Tables in backup', value: availableEntities.length },
                    { label: 'Tables selected', value: selectedEntities.length },
                    { label: 'Total records', value: selectedEntities.reduce((sum, e) => sum + (backupFileData.entities[e]?.length || 0), 0).toLocaleString() },
                  ].map(s => (
                    <div key={s.label} className="bg-white/5 border border-white/10 rounded-lg p-2 text-center">
                      <p className="text-lg font-bold text-white">{s.value}</p>
                      <p className="text-xs text-indigo-300 mt-0.5">{s.label}</p>
                    </div>
                  ))}
                </div>

                {/* Per-entity breakdown */}
                <div className="max-h-52 overflow-y-auto space-y-1">
                  {availableEntities.map(entity => {
                    const count = backupFileData.entities[entity]?.length || 0;
                    const selected = selectedEntities.includes(entity);
                    return (
                      <div
                        key={entity}
                        className={`flex items-center justify-between text-xs px-3 py-1.5 rounded ${
                          selected ? 'bg-indigo-600/20 border border-indigo-500/30' : 'opacity-40'
                        }`}
                      >
                        <span className="text-indigo-200 flex items-center gap-1.5">
                          {selected
                            ? <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            : <span className="w-3 h-3 rounded-full border border-white/20 inline-block" />}
                          {entity}
                        </span>
                        <span className={`font-mono font-semibold ${selected ? 'text-emerald-400' : 'text-indigo-500'}`}>
                          {count.toLocaleString()}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Backup provenance */}
                <div className="text-xs text-indigo-400 border-t border-white/10 pt-3 space-y-1">
                  <p>Exported: <span className="text-indigo-200">{backupFileMeta ? format(new Date(backupFileMeta.exported_at), "MMM d, yyyy h:mm a") : '—'}</span></p>
                  <p>By: <span className="text-indigo-200">{backupFileMeta?.exported_by}</span></p>
                </div>
              </div>
            )}
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
            Restore will <strong>delete and replace</strong> selected table data. Export a fresh backup first as a precaution.
          </AlertDescription>
        </Alert>

        <StatusMessage message={message} />

        <Button
          onClick={() => setShowConfirm(true)}
          disabled={!backupFileData || restoring || selectedEntities.length === 0}
          className="w-full bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white gap-2"
        >
          {restoring ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          {restoring ? 'Restoring...' : `Restore ${selectedEntities.length} Table${selectedEntities.length !== 1 ? 's' : ''}`}
        </Button>

        {/* Restore report */}
        {restoreReport && (
          <div className="space-y-3 pt-2 border-t border-white/10">
            <p className="text-xs font-semibold text-white uppercase tracking-wide flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Restore Report
            </p>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Restored', value: restoreReport.summary.restored, color: 'text-emerald-400' },
                { label: 'Failed', value: restoreReport.summary.failed, color: 'text-red-400' },
                { label: 'Skipped', value: restoreReport.summary.skipped, color: 'text-amber-400' },
              ].map(s => (
                <div key={s.label} className="bg-white/5 rounded-lg p-2 text-center border border-white/10">
                  <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-indigo-200 mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
            {restoreReport.report.failed.map((f, i) => (
              <div key={i} className="text-xs text-red-300 bg-red-900/20 rounded px-2 py-1">
                <strong>{f.entity}:</strong> {f.reason}
              </div>
            ))}
          </div>
        )}

        {/* Confirm dialog */}
        <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                Confirm Restore
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2 text-sm text-slate-700">
              <p>Restoring <strong>{selectedEntities.length} table{selectedEntities.length !== 1 ? 's' : ''}</strong> from backup:</p>
              <div className="bg-slate-50 rounded p-3 text-xs space-y-1">
                <p><strong>Exported:</strong> {backupFileMeta ? format(new Date(backupFileMeta.exported_at), "MMM d, yyyy h:mm a") : '-'}</p>
                <p><strong>By:</strong> {backupFileMeta?.exported_by}</p>
                <p><strong>Tables:</strong> {selectedEntities.join(', ')}</p>
                <p><strong>Target Database:</strong>{' '}
                  <span className={dbEnv === 'prod' ? 'text-emerald-700 font-semibold' : 'text-amber-700 font-semibold'}>
                    {dbEnv === 'prod' ? '🟢 Production' : '🧪 Test'}
                  </span>
                </p>
              </div>
              <Alert className="bg-red-50 border-red-200">
                <Trash2 className="w-4 h-4 text-red-600" />
                <AlertDescription className="text-red-800 text-xs">
                  All existing data in the selected tables will be <strong>permanently deleted</strong> and replaced. This cannot be undone.
                </AlertDescription>
              </Alert>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowConfirm(false)}>Cancel</Button>
              <Button onClick={handleRestore} className="bg-red-600 hover:bg-red-700 text-white">
                Yes, Restore Now
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

// ─── ROOT COMPONENT ───────────────────────────────────────────────────────────
export default function BackupManager() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
          <Database className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">Database Backup & Restore</h2>
          <p className="text-sm text-indigo-200">Export, schedule, and restore your CRS platform data</p>
        </div>
      </div>

      <Tabs defaultValue="scheduled" className="space-y-6">
        <TabsList className="bg-white/10 backdrop-blur-sm">
          <TabsTrigger value="scheduled" className="text-white data-[state=active]:bg-white/20 gap-2">
            <CalendarClock className="w-4 h-4" /> Scheduled
          </TabsTrigger>
          <TabsTrigger value="export-full" className="text-white data-[state=active]:bg-white/20 gap-2">
            <Database className="w-4 h-4" /> Full Export
          </TabsTrigger>
          <TabsTrigger value="export-table" className="text-white data-[state=active]:bg-white/20 gap-2">
            <Table2 className="w-4 h-4" /> Table Export
          </TabsTrigger>
          <TabsTrigger value="restore" className="text-white data-[state=active]:bg-white/20 gap-2">
            <Upload className="w-4 h-4" /> Restore
          </TabsTrigger>
          <TabsTrigger value="history" className="text-white data-[state=active]:bg-white/20 gap-2">
            <History className="w-4 h-4" /> Backup History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="scheduled"><ScheduledBackupPanel /></TabsContent>
        <TabsContent value="export-full"><FullExportPanel /></TabsContent>
        <TabsContent value="export-table"><TableExportPanel /></TabsContent>
        <TabsContent value="restore"><RestorePanel /></TabsContent>
        <TabsContent value="history"><BackupHistoryPanel /></TabsContent>
      </Tabs>
    </div>
  );
}