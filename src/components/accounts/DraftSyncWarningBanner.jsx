import React from "react";
import { AlertTriangle, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Amber warning banner shown after an account edit mid-classification.
 * Shows which steps were auto-updated (resyncedSteps) and which need manual review (affectedSteps).
 */
export default function DraftSyncWarningBanner({
  isDirty,
  affectedSteps = [],
  resyncedSteps = [],
  stepMap = {},
  onSaveNow,
  onDismiss,
  isSaving = false,
}) {
  if (!isDirty && affectedSteps.length === 0) return null;

  const resyncedNames = resyncedSteps
    .map(id => stepMap[id]?.step_title)
    .filter(Boolean)
    .slice(0, 3);

  const affectedNames = affectedSteps
    .map(id => stepMap[id]?.step_title)
    .filter(Boolean)
    .slice(0, 3);

  return (
    <div className="rounded-lg border-2 border-amber-300 bg-amber-50 px-4 py-3 flex gap-3">
      <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-amber-900">
          Account details updated — workflow answers may be out of date
        </p>
        <div className="mt-1 space-y-1 text-xs text-amber-800">
          {resyncedNames.length > 0 && (
            <p>
              <span className="font-medium">Auto-updated prefilled steps:</span>{" "}
              {resyncedNames.join(", ")}
              {resyncedSteps.length > 3 && ` +${resyncedSteps.length - 3} more`}
            </p>
          )}
          {affectedNames.length > 0 && (
            <p>
              <span className="font-medium">Steps needing your review:</span>{" "}
              {affectedNames.join(", ")}
              {affectedSteps.length > 3 && ` +${affectedSteps.length - 3} more`}
            </p>
          )}
          {isDirty && (
            <p className="font-medium text-amber-900 mt-1">
              ⚠️ Your draft has not been re-saved since the account update.
            </p>
          )}
        </div>
        {isDirty && onSaveNow && (
          <div className="mt-2">
            <Button
              size="sm"
              variant="outline"
              className="border-amber-400 text-amber-800 hover:bg-amber-100 text-xs h-7"
              onClick={onSaveNow}
              disabled={isSaving}
            >
              <Save className="w-3.5 h-3.5 mr-1.5" />
              {isSaving ? "Saving…" : "Save Draft Now"}
            </Button>
          </div>
        )}
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="text-amber-500 hover:text-amber-700 flex-shrink-0"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}