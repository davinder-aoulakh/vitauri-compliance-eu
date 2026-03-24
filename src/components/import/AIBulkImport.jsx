import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Building2, AlertTriangle } from "lucide-react";
import RFIEntityImportCard from "./RFIEntityImportCard";
import { getFiTypeConfig } from "@/lib/fiTypeTemplates";

export default function AIBulkImport({
  tenant,
  entities,
  importType = "Account",
  onComplete,
  onCancel,
}) {
  const [completedEntities, setCompletedEntities] = useState({});

  const handleEntityComplete = ({ entity, imported, updated, failed }) => {
    setCompletedEntities(prev => ({
      ...prev,
      [entity.id]: { imported, updated, failed },
    }));
  };

  const totalCompleted = Object.keys(completedEntities).length;
  const totalImported = Object.values(completedEntities).reduce((s, e) => s + e.imported, 0);
  const totalUpdated = Object.values(completedEntities).reduce((s, e) => s + e.updated, 0);
  const totalFailed = Object.values(completedEntities).reduce((s, e) => s + e.failed, 0);

  // Group entities by fi_type for display
  const groupedEntities = (entities || []).reduce((acc, entity) => {
    const key = entity.fi_type || "not_applicable";
    if (!acc[key]) acc[key] = [];
    acc[key].push(entity);
    return acc;
  }, {});

  if (importType !== "Account") {
    // Entity import — simple single-flow (unchanged)
    return (
      <div className="space-y-4">
        <Card className="border-2 border-indigo-100 bg-indigo-50/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-600" />
              Entity Import
            </CardTitle>
            <CardDescription>
              Use the legacy import flow for entity data.
            </CardDescription>
          </CardHeader>
        </Card>
        <div className="flex justify-end">
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="border-2 border-indigo-100 bg-indigo-50/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-600" />
            AI-Powered Bulk Import
          </CardTitle>
          <CardDescription>
            Each RFI Entity has its own tailored template based on its FI Type. Download the template, fill in your data, then upload to import.
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Summary bar (once any entity has completed) */}
      {totalCompleted > 0 && (
        <div className="flex items-center gap-4 px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-sm">
          <span className="text-slate-600 font-medium">{totalCompleted} entit{totalCompleted !== 1 ? "ies" : "y"} processed</span>
          <span className="text-green-700 font-semibold">{totalImported} created</span>
          {totalUpdated > 0 && <span className="text-amber-700 font-semibold">{totalUpdated} updated</span>}
          {totalFailed > 0 && <span className="text-red-700 font-semibold">{totalFailed} failed</span>}
        </div>
      )}

      {/* Entities grouped by FI Type */}
      {Object.entries(groupedEntities).map(([fiType, fiEntities]) => {
        const config = getFiTypeConfig(fiType);
        return (
          <div key={fiType} className="space-y-3">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-slate-400" />
              <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wider">{config.label}</h3>
              <Badge variant="outline" className="text-xs">{fiEntities.length} entit{fiEntities.length !== 1 ? "ies" : "y"}</Badge>
              <div className="flex-1 h-px bg-slate-200" />
              <span className="text-xs text-slate-400">Account types: {config.allowedAccountTypes.join(", ")}</span>
            </div>
            <div className="space-y-3">
              {fiEntities.map(entity => (
                <RFIEntityImportCard
                  key={entity.id}
                  entity={entity}
                  tenant={tenant}
                  onComplete={handleEntityComplete}
                />
              ))}
            </div>
          </div>
        );
      })}

      {(!entities || entities.length === 0) && (
        <Card className="border border-amber-200 bg-amber-50">
          <CardContent className="py-8 text-center">
            <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
            <p className="text-sm font-medium text-amber-800">No RFI Entities found for this tenant.</p>
            <p className="text-xs text-amber-600 mt-1">Please create entities before importing accounts.</p>
          </CardContent>
        </Card>
      )}

      {/* Footer */}
      <div className="flex justify-between items-center pt-2 border-t">
        <Button variant="outline" onClick={onCancel}>Close</Button>
        {totalCompleted > 0 && (
          <Button onClick={onComplete} className="bg-indigo-600 hover:bg-indigo-700 text-white">
            Done
          </Button>
        )}
      </div>
    </div>
  );
}