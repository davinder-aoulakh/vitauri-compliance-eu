import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  History,
  Download,
  Trash2,
  RefreshCw,
  Clock,
  Database,
  Table2,
  CalendarClock,
  PlayCircle,
  Settings,
  CheckCircle2,
  AlertTriangle
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

const RETENTION_OPTIONS = [
  { label: "30 days", value: 30 },
  { label: "60 days", value: 60 },
  { label: "90 days (default)", value: 90 },
  { label: "180 days", value: 180 },
  { label: "365 days", value: 365 },
];

const BACKUP_TYPE_CONFIG = {
  full_export: { label: "Full Export", icon: Database, color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" },
  table_export: { label: "Table Export", icon: Table2, color: "bg-blue-500/20 text-blue-300 border-blue-500/30" },
  adhoc: { label: "Ad-Hoc", icon: PlayCircle, color: "bg-purple-500/20 text-purple-300 border-purple-500/30" },
  scheduled: { label: "Scheduled", icon: CalendarClock, color: "bg-amber-500/20 text-amber-300 border-amber-500/30" },
};

export default function BackupHistoryPanel() {
  const queryClient = useQueryClient();
  const [savingRetention, setSavingRetention] = useState(false);
  const [retentionMessage, setRetentionMessage] = useState(null);

  // Load backups
  const { data: backups = [], isLoading, refetch } = useQuery({
    queryKey: ["backup-history"],
    queryFn: () => base44.entities.BackupStorage.list("-exported_at", 100),
  });

  // Load retention setting
  const { data: retentionSettings = [] } = useQuery({
    queryKey: ["backup-retention"],
    queryFn: () => base44.entities.PlatformSettings.filter({ setting_key: "backup_retention_days" }),
  });

  const currentRetentionDays = retentionSettings[0]?.setting_value?.days || 90;
  const retentionSettingId = retentionSettings[0]?.id;
  const [selectedRetention, setSelectedRetention] = useState(null);
  const effectiveRetention = selectedRetention ?? currentRetentionDays;

  // Delete backup record
  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.BackupStorage.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["backup-history"] }),
  });

  const handleSaveRetention = async () => {
    setSavingRetention(true);
    setRetentionMessage(null);
    try {
      const days = effectiveRetention;
      if (retentionSettingId) {
        await base44.entities.PlatformSettings.update(retentionSettingId, {
          setting_value: { days }
        });
      } else {
        await base44.entities.PlatformSettings.create({
          setting_key: "backup_retention_days",
          setting_value: { days }
        });
      }
      queryClient.invalidateQueries({ queryKey: ["backup-retention"] });
      setRetentionMessage({ type: "success", text: `Retention policy set to ${days} days.` });
    } catch (e) {
      setRetentionMessage({ type: "error", text: "Failed to save retention setting." });
    } finally {
      setSavingRetention(false);
      setTimeout(() => setRetentionMessage(null), 3000);
    }
  };

  const handleDownload = async (backup) => {
    if (!backup.file_url) return;
    try {
      const response = await fetch(backup.file_url);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = backup.file_name || `backup_${backup.exported_at}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      window.open(backup.file_url, "_blank");
    }
  };

  return (
    <div className="space-y-6">
      {/* Retention Policy */}
      <Card className="border-0 bg-white/10 backdrop-blur-sm border border-white/20 shadow-xl">
        <CardHeader className="border-b border-white/10">
          <CardTitle className="flex items-center gap-2 text-white">
            <Settings className="w-5 h-5 text-indigo-300" />
            Retention Policy
          </CardTitle>
          <CardDescription className="text-indigo-200">
            Backups older than the retention period are automatically purged on each scheduled run.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <Select
              value={String(effectiveRetention)}
              onValueChange={(v) => setSelectedRetention(Number(v))}
            >
              <SelectTrigger className="w-48 bg-white/10 border-white/20 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RETENTION_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={String(opt.value)}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={handleSaveRetention}
              disabled={savingRetention || effectiveRetention === currentRetentionDays}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {savingRetention ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : null}
              Save
            </Button>
            {retentionMessage && (
              <span className={`text-xs flex items-center gap-1 ${retentionMessage.type === "success" ? "text-emerald-300" : "text-red-300"}`}>
                {retentionMessage.type === "success"
                  ? <CheckCircle2 className="w-3 h-3" />
                  : <AlertTriangle className="w-3 h-3" />}
                {retentionMessage.text}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Backup History List */}
      <Card className="border-0 bg-white/10 backdrop-blur-sm border border-white/20 shadow-xl">
        <CardHeader className="border-b border-white/10">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-white">
                <History className="w-5 h-5 text-indigo-300" />
                Backup History
              </CardTitle>
              <CardDescription className="text-indigo-200 mt-1">
                {backups.length} backup{backups.length !== 1 ? "s" : ""} stored
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="border-white/20 text-white hover:bg-white/10"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <RefreshCw className="w-6 h-6 animate-spin text-indigo-300" />
            </div>
          ) : backups.length === 0 ? (
            <div className="text-center py-10 text-indigo-300">
              <History className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">No backups stored yet.</p>
              <p className="text-xs mt-1 opacity-60">Run a Full Export, Table Export, or Ad-Hoc backup to see them here.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
              {backups.map((backup) => {
                const typeConfig = BACKUP_TYPE_CONFIG[backup.backup_type] || BACKUP_TYPE_CONFIG.full_export;
                const Icon = typeConfig.icon;
                const isExpired = backup.expires_at && new Date(backup.expires_at) < new Date();

                return (
                  <div
                    key={backup.id}
                    className="flex items-center justify-between bg-white/5 border border-white/10 rounded-lg px-4 py-3 gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Icon className="w-4 h-4 text-indigo-300 shrink-0" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge className={`text-xs ${typeConfig.color}`}>{typeConfig.label}</Badge>
                          {backup.entity_name && (
                            <span className="text-xs text-indigo-300">{backup.entity_name}</span>
                          )}
                          {isExpired && (
                            <Badge className="text-xs bg-red-500/20 text-red-300 border-red-500/30">Expired</Badge>
                          )}
                        </div>
                        <p className="text-xs text-white mt-1 font-medium truncate">
                          {backup.file_name || "backup.json"}
                        </p>
                        <div className="flex items-center gap-3 mt-0.5 text-xs text-indigo-400">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {backup.exported_at ? format(new Date(backup.exported_at), "MMM d, yyyy h:mm a") : "—"}
                          </span>
                          {backup.total_records !== undefined && (
                            <span>{backup.total_records.toLocaleString()} records</span>
                          )}
                          <span>by {backup.exported_by}</span>
                        </div>
                        {backup.expires_at && (
                          <p className="text-xs text-indigo-500 mt-0.5">
                            Expires {formatDistanceToNow(new Date(backup.expires_at), { addSuffix: true })}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {backup.file_url ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDownload(backup)}
                          className="h-7 px-3 text-xs border-white/20 text-white hover:bg-white/10 gap-1"
                        >
                          <Download className="w-3 h-3" />
                          Download
                        </Button>
                      ) : (
                        <span className="text-xs text-indigo-500 italic">No file</span>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => deleteMutation.mutate(backup.id)}
                        disabled={deleteMutation.isPending}
                        className="h-7 w-7 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}