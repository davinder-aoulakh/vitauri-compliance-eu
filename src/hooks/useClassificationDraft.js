import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

/**
 * Hook for a single record's draft — used inside classification dialogs.
 */
export function useClassificationDraft(targetId, targetType, tenantId) {
  const queryClient = useQueryClient();

  const { data: drafts = [], isLoading } = useQuery({
    queryKey: ["classification-draft", targetType, targetId],
    queryFn: () =>
      targetId && targetType
        ? base44.entities.ClassificationDraft.filter({
            target_id: targetId,
            target_type: targetType,
          })
        : [],
    enabled: !!targetId && !!targetType,
  });

  const draft = drafts[0] || null;
  const hasDraft = !!draft;

  const saveDraft = async (draftData) => {
    const payload = {
      target_id: targetId,
      target_type: targetType,
      tenant_id: tenantId,
      saved_at: new Date().toISOString(),
      ...draftData,
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

  return { draft, isLoadingDraft: isLoading, hasDraft, saveDraft, clearDraft };
}

/**
 * Hook for list pages — returns a map { [target_id]: draft } for O(1) lookup.
 */
export function useClassificationDraftMap(tenantId, targetType) {
  const { data: drafts = [] } = useQuery({
    queryKey: ["classification-drafts-bulk", tenantId, targetType],
    queryFn: () =>
      tenantId && targetType
        ? base44.entities.ClassificationDraft.filter({
            tenant_id: tenantId,
            target_type: targetType,
          })
        : [],
    enabled: !!tenantId && !!targetType,
  });

  return drafts.reduce((map, d) => {
    map[d.target_id] = d;
    return map;
  }, {});
}