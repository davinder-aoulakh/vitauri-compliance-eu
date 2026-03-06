import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import { Database, Download, RefreshCw, CheckCircle2, XCircle, Loader2, ShieldAlert } from "lucide-react";
import { format } from "date-fns";

export default function BackupRestore({ user }) {
  const [isCreating, setIsCreating] = useState(false);
  const [lastError, setLastError] = useState(null);
  const queryClient = useQueryClient();

  const { data: backups = [], isLoading } = useQuery({
    queryKey: ['database-backups'],
    queryFn: () => base44.entities.DatabaseBackup.list('-backup_date', 20),
    enabled: !!user
  });

  const handleCreateBackup = async () => {
    setIsCreating(true);
    setLastError(null);

    // Create an "in_progress" record first
    const backupRecord = await base44.entities.DatabaseBackup.create({
      backup_date: new Date().toISOString(),
      initiated_by: user.email,
      status: 'in_progress'
    });

    try {
      const response = await base44.functions.invoke('backupDatabase', {});
      const result = response.data;

      await base44.entities.DatabaseBackup.update(backupRecord.id, {
        status: 'completed',
        file_url: result.file_url,
        entity_counts: result.entity_counts
      });

      queryClient.invalidateQueries(['database-backups']);
    } catch (err) {
      await base44.entities.DatabaseBackup.update(backupRecord.id, {
        status: 'failed',
        error_message: err.message || 'Unknown error'
      });
      setLastError(err.message || 'Backup failed');
      queryClient.invalidateQueries(['database-backups']);
    } finally {
      setIsCreating(false);
    }
  };

  const getStatusBadge = (status) => {
    const config = {
      completed: { label: "Completed", color: "bg-green-100 text-green-800 border-green-200", icon: CheckCircle2 },
      in_progress: { label: "In Progress", color: "bg-blue-100 text-blue-800 border-blue-200", icon: Loader2 },
      failed: { label: "Failed", color: "bg-red-100 text-red-800 border-red-200", icon: XCircle }
    };
    const { label, color, icon: Icon } = config[status] || config.in_progress;
    return (
      <Badge variant="outline" className={`${color} border`}>
        <Icon className={`w-3 h-3 mr-1 ${status === 'in_progress' ? 'animate-spin' : ''}`} />
        {label}
      </Badge>
    );
  };

  const totalRecords = (counts) => {
    if (!counts) return '—';
    return Object.values(counts).reduce((a, b) => a + b, 0).toLocaleString();
  };

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card className="border-0 shadow-xl bg-white/10 backdrop-blur-sm border border-white/20">
        <CardHeader className="border-b border-white/10">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-white flex items-center gap-2">
                <Database className="w-5 h-5" />
                Database Backup
              </CardTitle>
              <CardDescription className="text-indigo-200 mt-1">
                Create and download full snapshots of all platform data
              </CardDescription>
            </div>
            <Button
              onClick={handleCreateBackup}
              disabled={isCreating}
              className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white"
            >
              {isCreating ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating Backup...</>
              ) : (
                <><RefreshCw className="w-4 h-4 mr-2" />Create Backup Now</>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <Alert className="bg-yellow-900/30 border-yellow-500/50">
            <ShieldAlert className="w-4 h-4 text-yellow-300" />
            <AlertDescription className="text-yellow-100 text-sm">
              Backups export all entity data as a JSON file. Store backups securely.
              To restore, use the downloaded JSON as reference data or contact support for a full restore procedure.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {lastError && (
        <Alert className="bg-red-900/30 border-red-500/50">
          <XCircle className="w-4 h-4 text-red-300" />
          <AlertDescription className="text-red-100">{lastError}</AlertDescription>
        </Alert>
      )}

      {/* Backup History */}
      <Card className="border-0 shadow-xl bg-white/10 backdrop-blur-sm border border-white/20">
        <CardHeader className="border-b border-white/10">
          <CardTitle className="text-white text-base">Backup History</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-white/50 mx-auto" />
            </div>
          ) : backups.length === 0 ? (
            <div className="p-12 text-center text-indigo-200">
              <Database className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No backups yet. Create your first backup above.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10 hover:bg-white/5">
                    <TableHead className="text-indigo-200">Date</TableHead>
                    <TableHead className="text-indigo-200">Initiated By</TableHead>
                    <TableHead className="text-indigo-200">Status</TableHead>
                    <TableHead className="text-indigo-200">Total Records</TableHead>
                    <TableHead className="text-right text-indigo-200">Download</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {backups.map((backup) => (
                    <TableRow key={backup.id} className="border-white/10 hover:bg-white/5">
                      <TableCell className="text-white">
                        {format(new Date(backup.backup_date), "MMM d, yyyy h:mm a")}
                      </TableCell>
                      <TableCell className="text-indigo-200 text-sm">{backup.initiated_by}</TableCell>
                      <TableCell>
                        {getStatusBadge(backup.status)}
                        {backup.error_message && (
                          <p className="text-xs text-red-300 mt-1">{backup.error_message}</p>
                        )}
                      </TableCell>
                      <TableCell className="text-white font-mono text-sm">
                        {totalRecords(backup.entity_counts)}
                      </TableCell>
                      <TableCell className="text-right">
                        {backup.file_url ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="bg-white/10 text-white border-white/20 hover:bg-white/20"
                            onClick={() => window.open(backup.file_url, '_blank')}
                          >
                            <Download className="w-3 h-3 mr-1" />
                            Download
                          </Button>
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}