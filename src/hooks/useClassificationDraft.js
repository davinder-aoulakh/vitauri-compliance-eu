import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

/**
 * Hook for managing a single classification draft for a specific record.
 */
export function useClassificationDraft(targetId, targetType, tenantId) {
  const queryClient = useQueryClient();

  const { data: draftData, isLoading: isLoadingDraft } = useQuery({
    queryKey: ["classification-draft", targetType, targetId],
    queryFn: () =>
      base44.entities.ClassificationDraft.filter({
        target_id: targetId,
        target_type: targetType,
      }),
    enabled: !!targetId && !!targetType,
    select: (results) => results[0] || null,
  });

  const draft = draftData ?? null;
  const hasDraft = !!draft;
  const isSaving = false; // placeholder; save is async, callers track their own state

  const saveDraft = async (draftState) => {
    const payload = {
      target_id: targetId,
      target_type: targetType,
      tenant_id: tenantId,
      saved_at: new Date().toISOString(),
      ...draftState,
    };
    if (draft?.id) {
      await base44.entities.ClassificationDraft.update(draft.id, payload);
    } else {
      await base44.entities.ClassificationDraft.create(payload);
    }
    queryClient.invalidateQueries(["classification-draft", targetType, targetId]);
    queryClient.invalidateQueries(["classification-drafts-bulk"]);
  };

  const clearDraft = async () => {
    if (draft?.id) {
      await base44.entities.ClassificationDraft.delete(draft.id);
      queryClient.invalidateQueries(["classification-draft", targetType, targetId]);
      queryClient.invalidateQueries(["classification-drafts-bulk"]);
    }
  };

  return { draft, isLoadingDraft, hasDraft, saveDraft, clearDraft, isSaving };
}

/**
 * Hook that fetches all drafts for a tenant + targetType and returns a map:
 * { [target_id]: draft }
 * This enables O(1) lookup in list pages without N+1 queries.
 */
export function useClassificationDraftMap(tenantId, targetType) {
  const { data: drafts = [] } = useQuery({
    queryKey: ["classification-drafts-bulk", tenantId, targetType],
    queryFn: () =>
      base44.entities.ClassificationDraft.filter({
        tenant_id: tenantId,
        target_type: targetType,
      }),
    enabled: !!tenantId && !!targetType,
  });

  return drafts.reduce((map, draft) => {
    map[draft.target_id] = draft;
    return map;
  }, {});
}