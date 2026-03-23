import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Building2, Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export default function EntityAccessManager({ targetUser, tenant }) {
  const queryClient = useQueryClient();

  const { data: entities = [] } = useQuery({
    queryKey: ['entities', tenant?.id],
    queryFn: () => base44.entities.Entity.filter({ tenant_id: tenant.id }),
    enabled: !!tenant?.id
  });

  const { data: accessRecords = [], isLoading } = useQuery({
    queryKey: ['user-entity-access', targetUser?.id, tenant?.id],
    queryFn: () => base44.entities.UserEntityAccess.filter({ user_id: targetUser.id, tenant_id: tenant.id }),
    enabled: !!targetUser?.id && !!tenant?.id
  });

  const accessMap = accessRecords.reduce((map, r) => {
    map[r.rfi_entity_id] = r;
    return map;
  }, {});

  const saveMutation = useMutation({
    mutationFn: async ({ entityId, level }) => {
      const existing = accessMap[entityId];
      if (level === 'none') {
        if (existing) await base44.entities.UserEntityAccess.delete(existing.id);
      } else if (existing) {
        await base44.entities.UserEntityAccess.update(existing.id, { permission_level: level });
      } else {
        await base44.entities.UserEntityAccess.create({
          tenant_id: tenant.id,
          user_id: targetUser.id,
          user_email: targetUser.email,
          rfi_entity_id: entityId,
          permission_level: level
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['user-entity-access']);
      toast.success("Access updated");
    }
  });

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  const editCount = accessRecords.filter(r => r.permission_level === 'edit').length;
  const viewCount = accessRecords.filter(r => r.permission_level === 'view').length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
        <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm">
          {(targetUser?.full_name || targetUser?.email)?.[0]?.toUpperCase()}
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-900">{targetUser?.full_name || targetUser?.email}</p>
          <div className="flex gap-2 mt-1">
            {editCount > 0 && <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">{editCount} Edit</Badge>}
            {viewCount > 0 && <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-xs">{viewCount} View Only</Badge>}
            {editCount === 0 && viewCount === 0 && (
              <Badge variant="outline" className="text-slate-500 text-xs">No entity access</Badge>
            )}
          </div>
        </div>
      </div>

      <p className="text-xs text-slate-500">
        Set an access level for each entity. <strong>No Access</strong> means the user cannot see the entity or any of its accounts.
        Accounts inherit the same access level as their parent entity. Admins always have full access.
      </p>

      <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
        {entities.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-6">No entities found for this tenant</p>
        ) : entities.map(entity => {
          const access = accessMap[entity.id];
          const currentLevel = access?.permission_level || 'none';
          return (
            <div key={entity.id} className="flex items-center justify-between p-3 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
                  <Building2 className="w-4 h-4 text-indigo-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{entity.entity_name}</p>
                  <p className="text-xs text-slate-500">{entity.country_of_incorporation}</p>
                </div>
              </div>
              <Select
                value={currentLevel}
                onValueChange={(val) => saveMutation.mutate({ entityId: entity.id, level: val })}
                disabled={saveMutation.isPending}
              >
                <SelectTrigger className="w-36 flex-shrink-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Access</SelectItem>
                  <SelectItem value="view">View Only</SelectItem>
                  <SelectItem value="edit">Edit</SelectItem>
                </SelectContent>
              </Select>
            </div>
          );
        })}
      </div>
    </div>
  );
}