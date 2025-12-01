import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { REFRESH_INTERVAL_OPTIONS, DEFAULT_REFRESH_INTERVALS } from "./useWidgetRefresh";

export default function WidgetConfigDialog({ open, onOpenChange, widget, onSave }) {
  const [editedWidget, setEditedWidget] = useState(widget);

  useEffect(() => {
    setEditedWidget(widget);
  }, [widget]);

  if (!editedWidget) return null;

  const handleSave = () => {
    onSave(editedWidget);
  };

  const updateConfig = (key, value) => {
    setEditedWidget({
      ...editedWidget,
      config: { ...editedWidget.config, [key]: value }
    });
  };

  const renderConfigOptions = () => {
    switch (editedWidget.widget_type) {
      case 'stats_card':
        return (
          <div className="space-y-4">
            <div>
              <Label>Metric to Display</Label>
              <Select
                value={editedWidget.config?.metric || 'total_accounts'}
                onValueChange={(value) => updateConfig('metric', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="total_accounts">Total Accounts</SelectItem>
                  <SelectItem value="total_entities">Total Entities</SelectItem>
                  <SelectItem value="reportable_accounts">Reportable Accounts</SelectItem>
                  <SelectItem value="pending_review">Pending Review</SelectItem>
                  <SelectItem value="classified_entities">Classified Entities</SelectItem>
                  <SelectItem value="total_crs_reports">Total CRS Reports</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Sub-description (Optional)</Label>
              <Input
                value={editedWidget.config?.subDescription || ''}
                onChange={(e) => updateConfig('subDescription', e.target.value)}
                placeholder="e.g., 3 Reporting FIs"
              />
            </div>
            <div className="space-y-3 p-3 bg-slate-50 rounded-lg">
              <Label className="font-semibold">Trend Indicator</Label>
              <div className="flex items-center gap-3">
                <Switch
                  checked={editedWidget.config?.showTrend || false}
                  onCheckedChange={(checked) => updateConfig('showTrend', checked)}
                />
                <span className="text-sm text-slate-600">Show trend indicator</span>
              </div>
              {editedWidget.config?.showTrend && (
                <>
                  <div>
                    <Label>Trend Direction</Label>
                    <Select
                      value={editedWidget.config?.trendDirection || 'up'}
                      onValueChange={(value) => updateConfig('trendDirection', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="up">Up (Positive)</SelectItem>
                        <SelectItem value="down">Down (Negative)</SelectItem>
                        <SelectItem value="neutral">Neutral</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Trend Value</Label>
                    <Input
                      value={editedWidget.config?.trendValue || ''}
                      onChange={(e) => updateConfig('trendValue', e.target.value)}
                      placeholder="e.g., +12% or +5"
                    />
                  </div>
                </>
              )}
            </div>
            <div>
              <Label>Trend Label (Optional)</Label>
              <Input
                value={editedWidget.config?.trendLabel || ''}
                onChange={(e) => updateConfig('trendLabel', e.target.value)}
                placeholder="e.g., vs last month"
              />
            </div>
          </div>
        );

      case 'pending_tasks':
        return (
          <div className="space-y-4">
            <div>
              <Label>Task Type</Label>
              <Select
                value={editedWidget.config?.taskType || 'all'}
                onValueChange={(value) => updateConfig('taskType', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Pending Tasks</SelectItem>
                  <SelectItem value="accounts_pending_classification">Accounts Pending Classification</SelectItem>
                  <SelectItem value="entities_pending_classification">Entities Pending Classification</SelectItem>
                  <SelectItem value="crs_report_due">CRS Report Due</SelectItem>
                  <SelectItem value="self_certification_missing">Self-Certification Missing</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {editedWidget.config?.taskType === 'crs_report_due' && (
              <>
                <div>
                  <Label>Report Year</Label>
                  <Input
                    type="number"
                    value={editedWidget.config?.reportYear || new Date().getFullYear()}
                    onChange={(e) => updateConfig('reportYear', parseInt(e.target.value))}
                  />
                </div>
                <div>
                  <Label>Due Date</Label>
                  <Input
                    type="date"
                    value={editedWidget.config?.dueDate || ''}
                    onChange={(e) => updateConfig('dueDate', e.target.value)}
                  />
                </div>
                <div>
                  <Label>Description (Optional)</Label>
                  <Input
                    value={editedWidget.config?.taskDescription || ''}
                    onChange={(e) => updateConfig('taskDescription', e.target.value)}
                    placeholder="e.g., Annual reporting deadline approaching"
                  />
                </div>
              </>
            )}
            {editedWidget.config?.taskType === 'accounts_pending_classification' && (
              <div>
                <Label>Custom Message (Optional)</Label>
                <Input
                  value={editedWidget.config?.taskDescription || ''}
                  onChange={(e) => updateConfig('taskDescription', e.target.value)}
                  placeholder="e.g., accounts need reportability review"
                />
              </div>
            )}
          </div>
        );

      case 'compliance_summary':
        return (
          <div className="space-y-4">
            <div>
              <Label>Metric Type</Label>
              <Select
                value={editedWidget.config?.metricType || 'entity_classification'}
                onValueChange={(value) => updateConfig('metricType', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="entity_classification">Entity Classification</SelectItem>
                  <SelectItem value="account_review">Account Review</SelectItem>
                  <SelectItem value="overall">Overall Compliance</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Display Style</Label>
              <Select
                value={editedWidget.config?.displayStyle || 'auto'}
                onValueChange={(value) => updateConfig('displayStyle', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto (based on width)</SelectItem>
                  <SelectItem value="compact">Compact (percentage only)</SelectItem>
                  <SelectItem value="detailed">Detailed (with breakdown)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        );

      case 'jurisdiction_overview':
        return (
          <div className="space-y-4">
            <div>
              <Label>Next Deadline Date</Label>
              <Input
                type="date"
                value={editedWidget.config?.deadlineDate || ''}
                onChange={(e) => updateConfig('deadlineDate', e.target.value)}
              />
            </div>
            <div>
              <Label>Deadline Description</Label>
              <Input
                value={editedWidget.config?.deadlineDescription || ''}
                onChange={(e) => updateConfig('deadlineDescription', e.target.value)}
                placeholder="e.g., CRS Annual Filing Deadline"
              />
            </div>
            <div>
              <Label>Show Reporting Entities Count</Label>
              <div className="flex items-center gap-3 mt-2">
                <Switch
                  checked={editedWidget.config?.showReportingCount !== false}
                  onCheckedChange={(checked) => updateConfig('showReportingCount', checked)}
                />
                <span className="text-sm text-slate-600">Display reporting FI count</span>
              </div>
            </div>
          </div>
        );

      case 'entity_classification':
        return (
          <p className="text-sm text-slate-500">This widget automatically displays data from your tenant configuration.</p>
        );

      case 'chart_pie':
      case 'chart_bar':
        return (
          <div className="space-y-4">
            <div>
              <Label>Data Source</Label>
              <Select
                value={editedWidget.config?.data_source || 'reportability'}
                onValueChange={(value) => updateConfig('data_source', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="reportability">Account Reportability</SelectItem>
                  <SelectItem value="entity_classification">Entity Classification</SelectItem>
                  <SelectItem value="account_types">Account Types</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        );

      case 'recent_activity':
        return (
          <div className="space-y-4">
            <div>
              <Label>Number of Items</Label>
              <Select
                value={String(editedWidget.config?.limit || 5)}
                onValueChange={(value) => updateConfig('limit', parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">3 items</SelectItem>
                  <SelectItem value="5">5 items</SelectItem>
                  <SelectItem value="10">10 items</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        );

      case 'entity_list':
        return (
          <div className="space-y-4">
            <div>
              <Label>Number of Items</Label>
              <Select
                value={String(editedWidget.config?.limit || 5)}
                onValueChange={(value) => updateConfig('limit', parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">3 items</SelectItem>
                  <SelectItem value="5">5 items</SelectItem>
                  <SelectItem value="10">10 items</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Filter by Status</Label>
              <Select
                value={editedWidget.config?.filter_status || 'all'}
                onValueChange={(value) => updateConfig('filter_status', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="reporting_fi">Reporting FI</SelectItem>
                  <SelectItem value="non_reporting_fi">Non-Reporting FI</SelectItem>
                  <SelectItem value="pending_classification">Pending Classification</SelectItem>
                  <SelectItem value="nfe_active">Active NFE</SelectItem>
                  <SelectItem value="nfe_passive">Passive NFE</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Sort By</Label>
              <Select
                value={editedWidget.config?.sortBy || 'created_date'}
                onValueChange={(value) => updateConfig('sortBy', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="created_date">Date Created (Newest)</SelectItem>
                  <SelectItem value="-created_date">Date Created (Oldest)</SelectItem>
                  <SelectItem value="entity_name">Name (A-Z)</SelectItem>
                  <SelectItem value="-entity_name">Name (Z-A)</SelectItem>
                  <SelectItem value="updated_date">Recently Updated</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        );

      case 'account_list':
        return (
          <div className="space-y-4">
            <div>
              <Label>Number of Items</Label>
              <Select
                value={String(editedWidget.config?.limit || 5)}
                onValueChange={(value) => updateConfig('limit', parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">3 items</SelectItem>
                  <SelectItem value="5">5 items</SelectItem>
                  <SelectItem value="10">10 items</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Filter by Status</Label>
              <Select
                value={editedWidget.config?.filter_status || 'all'}
                onValueChange={(value) => updateConfig('filter_status', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="reportable">Reportable Only</SelectItem>
                  <SelectItem value="non_reportable">Non-Reportable Only</SelectItem>
                  <SelectItem value="pending_review">Pending Review</SelectItem>
                  <SelectItem value="excluded">Excluded</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Sort By</Label>
              <Select
                value={editedWidget.config?.sortBy || 'created_date'}
                onValueChange={(value) => updateConfig('sortBy', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="created_date">Date Created (Newest)</SelectItem>
                  <SelectItem value="-created_date">Date Created (Oldest)</SelectItem>
                  <SelectItem value="account_holder_name">Name (A-Z)</SelectItem>
                  <SelectItem value="-account_holder_name">Name (Z-A)</SelectItem>
                  <SelectItem value="year_end_cash_value">Balance (Highest)</SelectItem>
                  <SelectItem value="-year_end_cash_value">Balance (Lowest)</SelectItem>
                  <SelectItem value="updated_date">Recently Updated</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        );

      case 'chart_line':
        return (
          <div className="space-y-4">
            <div>
              <Label>Data Source</Label>
              <Select
                value={editedWidget.config?.data_source || 'accounts_over_time'}
                onValueChange={(value) => updateConfig('data_source', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="accounts_over_time">Accounts Created Over Time</SelectItem>
                  <SelectItem value="entities_over_time">Entities Created Over Time</SelectItem>
                  <SelectItem value="reportable_trend">Reportable Accounts Trend</SelectItem>
                  <SelectItem value="classification_progress">Classification Progress</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Time Range</Label>
              <Select
                value={editedWidget.config?.timeRange || '6months'}
                onValueChange={(value) => updateConfig('timeRange', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7days">Last 7 Days</SelectItem>
                  <SelectItem value="30days">Last 30 Days</SelectItem>
                  <SelectItem value="3months">Last 3 Months</SelectItem>
                  <SelectItem value="6months">Last 6 Months</SelectItem>
                  <SelectItem value="1year">Last Year</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Data Aggregation</Label>
              <Select
                value={editedWidget.config?.aggregation || 'monthly'}
                onValueChange={(value) => updateConfig('aggregation', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Line Color</Label>
              <Input
                type="color"
                value={editedWidget.config?.lineColor || '#4f46e5'}
                onChange={(e) => updateConfig('lineColor', e.target.value)}
                className="w-full h-10"
              />
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={editedWidget.config?.showDataPoints !== false}
                onCheckedChange={(checked) => updateConfig('showDataPoints', checked)}
              />
              <span className="text-sm text-slate-600">Show data points</span>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={editedWidget.config?.fillArea || false}
                onCheckedChange={(checked) => updateConfig('fillArea', checked)}
              />
              <span className="text-sm text-slate-600">Fill area under line</span>
            </div>
          </div>
        );

      default:
        return (
          <p className="text-sm text-slate-500">No additional configuration needed for this widget.</p>
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Configure Widget</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Widget Title</Label>
            <Input
              value={editedWidget.title}
              onChange={(e) => setEditedWidget({ ...editedWidget, title: e.target.value })}
              placeholder="Widget title"
            />
          </div>
          
          <div>
            <Label>Width</Label>
            <Select
              value={String(editedWidget.position?.w || 6)}
              onValueChange={(value) => setEditedWidget({
                ...editedWidget,
                position: { ...editedWidget.position, w: parseInt(value) }
              })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="4">Small (4 columns)</SelectItem>
                <SelectItem value="6">Medium (6 columns)</SelectItem>
                <SelectItem value="8">Large (8 columns)</SelectItem>
                <SelectItem value="12">Full Width (12 columns)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="border-t pt-4">
            <Label className="text-base font-semibold">Widget Settings</Label>
            <div className="mt-3">
              {renderConfigOptions()}
            </div>
          </div>

          {/* Auto-Refresh Settings - Available for most widget types */}
          {editedWidget.widget_type !== 'quick_actions' && (
            <div className="border-t pt-4 space-y-4">
              <Label className="text-base font-semibold">Real-Time Updates</Label>
              
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium">Auto-Refresh</p>
                  <p className="text-xs text-slate-500">Automatically update widget data</p>
                </div>
                <Switch
                  checked={editedWidget.config?.autoRefresh !== false}
                  onCheckedChange={(checked) => updateConfig('autoRefresh', checked)}
                />
              </div>

              {editedWidget.config?.autoRefresh !== false && (
                <div>
                  <Label>Refresh Interval</Label>
                  <Select
                    value={String(editedWidget.config?.refreshInterval || DEFAULT_REFRESH_INTERVALS[editedWidget.widget_type] || 30000)}
                    onValueChange={(value) => updateConfig('refreshInterval', parseInt(value))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {REFRESH_INTERVAL_OPTIONS.filter(opt => opt.value > 0).map(opt => (
                        <SelectItem key={opt.value} value={String(opt.value)}>
                          {opt.label}
                          {opt.value === DEFAULT_REFRESH_INTERVALS[editedWidget.widget_type] && ' (default)'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-slate-500 mt-1">
                    More frequent updates use more resources
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}