import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Mail,
  Bell,
  AlertTriangle,
  Clock,
  FileText,
  Users,
  Building2,
  Calendar,
  Shield,
  CheckCircle,
  Info
} from "lucide-react";

const EMAIL_NOTIFICATION_EVENTS = [
  {
    category: "Compliance Alerts",
    icon: AlertTriangle,
    color: "text-red-600",
    bgColor: "bg-red-50",
    events: [
      {
        id: "compliance_deadline_approaching",
        name: "Deadline Approaching",
        description: "Notify when a reporting deadline is approaching",
        defaultEnabled: true,
        critical: true,
        timing: ["7_days", "3_days", "1_day"],
        defaultTiming: "3_days"
      },
      {
        id: "compliance_issue_detected",
        name: "Compliance Issue Detected",
        description: "Notify when a compliance issue is identified",
        defaultEnabled: true,
        critical: true
      },
      {
        id: "missing_documentation",
        name: "Missing Documentation",
        description: "Notify when required documents are missing",
        defaultEnabled: true,
        critical: false
      }
    ]
  },
  {
    category: "Task Notifications",
    icon: Clock,
    color: "text-amber-600",
    bgColor: "bg-amber-50",
    events: [
      {
        id: "new_pending_tasks",
        name: "New Pending Tasks",
        description: "Daily digest of new tasks requiring attention",
        defaultEnabled: true,
        critical: false,
        frequency: ["immediate", "daily_digest", "weekly_digest"],
        defaultFrequency: "daily_digest"
      },
      {
        id: "task_overdue",
        name: "Task Overdue",
        description: "Notify when a task becomes overdue",
        defaultEnabled: true,
        critical: true
      },
      {
        id: "accounts_pending_review",
        name: "Accounts Pending Review",
        description: "Notify when accounts need classification review",
        defaultEnabled: true,
        critical: false,
        threshold: true,
        defaultThreshold: 5
      }
    ]
  },
  {
    category: "Report Updates",
    icon: FileText,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    events: [
      {
        id: "report_generated",
        name: "Report Generated",
        description: "Notify when a CRS report is generated",
        defaultEnabled: true,
        critical: false
      },
      {
        id: "report_submitted",
        name: "Report Submitted",
        description: "Notify when a report is submitted to authorities",
        defaultEnabled: true,
        critical: true
      },
      {
        id: "report_status_change",
        name: "Report Status Change",
        description: "Notify when report status changes (accepted/rejected)",
        defaultEnabled: true,
        critical: true
      }
    ]
  },
  {
    category: "Entity & Account Changes",
    icon: Building2,
    color: "text-purple-600",
    bgColor: "bg-purple-50",
    events: [
      {
        id: "entity_classification_changed",
        name: "Entity Classification Changed",
        description: "Notify when an entity's RFI status changes",
        defaultEnabled: false,
        critical: false
      },
      {
        id: "account_reportability_changed",
        name: "Account Reportability Changed",
        description: "Notify when an account's reportability status changes",
        defaultEnabled: false,
        critical: false
      },
      {
        id: "bulk_import_completed",
        name: "Bulk Import Completed",
        description: "Notify when a bulk import operation completes",
        defaultEnabled: true,
        critical: false
      }
    ]
  },
  {
    category: "User & Security",
    icon: Shield,
    color: "text-green-600",
    bgColor: "bg-green-50",
    events: [
      {
        id: "new_user_invited",
        name: "New User Invited",
        description: "Notify when a new user is invited to the tenant",
        defaultEnabled: true,
        critical: false
      },
      {
        id: "user_role_changed",
        name: "User Role Changed",
        description: "Notify when a user's role or permissions change",
        defaultEnabled: true,
        critical: true
      },
      {
        id: "security_alert",
        name: "Security Alert",
        description: "Notify on suspicious login attempts or security events",
        defaultEnabled: true,
        critical: true
      }
    ]
  }
];

export default function EmailNotificationConfig({ 
  config = {}, 
  onChange,
  userRole = "tenant_user"
}) {
  const [expandedCategories, setExpandedCategories] = useState(["Compliance Alerts"]);

  const isAdmin = userRole === "tenant_admin" || userRole === "super_admin";

  const getEventConfig = (eventId) => {
    return config[eventId] || {};
  };

  const updateEventConfig = (eventId, key, value) => {
    const newConfig = {
      ...config,
      [eventId]: {
        ...getEventConfig(eventId),
        [key]: value
      }
    };
    onChange(newConfig);
  };

  const isEventEnabled = (event) => {
    const eventConfig = getEventConfig(event.id);
    return eventConfig.enabled !== undefined ? eventConfig.enabled : event.defaultEnabled;
  };

  const getEventTiming = (event) => {
    const eventConfig = getEventConfig(event.id);
    return eventConfig.timing || event.defaultTiming;
  };

  const getEventFrequency = (event) => {
    const eventConfig = getEventConfig(event.id);
    return eventConfig.frequency || event.defaultFrequency;
  };

  const getEventThreshold = (event) => {
    const eventConfig = getEventConfig(event.id);
    return eventConfig.threshold || event.defaultThreshold;
  };

  return (
    <div className="space-y-4">
      {/* Info Banner */}
      <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <Info className="w-5 h-5 text-blue-600 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-blue-900">Email Notification Settings</p>
          <p className="text-xs text-blue-700 mt-1">
            Configure which events trigger email notifications. Critical events are marked with a badge and are recommended to keep enabled.
          </p>
        </div>
      </div>

      {/* Event Categories */}
      <Accordion 
        type="multiple" 
        value={expandedCategories}
        onValueChange={setExpandedCategories}
        className="space-y-3"
      >
        {EMAIL_NOTIFICATION_EVENTS.map((category) => {
          const CategoryIcon = category.icon;
          const enabledCount = category.events.filter(e => isEventEnabled(e)).length;
          
          return (
            <AccordionItem 
              key={category.category} 
              value={category.category}
              className="border rounded-lg overflow-hidden"
            >
              <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-slate-50">
                <div className="flex items-center gap-3 flex-1">
                  <div className={`p-2 rounded-lg ${category.bgColor}`}>
                    <CategoryIcon className={`w-4 h-4 ${category.color}`} />
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-slate-900">{category.category}</p>
                    <p className="text-xs text-slate-500">
                      {enabledCount} of {category.events.length} enabled
                    </p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <div className="space-y-3 pt-2">
                  {category.events.map((event) => (
                    <div 
                      key={event.id}
                      className="p-3 bg-slate-50 rounded-lg border border-slate-200"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-slate-900 text-sm">{event.name}</p>
                            {event.critical && (
                              <Badge className="bg-red-100 text-red-700 text-[10px] px-1.5 py-0">
                                Critical
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-slate-600 mt-1">{event.description}</p>
                        </div>
                        <Switch
                          checked={isEventEnabled(event)}
                          onCheckedChange={(checked) => updateEventConfig(event.id, 'enabled', checked)}
                          disabled={!isAdmin && event.critical}
                        />
                      </div>

                      {/* Additional Options */}
                      {isEventEnabled(event) && (
                        <div className="mt-3 pt-3 border-t border-slate-200 space-y-3">
                          {/* Timing Options */}
                          {event.timing && (
                            <div className="flex items-center gap-3">
                              <Label className="text-xs text-slate-600 min-w-[80px]">Notify</Label>
                              <Select 
                                value={getEventTiming(event)}
                                onValueChange={(value) => updateEventConfig(event.id, 'timing', value)}
                              >
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="7_days">7 days before</SelectItem>
                                  <SelectItem value="3_days">3 days before</SelectItem>
                                  <SelectItem value="1_day">1 day before</SelectItem>
                                  <SelectItem value="same_day">Same day</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          )}

                          {/* Frequency Options */}
                          {event.frequency && (
                            <div className="flex items-center gap-3">
                              <Label className="text-xs text-slate-600 min-w-[80px]">Frequency</Label>
                              <Select 
                                value={getEventFrequency(event)}
                                onValueChange={(value) => updateEventConfig(event.id, 'frequency', value)}
                              >
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="immediate">Immediate</SelectItem>
                                  <SelectItem value="daily_digest">Daily Digest</SelectItem>
                                  <SelectItem value="weekly_digest">Weekly Digest</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          )}

                          {/* Threshold Options */}
                          {event.threshold && (
                            <div className="flex items-center gap-3">
                              <Label className="text-xs text-slate-600 min-w-[80px]">Threshold</Label>
                              <div className="flex items-center gap-2">
                                <Input
                                  type="number"
                                  min="1"
                                  max="100"
                                  value={getEventThreshold(event)}
                                  onChange={(e) => updateEventConfig(event.id, 'threshold', parseInt(e.target.value) || 1)}
                                  className="h-8 w-20 text-xs"
                                />
                                <span className="text-xs text-slate-500">or more items</span>
                              </div>
                            </div>
                          )}

                          {/* Recipients for Admin */}
                          {isAdmin && (
                            <div className="flex items-center gap-3">
                              <Label className="text-xs text-slate-600 min-w-[80px]">Recipients</Label>
                              <Select 
                                value={getEventConfig(event.id).recipients || 'admins_only'}
                                onValueChange={(value) => updateEventConfig(event.id, 'recipients', value)}
                              >
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="admins_only">Admins Only</SelectItem>
                                  <SelectItem value="all_users">All Users</SelectItem>
                                  <SelectItem value="custom">Custom List</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>

      {/* Email Preview */}
      <Card className="border-dashed">
        <CardHeader className="py-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Mail className="w-4 h-4" />
            Email Preview
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="bg-white border rounded-lg p-4 text-xs space-y-2">
            <div className="flex items-center gap-2 text-slate-500">
              <span className="font-medium">From:</span>
              <span>CRS Platform &lt;notifications@crsplatform.com&gt;</span>
            </div>
            <div className="flex items-center gap-2 text-slate-500">
              <span className="font-medium">Subject:</span>
              <span>[Action Required] 3 accounts pending review</span>
            </div>
            <div className="border-t pt-3 mt-3">
              <p className="text-slate-700">Hi [User Name],</p>
              <p className="text-slate-600 mt-2">
                You have <strong>3 accounts</strong> pending classification review in CRS Platform.
              </p>
              <div className="mt-3 p-2 bg-amber-50 rounded border border-amber-200">
                <p className="text-amber-800 font-medium">Pending Items:</p>
                <ul className="mt-1 text-amber-700 list-disc list-inside">
                  <li>Account #12345 - John Smith</li>
                  <li>Account #12346 - Jane Doe</li>
                  <li>Account #12347 - Corp ABC</li>
                </ul>
              </div>
              <div className="mt-3">
                <span className="inline-block px-3 py-1.5 bg-indigo-600 text-white rounded text-xs font-medium">
                  Review Accounts →
                </span>
              </div>
              <p className="text-slate-500 mt-4 text-[10px]">
                You're receiving this because you have email notifications enabled. 
                <span className="text-indigo-600 underline ml-1">Manage preferences</span>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}