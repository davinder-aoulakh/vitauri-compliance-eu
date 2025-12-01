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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
            <div>
              <Label>Trend Label (Optional)</Label>
              <Input
                value={editedWidget.config?.trendLabel || ''}
                onChange={(e) => updateConfig('trendLabel', e.target.value)}
                placeholder="e.g., +2 this month"
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
                  <SelectItem value="crs_report_due">CRS Report Due</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {editedWidget.config?.taskType === 'crs_report_due' && (
              <div>
                <Label>Report Year</Label>
                <Input
                  type="number"
                  value={editedWidget.config?.reportYear || new Date().getFullYear()}
                  onChange={(e) => updateConfig('reportYear', parseInt(e.target.value))}
                />
              </div>
            )}
          </div>
        );

      case 'jurisdiction_overview':
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
                </SelectContent>
              </Select>
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
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}