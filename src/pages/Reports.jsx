import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  FileText,
  Plus,
  Download,
  Eye,
  MoreVertical,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Trash2,
  FileCode,
  Send,
  Edit,
  History
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ReportWizard from "../components/reports/ReportWizard";
import XMLGenerator from "../components/reports/XMLGenerator";
import ReportDetails from "../components/reports/ReportDetails";
import SubmissionTracker from "../components/reports/SubmissionTracker";
import ReportCorrectionWizard from "../components/reports/ReportCorrectionWizard";
import ReportVersionHistory from "../components/reports/ReportVersionHistory";
import ReportExportDialog from "../components/reports/ReportExportDialog";
import GuidedTour from "../components/tours/GuidedTour";
import { getTourByPage } from "../components/tours/tourDefinitions";
import { PlayCircle } from "lucide-react";

export default function ReportsPage() {
  const [user, setUser] = useState(null);
  const [tenant, setTenant] = useState(null);
  const [showWizard, setShowWizard] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showXMLGenerator, setShowXMLGenerator] = useState(false);
  const [showSubmissionTracker, setShowSubmissionTracker] = useState(false);
  const [showCorrectionWizard, setShowCorrectionWizard] = useState(false);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [correctionType, setCorrectionType] = useState("correction");
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showTour, setShowTour] = useState(false);
  const [yearFilter, setYearFilter] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('year') || null;
  });

  const tourConfig = getTourByPage("Reports");

  const queryClient = useQueryClient();

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      
      if (currentUser.tenant_id) {
        const tenants = await base44.entities.Tenant.list();
        const userTenant = tenants.find(t => t.id === currentUser.tenant_id);
        setTenant(userTenant);
      }
    } catch (error) {
      console.error("Error loading user:", error);
    }
  };

  const isAdmin = user?.app_role === 'tenant_admin' || user?.app_role === 'super_admin';

  const { data: userEntityAccess = [] } = useQuery({
    queryKey: ['user-entity-access', user?.id],
    queryFn: () => base44.entities.UserEntityAccess.filter({ user_id: user.id, tenant_id: user.tenant_id }),
    enabled: !!user?.id && !isAdmin
  });

  const accessibleEntityIds = isAdmin ? null : new Set(userEntityAccess.map(r => r.rfi_entity_id));

  const { data: allReports = [], isLoading } = useQuery({
    queryKey: ['crs-reports', user?.tenant_id],
    queryFn: () => user?.tenant_id 
      ? base44.entities.CRSReport.filter({ tenant_id: user.tenant_id })
      : [],
    enabled: !!user?.tenant_id
  });

  const reports = isAdmin ? allReports : allReports.filter(r => accessibleEntityIds?.has(r.entity_id));

  const { data: allEntities = [] } = useQuery({
    queryKey: ['entities', user?.tenant_id],
    queryFn: () => user?.tenant_id 
      ? base44.entities.Entity.filter({ tenant_id: user.tenant_id })
      : [],
    enabled: !!user?.tenant_id
  });

  const entities = isAdmin ? allEntities : allEntities.filter(e => accessibleEntityIds?.has(e.id));

  const { data: allAccounts = [] } = useQuery({
    queryKey: ['all-accounts', user?.tenant_id],
    queryFn: () => user?.tenant_id 
      ? base44.entities.Account.filter({ tenant_id: user.tenant_id })
      : [],
    enabled: !!user?.tenant_id
  });

  const { data: allControllingPersons = [] } = useQuery({
    queryKey: ['all-controlling-persons', user?.tenant_id],
    queryFn: () => user?.tenant_id 
      ? base44.entities.ControllingPerson.filter({ tenant_id: user.tenant_id })
      : [],
    enabled: !!user?.tenant_id
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.CRSReport.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['crs-reports']);
    }
  });

  const handleDelete = async (id) => {
    if (confirm("Are you sure you want to delete this report? This action cannot be undone.")) {
      deleteMutation.mutate(id);
    }
  };

  const handleViewDetails = (report) => {
    setSelectedReport(report);
    setShowDetails(true);
  };

  const handleGenerateXML = (report) => {
    setSelectedReport(report);
    setShowXMLGenerator(true);
  };

  const handleManageSubmission = (report) => {
    setSelectedReport(report);
    setShowSubmissionTracker(true);
  };

  const handleCreateCorrection = (report) => {
    setSelectedReport(report);
    setCorrectionType("correction");
    setShowCorrectionWizard(true);
  };

  const handleCreateDeletion = (report) => {
    setSelectedReport(report);
    setCorrectionType("deletion");
    setShowCorrectionWizard(true);
  };

  const handleViewVersionHistory = (report) => {
    setSelectedReport(report);
    setShowVersionHistory(true);
  };

  const handleExport = (report) => {
    setSelectedReport(report);
    setShowExportDialog(true);
  };

  const handleStartTour = () => {
    // Reset tour completion for this page
    const completedTours = JSON.parse(localStorage.getItem("completedTours") || "[]");
    const filtered = completedTours.filter(t => t !== tourConfig.key);
    localStorage.setItem("completedTours", JSON.stringify(filtered));
    setShowTour(true);
  };

  const downloadXML = async (report) => {
    if (!report.xml_file_url) {
      alert("XML file not generated yet");
      return;
    }

    window.open(report.xml_file_url, '_blank');
  };

  const getStatusBadge = (status) => {
    const config = {
      draft: { label: "Draft", color: "bg-slate-100 text-slate-800 border-slate-200", icon: Clock },
      validated: { label: "Validated", color: "bg-blue-100 text-blue-800 border-blue-200", icon: CheckCircle2 },
      submitted: { label: "Submitted", color: "bg-green-100 text-green-800 border-green-200", icon: Send },
      accepted: { label: "Accepted", color: "bg-green-100 text-green-800 border-green-200", icon: CheckCircle2 },
      rejected: { label: "Rejected", color: "bg-red-100 text-red-800 border-red-200", icon: AlertTriangle }
    };
    const { label, color, icon: Icon } = config[status] || config.draft;
    return (
      <Badge variant="outline" className={`${color} border`}>
        <Icon className="w-3 h-3 mr-1" />
        {label}
      </Badge>
    );
  };

  const primaryColor = tenant?.branding?.primary_color || "#464feb";

  // Sort reports by reporting year desc and apply year filter
  const sortedReports = [...reports]
    .filter(r => !yearFilter || r.reporting_year === yearFilter)
    .sort((a, b) => 
      parseInt(b.reporting_year) - parseInt(a.reporting_year)
    );

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-slate-50">
      <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">CRS Reports</h1>
            <p className="text-slate-600">
              Generate and manage CRS XML reports for tax authority submission
            </p>
          </div>
        <div className="flex gap-2">
          <Button 
            variant="outline"
            onClick={handleStartTour}
            className="gap-2"
          >
            <PlayCircle className="w-4 h-4" />
            Page Tour
          </Button>
          <Button 
            onClick={() => setShowWizard(true)}
            className="gap-2 text-white shadow-lg"
            style={{ background: `linear-gradient(135deg, ${primaryColor} 0%, ${primaryColor}dd 100%)` }}
          >
            <Plus className="w-4 h-4" />
            Create New Report
          </Button>
        </div>
      </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="border-0 shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-600">Total Reports</p>
                  <p className="text-2xl font-bold text-slate-900">{reports.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-slate-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-600">Draft</p>
                  <p className="text-2xl font-bold text-slate-900">
                    {reports.filter(r => r.status === 'draft').length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-600">Validated</p>
                  <p className="text-2xl font-bold text-slate-900">
                    {reports.filter(r => r.status === 'validated').length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                  <Send className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-600">Submitted</p>
                  <p className="text-2xl font-bold text-slate-900">
                    {reports.filter(r => ['submitted', 'accepted'].includes(r.status)).length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Reports Table */}
        <Card className="border-0 shadow-lg">
          <CardHeader className="border-b bg-slate-50/50">
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" style={{ color: primaryColor }} />
              CRS Reports ({reports.length})
            </CardTitle>
            <CardDescription>
              Manage your Common Reporting Standard XML reports
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
              </div>
            ) : sortedReports.length === 0 ? (
              <div className="p-12 text-center">
                <FileText className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                <h3 className="text-lg font-semibold text-slate-900 mb-2">No reports created yet</h3>
                <p className="text-slate-600 mb-6">
                  Create your first CRS report to get started
                </p>
                <Button onClick={() => setShowWizard(true)} style={{ backgroundColor: primaryColor }}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create First Report
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/50">
                      <TableHead>Reporting Year</TableHead>
                      <TableHead>Entity</TableHead>
                      <TableHead>Jurisdiction</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Accounts</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedReports.map((report) => {
                      const entity = entities.find(e => e.id === report.entity_id);
                      
                      return (
                        <TableRow key={report.id} className="hover:bg-slate-50/50">
                          <TableCell>
                            <span className="font-semibold text-slate-900">{report.reporting_year}</span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-slate-700">{entity?.entity_name || "Unknown"}</span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-slate-600">{report.reporting_jurisdiction}</span>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize">
                              {report.report_type?.replace('_', ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm font-semibold text-slate-900">
                              {report.summary_stats?.total_reportable_accounts || 0}
                            </span>
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(report.status)}
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-slate-600">
                              {new Date(report.created_date).toLocaleDateString()}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreVertical className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleViewDetails(report)}>
                                  <Eye className="w-4 h-4 mr-2" />
                                  View Details
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleExport(report)}>
                                  <Download className="w-4 h-4 mr-2" />
                                  Export Report
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleViewVersionHistory(report)}>
                                  <History className="w-4 h-4 mr-2" />
                                  Version History
                                </DropdownMenuItem>
                                
                                {report.status === 'draft' && (
                                  <DropdownMenuItem onClick={() => handleGenerateXML(report)}>
                                    <FileCode className="w-4 h-4 mr-2" />
                                    Generate XML
                                  </DropdownMenuItem>
                                )}
                                
                                {report.xml_file_url && (
                                  <>
                                    <DropdownMenuItem onClick={() => downloadXML(report)}>
                                      <Download className="w-4 h-4 mr-2" />
                                      Download XML
                                    </DropdownMenuItem>
                                    
                                    <DropdownMenuItem onClick={() => handleGenerateXML(report)}>
                                      <FileCode className="w-4 h-4 mr-2" />
                                      Regenerate XML
                                    </DropdownMenuItem>
                                  </>
                                )}
                                
                                <DropdownMenuItem onClick={() => handleManageSubmission(report)}>
                                  <Send className="w-4 h-4 mr-2" />
                                  Manage Submission
                                </DropdownMenuItem>

                                {(report.status === 'submitted' || report.status === 'accepted') && (
                                  <>
                                    <DropdownMenuItem onClick={() => handleCreateCorrection(report)}>
                                      <Edit className="w-4 h-4 mr-2" />
                                      Create Correction
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleCreateDeletion(report)}>
                                      <Trash2 className="w-4 h-4 mr-2" />
                                      Create Deletion
                                    </DropdownMenuItem>
                                  </>
                                )}
                                
                                {report.status === 'draft' && (
                                  <DropdownMenuItem 
                                    onClick={() => handleDelete(report.id)}
                                    className="text-red-600"
                                  >
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Delete
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialogs */}
      <Dialog open={showWizard} onOpenChange={setShowWizard}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create CRS Report</DialogTitle>
          </DialogHeader>
          <ReportWizard
            tenant={tenant}
            onComplete={() => {
              setShowWizard(false);
              queryClient.invalidateQueries(['crs-reports']);
            }}
            onCancel={() => setShowWizard(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Report Details</DialogTitle>
          </DialogHeader>
          <ReportDetails report={selectedReport} entity={entities.find(e => e.id === selectedReport?.entity_id)} />
        </DialogContent>
      </Dialog>

      <Dialog open={showXMLGenerator} onOpenChange={setShowXMLGenerator}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Generate & Validate XML</DialogTitle>
          </DialogHeader>
          <XMLGenerator 
            report={selectedReport}
            onSuccess={() => {
              queryClient.invalidateQueries(['crs-reports']);
              setShowXMLGenerator(false);
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={showSubmissionTracker} onOpenChange={setShowSubmissionTracker}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Submission Tracking</DialogTitle>
          </DialogHeader>
          <SubmissionTracker 
            report={selectedReport}
            onUpdate={() => {
              queryClient.invalidateQueries(['crs-reports']);
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={showCorrectionWizard} onOpenChange={setShowCorrectionWizard}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {correctionType === 'deletion' ? 'Create Deletion Report' : 'Create Correction Report'}
            </DialogTitle>
          </DialogHeader>
          <ReportCorrectionWizard 
            originalReport={selectedReport}
            entity={entities.find(e => e.id === selectedReport?.entity_id)}
            onComplete={() => {
              setShowCorrectionWizard(false);
              queryClient.invalidateQueries(['crs-reports']);
            }}
            onCancel={() => setShowCorrectionWizard(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={showVersionHistory} onOpenChange={setShowVersionHistory}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Report Version History</DialogTitle>
          </DialogHeader>
          <ReportVersionHistory report={selectedReport} />
        </DialogContent>
      </Dialog>

      <ReportExportDialog
        report={selectedReport}
        accounts={allAccounts.filter(a => 
          a.reportability_status === 'reportable' && 
          a.entity_id === selectedReport?.entity_id
        )}
        controllingPersons={allControllingPersons.filter(cp =>
          allAccounts.some(a => a.id === cp.account_id && a.entity_id === selectedReport?.entity_id)
        )}
        open={showExportDialog}
        onOpenChange={setShowExportDialog}
      />

      {showTour && tourConfig && (
        <GuidedTour
          steps={tourConfig.steps}
          tourKey={tourConfig.key}
          onComplete={() => setShowTour(false)}
          onSkip={() => setShowTour(false)}
        />
      )}
      </div>
      );
      }