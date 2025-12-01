import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Globe, Calendar, ArrowRight, Loader2 } from 'lucide-react';

export default function JurisdictionOverviewWidget({ tenantId }) {
  const { data: tenant, isLoading: isLoadingTenant } = useQuery({
    queryKey: ['tenant-data', tenantId],
    queryFn: async () => {
      if (!tenantId) return null;
      const tenants = await base44.entities.Tenant.filter({ id: tenantId });
      return tenants[0];
    },
    enabled: !!tenantId,
  });

  const { data: entities = [], isLoading: isLoadingEntities } = useQuery({
    queryKey: ['reporting-entities', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      return base44.entities.Entity.filter({ tenant_id: tenantId });
    },
    enabled: !!tenantId,
  });

  const reportingEntitiesCount = entities.filter(e => e.rfi_status === 'reporting_fi').length;
  const totalEntities = entities.length;

  const nextDeadlineDate = new Date('2026-05-31');
  const formattedDeadline = nextDeadlineDate.toLocaleDateString('en-US', { 
    month: 'long', 
    day: 'numeric', 
    year: 'numeric' 
  });

  if (isLoadingTenant || isLoadingEntities) {
    return (
      <div className="flex items-center justify-center h-full min-h-[200px]">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Globe className="w-5 h-5 text-indigo-600" />
        <span className="text-base font-semibold text-slate-900">Jurisdiction Overview</span>
      </div>

      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <span className="text-sm text-slate-600">Home Jurisdiction</span>
          <Badge variant="outline" className="font-medium">{tenant?.jurisdiction || 'N/A'}</Badge>
        </div>
        
        <div className="space-y-1">
          <span className="text-xs text-slate-500">Tenant ID</span>
          <div className="bg-slate-50 rounded-lg px-3 py-2">
            <code className="text-xs text-slate-600 break-all">{tenantId || 'N/A'}</code>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-sm text-slate-600">Reporting Entities</span>
          <span className="text-xl font-bold text-indigo-600">{reportingEntitiesCount}</span>
        </div>
        <Progress 
          value={totalEntities > 0 ? (reportingEntitiesCount / totalEntities) * 100 : 0} 
          className="h-2 bg-slate-200" 
        />
      </div>

      <div className="space-y-1">
        <div className="flex justify-between items-center">
          <span className="text-sm text-slate-600">Next Deadline</span>
          <div className="flex items-center gap-1.5 text-slate-900 font-medium">
            <Calendar className="w-4 h-4 text-slate-500" />
            <span className="text-sm">{formattedDeadline}</span>
          </div>
        </div>
        <p className="text-xs text-slate-500">CRS Annual Report</p>
      </div>

      <Link to={createPageUrl("Entities")}>
        <Button variant="outline" className="w-full mt-2">
          View All Entities
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </Link>
    </div>
  );
}