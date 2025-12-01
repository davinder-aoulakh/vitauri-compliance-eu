import { useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Hook for managing real-time widget data refresh
 * Uses polling with configurable intervals per widget
 */
export function useWidgetRefresh({ 
  widgetId, 
  tenantId, 
  refreshInterval = 30000, // Default 30 seconds
  enabled = true,
  queryKeys = []
}) {
  const queryClient = useQueryClient();
  const intervalRef = useRef(null);

  const refreshData = useCallback(() => {
    if (!enabled || queryKeys.length === 0) return;
    
    // Invalidate all related queries to trigger refetch
    queryKeys.forEach(key => {
      queryClient.invalidateQueries({ queryKey: key });
    });
  }, [queryClient, queryKeys, enabled]);

  useEffect(() => {
    if (!enabled || refreshInterval <= 0) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Set up polling interval
    intervalRef.current = setInterval(refreshData, refreshInterval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [refreshInterval, enabled, refreshData]);

  return { refreshData };
}

/**
 * Get query keys for a specific widget type
 */
export function getWidgetQueryKeys(widgetType, tenantId) {
  const baseKeys = {
    stats_card: [
      ['widget-accounts', tenantId],
      ['widget-entities', tenantId],
      ['widget-reports', tenantId]
    ],
    chart_bar: [
      ['widget-accounts', tenantId],
      ['widget-entities', tenantId]
    ],
    chart_pie: [
      ['widget-accounts', tenantId],
      ['widget-entities', tenantId]
    ],
    chart_line: [
      ['widget-accounts', tenantId],
      ['widget-entities', tenantId]
    ],
    recent_activity: [
      ['widget-audit-logs', tenantId]
    ],
    entity_list: [
      ['widget-entities', tenantId]
    ],
    account_list: [
      ['widget-accounts', tenantId]
    ],
    compliance_summary: [
      ['widget-accounts', tenantId],
      ['widget-entities', tenantId]
    ],
    reportability_breakdown: [
      ['widget-accounts', tenantId]
    ],
    pending_tasks: [
      ['widget-accounts', tenantId],
      ['widget-entities', tenantId]
    ],
    quick_actions: [],
    jurisdiction_overview: [
      ['tenant-data', tenantId],
      ['reporting-entities', tenantId]
    ],
    entity_classification: [
      ['widget-entities', tenantId]
    ]
  };

  return baseKeys[widgetType] || [];
}

/**
 * Default refresh intervals by widget type (in milliseconds)
 */
export const DEFAULT_REFRESH_INTERVALS = {
  stats_card: 30000,        // 30 seconds
  chart_bar: 60000,         // 1 minute
  chart_pie: 60000,         // 1 minute
  chart_line: 60000,        // 1 minute
  recent_activity: 15000,   // 15 seconds - more frequent for activity
  entity_list: 30000,       // 30 seconds
  account_list: 30000,      // 30 seconds
  compliance_summary: 60000, // 1 minute
  reportability_breakdown: 60000, // 1 minute
  pending_tasks: 20000,     // 20 seconds - important for tasks
  quick_actions: 0,         // No refresh needed
  jurisdiction_overview: 120000, // 2 minutes - less frequent
  entity_classification: 60000   // 1 minute
};

/**
 * Refresh interval options for widget configuration
 */
export const REFRESH_INTERVAL_OPTIONS = [
  { value: 0, label: 'Disabled' },
  { value: 10000, label: '10 seconds' },
  { value: 15000, label: '15 seconds' },
  { value: 30000, label: '30 seconds' },
  { value: 60000, label: '1 minute' },
  { value: 120000, label: '2 minutes' },
  { value: 300000, label: '5 minutes' }
];