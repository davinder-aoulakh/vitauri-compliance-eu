import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function EntityClassificationWidget({ tenantId }) {
  const { data: entities = [], isLoading } = useQuery({
    queryKey: ['entity-classification-widget', tenantId],
    queryFn: () => base44.entities.Entity.filter({ tenant_id: tenantId }),
    enabled: !!tenantId,
    staleTime: 30000
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
      </div>
    );
  }

  const reportingFIs = entities.filter(e => e.rfi_status === 'reporting_fi').length;
  const nonReportingFIs = entities.filter(e => e.rfi_status === 'non_reporting_fi').length;
  const pendingClassification = entities.filter(e => e.rfi_status === 'pending_classification').length;
  const nfeActive = entities.filter(e => e.rfi_status === 'nfe_active').length;
  const nfePassive = entities.filter(e => e.rfi_status === 'nfe_passive').length;

  const cards = [
    { 
      label: 'Reporting FIs', 
      count: reportingFIs, 
      color: 'bg-green-500',
      bgColor: 'bg-white',
      description: 'Active reporting entities',
      url: createPageUrl("Entities") + "?status=reporting_fi"
    },
    { 
      label: 'Non-Reporting FIs', 
      count: nonReportingFIs, 
      color: 'bg-slate-400',
      bgColor: 'bg-white',
      description: 'Exempt from reporting',
      url: createPageUrl("Entities") + "?status=non_reporting_fi"
    },
    { 
      label: 'Pending Classification', 
      count: pendingClassification, 
      color: 'bg-amber-500',
      bgColor: 'bg-white',
      description: 'Awaiting determination',
      url: createPageUrl("Entities") + "?status=pending_classification"
    }
  ];

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-slate-900">Entity Classification Status</h3>
        <p className="text-sm text-slate-500">Overview of your legal entities and their CRS status</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {cards.map((card) => (
          <Link key={card.label} to={card.url} className="no-underline">
            <div className={`${card.bgColor} rounded-xl border p-5 hover:shadow-lg transition-all cursor-pointer`}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-slate-600">{card.label}</span>
                <div className={`w-2.5 h-2.5 rounded-full ${card.color}`} />
              </div>
              <p className="text-3xl font-bold text-slate-900 mb-1">{card.count}</p>
              <p className="text-xs text-slate-500">{card.description}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}