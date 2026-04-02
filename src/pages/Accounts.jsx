import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Plus, 
  Wallet, 
  CheckCircle2, 
  Clock, 
  Search,
  Filter,
  MoreVertical,
  Edit,
  Trash2,
  AlertTriangle,
  FileText,
  Eye,
  History,
  Users,
  Sparkles,
  Flag,
  FileCheck,
  Brain,
  Globe,
  RefreshCw,
  Loader2,
  AlertCircle,
  HeartHandshake,
  Download
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AccountForm from "../components/accounts/AccountForm";
import AccountDetails from "../components/accounts/AccountDetails";
import AccountClassification from "../components/accounts/AccountClassification";
import AccountClassificationHistory from "../components/accounts/AccountClassificationHistory";
import ControllingPersonsList from "../components/accounts/ControllingPersonsList";
import BeneficiaryManager from "../components/accounts/BeneficiaryManager";
import AIBulkImport from "@/components/import/AIBulkImport";
import ComplianceFlags from "../components/accounts/ComplianceFlags";
import { suggestWorkflows } from "../components/workflows/WorkflowTriggerEvaluator";
import AIDataValidator from "../components/ai/AIDataValidator";
import AIJurisdictionAdvisor from "../components/ai/AIJurisdictionAdvisor";
import BulkUpdateForm from "../components/accounts/BulkUpdateForm";
import GuidedTour from "../components/tours/GuidedTour";
import { getTourByPage } from "../components/tours/tourDefinitions";
import AccountExport from "../components/accounts/AccountExport";

export default function AccountsPage() {
  const [user, setUser] = useState(null);
  const [tenant, setTenant] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showClassification, setShowClassification] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showControllingPersons, setShowControllingPersons] = useState(false);
  const [showBeneficiaries, setShowBeneficiaries] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [showComplianceFlags, setShowComplianceFlags] = useState(false);
  const [showAIValidator, setShowAIValidator] = useState(false);
  const [showJurisdictionAdvisor, setShowJurisdictionAdvisor] = useState(false);
  const [complianceIssuesCount, setComplianceIssuesCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('status') || "all";
  });
  const [entityFilter, setEntityFilter] = useState("all");
  const [classificationFilter, setClassificationFilter] = useState("all");
  const [countryFilter, setCountryFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("accounts");
  const [selectedAccountIds, setSelectedAccountIds] = useState([]);
  const [showBulkUpdate, setShowBulkUpdate] = useState(false);
  const [showBulkDelete, setShowBulkDelete] = useState(false);
  const [showTour, setShowTour] = useState(false);

  const tourConfig = getTourByPage("Accounts");
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

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ['accounts', user?.tenant_id],
    queryFn: () => user?.tenant_id 
      ? base44.entities.Account.filter({ tenant_id: user.tenant_id })
      : [],
    enabled: !!user?.tenant_id
  });

  const { data: entities = [] } = useQuery({
    queryKey: ['entities', user?.tenant_id],
    queryFn: () => user?.tenant_id 
      ? base44.entities.Entity.filter({ tenant_id: user.tenant_id })
      : [],
    enabled: !!user?.tenant_id
  });

  const { data: classificationHistory = [] } = useQuery({
    queryKey: ['account-classification-history', selectedAccount?.id],
    queryFn: () => selectedAccount?.id
      ? base44.entities.AccountClassificationHistory.filter({ account_id: selectedAccount.id })
      : [],
    enabled: !!selectedAccount?.id && showHistory
  });

  const isAdmin = user?.app_role === 'tenant_admin' || user?.app_role === 'super_admin';

  const { data: userEntityAccess = [] } = useQuery({
    queryKey: ['user-entity-access', user?.id],
    queryFn: () => base44.entities.UserEntityAccess.filter({ user_id: user.id, tenant_id: user.tenant_id }),
    enabled: !!user?.id && !isAdmin
  });

  const entityAccessMap = userEntityAccess.reduce((map, r) => {
    map[r.rfi_entity_id] = r.permission_level;
    return map;
  }, {});

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Account.create({ ...data, tenant_id: user.tenant_id }),
    onSuccess: async (newAccount) => {
      queryClient.invalidateQueries(['accounts']);
      setShowForm(false);
      setSelectedAccount(null);
      
      // Create audit log entry
      try {
        await base44.entities.AuditLog.create({
          tenant_id: user.tenant_id,
          action_type: "account_created",
          actor_email: user.email,
          actor_role: user.user_role,
          target_entity_type: "Account",
          target_entity_id: newAccount.id,
          changes: {
            account_number: newAccount.account_number,
            account_holder_name: newAccount.account_holder_name,
            account_type: newAccount.account_type
          },
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error("Error creating audit log:", error);
      }
      
      // Trigger auto-classification
      try {
        await base44.functions.invoke('autoClassifyAccount', {
          accountId: newAccount.id,
          event_type: 'created'
        });
        queryClient.invalidateQueries(['accounts']);
      } catch (error) {
        console.error('Auto-classification failed:', error);
      }
      
      // Check for workflow triggers
      const suggestedWorkflows = await suggestWorkflows(newAccount, 'account_created');
      if (suggestedWorkflows.length > 0) {
        console.log(`${suggestedWorkflows.length} workflow(s) triggered for new account:`, suggestedWorkflows);
      }
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data, skipHooks = false }) => {
      console.log(`⏱️ [MUTATION] Starting Account.update for ID: ${id} (skipHooks: ${skipHooks})`);
      const updateStart = performance.now();
      const result = await base44.entities.Account.update(id, data);
      console.log(`⏱️ [MUTATION] Account.update completed in ${Math.round(performance.now() - updateStart)}ms`);
      return { account: result, skipHooks };
    },
    onSuccess: async (response, variables) => {
      console.log('⏱️ [MUTATION] onSuccess callback started');
      const onSuccessStart = performance.now();
      const { account: updatedAccount, skipHooks } = response;
      
      queryClient.invalidateQueries(['accounts']);
      setShowForm(false);
      setShowClassification(false);
      setSelectedAccount(null);
      
      console.log(`⏱️ [MUTATION] onSuccess state updates took ${Math.round(performance.now() - onSuccessStart)}ms`);
      
      if (skipHooks) {
        console.log('⏱️ [MUTATION] ⏩ Skipping audit log, auto-classification, and workflow triggers (skipHooks=true) - FAST PATH');
        console.log(`⏱️ [MUTATION] Total onSuccess took ${Math.round(performance.now() - onSuccessStart)}ms`);
        return;
      }
      
      // Create audit log entry
      const auditLogStart = performance.now();
      try {
        await base44.entities.AuditLog.create({
          tenant_id: user.tenant_id,
          action_type: "account_updated",
          actor_email: user.email,
          actor_role: user.user_role,
          target_entity_type: "Account",
          target_entity_id: updatedAccount.id,
          changes: {
            account_number: updatedAccount.account_number,
            account_holder_name: updatedAccount.account_holder_name
          },
          timestamp: new Date().toISOString()
        });
        console.log(`⏱️ [MUTATION] Audit log created in ${Math.round(performance.now() - auditLogStart)}ms`);
      } catch (error) {
        console.error("Error creating audit log:", error);
      }
      
      // Trigger auto-classification
      const autoClassifyStart = performance.now();
      try {
        await base44.functions.invoke('autoClassifyAccount', {
          accountId: variables.id,
          event_type: 'updated'
        });
        console.log(`⏱️ [MUTATION] Auto-classification completed in ${Math.round(performance.now() - autoClassifyStart)}ms`);
        queryClient.invalidateQueries(['accounts']);
      } catch (error) {
        console.error('Auto-classification failed:', error);
        console.log(`⏱️ [MUTATION] Auto-classification failed in ${Math.round(performance.now() - autoClassifyStart)}ms`);
      }
      
      // Check for workflow triggers
      const workflowCheckStart = performance.now();
      const suggestedWorkflows = await suggestWorkflows(updatedAccount, 'account_updated');
      console.log(`⏱️ [MUTATION] Workflow trigger check completed in ${Math.round(performance.now() - workflowCheckStart)}ms`);
      if (suggestedWorkflows.length > 0) {
        console.log(`${suggestedWorkflows.length} workflow(s) triggered for updated account:`, suggestedWorkflows);
      }
      
      console.log(`⏱️ [MUTATION] Total onSuccess took ${Math.round(performance.now() - onSuccessStart)}ms`);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const accountToDelete = accounts.find(a => a.id === id);
      await base44.entities.Account.delete(id);
      return accountToDelete;
    },
    onSuccess: async (deletedAccount) => {
      queryClient.invalidateQueries(['accounts']);
      
      // Create audit log entry
      try {
        await base44.entities.AuditLog.create({
          tenant_id: user.tenant_id,
          action_type: "account_deleted",
          actor_email: user.email,
          actor_role: user.user_role,
          target_entity_type: "Account",
          target_entity_id: deletedAccount?.id,
          changes: {
            account_number: deletedAccount?.account_number,
            account_holder_name: deletedAccount?.account_holder_name
          },
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error("Error creating audit log:", error);
      }
    }
  });

  const bulkUpdateMutation = useMutation({
    mutationFn: async ({ field, value }) => {
      const updatePromises = selectedAccountIds.map(id =>
        base44.entities.Account.update(id, { [field]: value })
      );
      return await Promise.all(updatePromises);
    },
    onSuccess: async (updatedAccounts) => {
      queryClient.invalidateQueries(['accounts']);
      setShowBulkUpdate(false);
      setSelectedAccountIds([]);
      
      // Create audit log entries
      try {
        const auditPromises = updatedAccounts.map(account =>
          base44.entities.AuditLog.create({
            tenant_id: user.tenant_id,
            action_type: "account_updated",
            actor_email: user.email,
            actor_role: user.user_role,
            target_entity_type: "Account",
            target_entity_id: account.id,
            changes: { bulk_update: true },
            timestamp: new Date().toISOString()
          })
        );
        await Promise.all(auditPromises);
      } catch (error) {
        console.error("Error creating audit logs:", error);
      }
      
      alert(`Successfully updated ${updatedAccounts.length} account(s)`);
    },
    onError: (error) => {
      console.error("Bulk update error:", error);
      alert("Error updating accounts: " + error.message);
    }
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async () => {
      const deletePromises = selectedAccountIds.map(id =>
        base44.entities.Account.delete(id)
      );
      return await Promise.all(deletePromises);
    },
    onSuccess: async () => {
      queryClient.invalidateQueries(['accounts']);
      setShowBulkDelete(false);
      setSelectedAccountIds([]);
      
      // Create audit log entries
      try {
        const auditPromises = selectedAccountIds.map(id =>
          base44.entities.AuditLog.create({
            tenant_id: user.tenant_id,
            action_type: "account_deleted",
            actor_email: user.email,
            actor_role: user.user_role,
            target_entity_type: "Account",
            target_entity_id: id,
            changes: { bulk_delete: true },
            timestamp: new Date().toISOString()
          })
        );
        await Promise.all(auditPromises);
      } catch (error) {
        console.error("Error creating audit logs:", error);
      }
      
      alert(`Successfully deleted ${selectedAccountIds.length} account(s)`);
    },
    onError: (error) => {
      console.error("Bulk delete error:", error);
      alert("Error deleting accounts: " + error.message);
    }
  });

  const handleEdit = (account) => {
    setSelectedAccount(account);
    setShowForm(true);
  };

  const handleViewDetails = (account) => {
    setSelectedAccount(account);
    setShowDetails(true);
  };

  const handleClassify = (account) => {
    // Ensure we get the latest account data from the list
    const latestAccount = accounts.find(a => a.id === account.id) || account;
    setSelectedAccount(latestAccount);
    setShowClassification(true);
  };

  const handleViewHistory = (account) => {
    setSelectedAccount(account);
    setShowHistory(true);
  };

  const handleManageControllingPersons = (account) => {
    setSelectedAccount(account);
    setShowControllingPersons(true);
  };

  const handleManageBeneficiaries = (account) => {
    setSelectedAccount(account);
    setShowBeneficiaries(true);
  };

  const handleDelete = async (id) => {
    if (confirm("Are you sure you want to delete this account?")) {
      deleteMutation.mutate(id);
    }
  };

  const handleBulkUpdate = (field, value) => {
    bulkUpdateMutation.mutate({ field, value });
  };

  const handleSelectAccount = (accountId) => {
    setSelectedAccountIds(prev =>
      prev.includes(accountId)
        ? prev.filter(id => id !== accountId)
        : [...prev, accountId]
    );
  };

  const handleSelectAll = () => {
    if (selectedAccountIds.length === filteredAccounts.length) {
      setSelectedAccountIds([]);
    } else {
      setSelectedAccountIds(filteredAccounts.map(a => a.id));
    }
  };

  const handleComplianceFlagSelect = (account) => {
    setShowComplianceFlags(false);
    setActiveTab("accounts");
    
    if (account.reportability_status === 'pending_review') {
      handleClassify(account);
    } else if (account.entity_classification === 'passive_nfe') {
      handleManageControllingPersons(account);
    } else {
      handleEdit(account);
    }
  };

  const accessibleEntities = isAdmin ? entities : entities.filter(e => !!entityAccessMap[e.id]);
  const accessibleAccounts = isAdmin ? accounts : accounts.filter(a => !!entityAccessMap[a.entity_id]);

  const filteredAccounts = accessibleAccounts.filter(account => {

    const matchesSearch = account.account_holder_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         account.account_number?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || account.reportability_status === statusFilter;
    const matchesEntity = entityFilter === "all" || account.entity_id === entityFilter;
    const matchesClassification = classificationFilter === "all" || account.entity_classification === classificationFilter;
    
    const matchesCountry = countryFilter === "all" || 
      (account.tax_residencies && account.tax_residencies.some(r => r.country === countryFilter)) ||
      account.account_holder_address?.country === countryFilter;
    
    return matchesSearch && matchesStatus && matchesEntity && matchesClassification && matchesCountry;
  });

  const uniqueCountries = [...new Set(
    accessibleAccounts.flatMap(a => [
      a.account_holder_address?.country,
      ...(a.tax_residencies || []).map(r => r.country)
    ]).filter(Boolean)
  )].sort();

  const getStatusBadge = (status) => {
    const config = {
      reportable: { label: "Reportable", color: "bg-green-100 text-green-800 border-green-200" },
      non_reportable: { label: "Non-Reportable", color: "bg-slate-100 text-slate-800 border-slate-200" },
      pending_review: { label: "Pending Review", color: "bg-amber-100 text-amber-800 border-amber-200" },
      excluded: { label: "Excluded", color: "bg-red-100 text-red-800 border-red-200" }
    };
    const { label, color } = config[status] || config.pending_review;
    return <Badge variant="outline" className={`${color} border`}>{label}</Badge>;
  };

  const getStatusIcon = (status) => {
    if (status === "reportable") return <CheckCircle2 className="w-4 h-4 text-green-600" />;
    if (status === "pending_review") return <Clock className="w-4 h-4 text-amber-600" />;
    return <AlertTriangle className="w-4 h-4 text-slate-600" />;
  };

  const formatCurrency = (amount, currency = "USD") => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(amount || 0);
  };

  const primaryColor = tenant?.branding?.primary_color || "#464feb";

  const handleStartTour = () => {
    const completedTours = JSON.parse(localStorage.getItem("completedTours") || "[]");
    const filtered = completedTours.filter(t => t !== tourConfig.key);
    localStorage.setItem("completedTours", JSON.stringify(filtered));
    setShowTour(true);
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-slate-50">
      <div className="px-3 md:px-4 py-6 md:py-8 w-full space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">Accounts</h1>
            <p className="text-slate-600">
              Manage account holders and their reportability status
            </p>
          </div>
          <div className="flex gap-2">
            {selectedAccountIds.length > 0 && (
              <>
                <Button 
                  onClick={() => setShowBulkUpdate(true)}
                  variant="outline"
                  className="gap-2 border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                >
                  <RefreshCw className="w-4 h-4" />
                  Bulk Update ({selectedAccountIds.length})
                </Button>
                <Button 
                  onClick={() => setShowBulkDelete(true)}
                  variant="outline"
                  className="gap-2 border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                >
                  <Trash2 className="w-4 h-4" />
                  Bulk Delete ({selectedAccountIds.length})
                </Button>
              </>
            )}
            {(tenant?.enabled_features?.guided_tours === true) && (
            <Button 
              variant="outline"
              onClick={handleStartTour}
              className="gap-2"
            >
              <Sparkles className="w-4 h-4" />
              Page Tour
            </Button>
            )}
            {(tenant?.enabled_features?.ai_bulk_import !== false) && (
              <Button 
                onClick={() => setShowBulkImport(true)}
                variant="outline"
                className="gap-2"
              >
                <Sparkles className="w-4 h-4" />
                Bulk Import
              </Button>
            )}
            <Button 
              onClick={() => {
                setSelectedAccount(null);
                setShowForm(true);
              }}
              className="gap-2 text-white shadow-lg"
              style={{ background: `linear-gradient(135deg, ${primaryColor} 0%, ${primaryColor}dd 100%)` }}
            >
              <Plus className="w-4 h-4" />
              Add Account
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="border-b border-slate-200 bg-white rounded-t-xl shadow-sm">
            <TabsList className="flex h-auto bg-transparent p-0 gap-0 overflow-x-auto scrollbar-none w-full justify-start">
              <TabsTrigger
                value="accounts"
                className="flex items-center gap-2 px-5 py-3.5 text-sm font-medium text-slate-500 border-b-2 border-transparent rounded-none bg-transparent hover:text-slate-800 hover:bg-slate-50 data-[state=active]:text-indigo-600 data-[state=active]:border-indigo-600 data-[state=active]:bg-transparent transition-colors whitespace-nowrap"
              >
                <Wallet className="w-4 h-4" />
                Accounts
              </TabsTrigger>
              <TabsTrigger
                value="compliance"
                className="flex items-center gap-2 px-5 py-3.5 text-sm font-medium text-slate-500 border-b-2 border-transparent rounded-none bg-transparent hover:text-slate-800 hover:bg-slate-50 data-[state=active]:text-indigo-600 data-[state=active]:border-indigo-600 data-[state=active]:bg-transparent transition-colors whitespace-nowrap"
              >
                <Flag className="w-4 h-4" />
                Compliance
                {complianceIssuesCount > 0 && (
                  <span className="ml-1 inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-500 text-white text-xs font-semibold">
                    {complianceIssuesCount}
                  </span>
                )}
              </TabsTrigger>
              {(tenant?.enabled_features?.ai_data_validator !== false) && (
                <TabsTrigger
                  value="ai-validator"
                  className="flex items-center gap-2 px-5 py-3.5 text-sm font-medium text-slate-500 border-b-2 border-transparent rounded-none bg-transparent hover:text-slate-800 hover:bg-slate-50 data-[state=active]:text-indigo-600 data-[state=active]:border-indigo-600 data-[state=active]:bg-transparent transition-colors whitespace-nowrap"
                >
                  <Brain className="w-4 h-4" />
                  AI Validator
                </TabsTrigger>
              )}
              {(tenant?.enabled_features?.ai_jurisdiction_advisor !== false) && (
                <TabsTrigger
                  value="jurisdiction"
                  className="flex items-center gap-2 px-5 py-3.5 text-sm font-medium text-slate-500 border-b-2 border-transparent rounded-none bg-transparent hover:text-slate-800 hover:bg-slate-50 data-[state=active]:text-indigo-600 data-[state=active]:border-indigo-600 data-[state=active]:bg-transparent transition-colors whitespace-nowrap"
                >
                  <Globe className="w-4 h-4" />
                  CRS Advisor
                </TabsTrigger>
              )}

            </TabsList>
          </div>

          <TabsContent value="accounts" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="border-0 shadow-lg">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                      <Wallet className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-600">Total Accounts</p>
                      <p className="text-2xl font-bold text-slate-900">{accessibleAccounts.length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-lg">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-600">Reportable</p>
                      <p className="text-2xl font-bold text-slate-900">
                        {accessibleAccounts.filter(a => a.reportability_status === "reportable").length}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-lg">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                      <Clock className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-600">Pending Review</p>
                      <p className="text-2xl font-bold text-slate-900">
                        {accessibleAccounts.filter(a => a.reportability_status === "pending_review").length}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-lg">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                      <Wallet className="w-5 h-5 text-slate-600" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-600">Non-Reportable</p>
                      <p className="text-2xl font-bold text-slate-900">
                        {accessibleAccounts.filter(a => a.reportability_status === "non_reportable").length}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="border-0 shadow-lg">
              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="md:col-span-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                      <Input
                        placeholder="Search by account holder or account number..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger>
                      <Filter className="w-4 h-4 mr-2" />
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="reportable">Reportable</SelectItem>
                      <SelectItem value="non_reportable">Non-Reportable</SelectItem>
                      <SelectItem value="pending_review">Pending Review</SelectItem>
                      <SelectItem value="excluded">Excluded</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={entityFilter} onValueChange={setEntityFilter}>
                    <SelectTrigger>
                      <Filter className="w-4 h-4 mr-2" />
                      <SelectValue placeholder="Entity" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Entities</SelectItem>
                      {entities.map((entity) => (
                        <SelectItem key={entity.id} value={entity.id}>
                          {entity.entity_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex gap-4 mt-4 flex-wrap">
                  <Select value={classificationFilter} onValueChange={setClassificationFilter}>
                    <SelectTrigger className="w-full md:w-56">
                      <Filter className="w-4 h-4 mr-2" />
                      <SelectValue placeholder="Entity Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Entity Types</SelectItem>
                      <SelectItem value="financial_institution">Financial Institution</SelectItem>
                      <SelectItem value="active_nfe">Active NFE</SelectItem>
                      <SelectItem value="passive_nfe">Passive NFE</SelectItem>
                      <SelectItem value="not_applicable">Not Applicable</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={countryFilter} onValueChange={setCountryFilter}>
                    <SelectTrigger className="w-full md:w-56">
                      <Filter className="w-4 h-4 mr-2" />
                      <SelectValue placeholder="Country" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Countries</SelectItem>
                      {uniqueCountries.map((country) => (
                        <SelectItem key={country} value={country}>
                          {country}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {(searchTerm || statusFilter !== "all" || entityFilter !== "all" || classificationFilter !== "all" || countryFilter !== "all") && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSearchTerm("");
                        setStatusFilter("all");
                        setEntityFilter("all");
                        setClassificationFilter("all");
                        setCountryFilter("all");
                      }}
                    >
                      Clear Filters
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg">
              <CardHeader className="border-b bg-slate-50/50">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Wallet className="w-5 h-5" style={{ color: primaryColor }} />
                      Accounts ({filteredAccounts.length})
                    </CardTitle>
                    <CardDescription>
                      {accessibleAccounts.filter(a => a.reportability_status === "reportable").length} Reportable, {" "}
                      {accessibleAccounts.filter(a => a.reportability_status === "pending_review").length} Pending Review
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {isLoading ? (
                  <div className="p-8 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
                  </div>
                ) : filteredAccounts.length === 0 ? (
                  <div className="p-12 text-center">
                    <Wallet className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">No accounts found</h3>
                    <p className="text-slate-600 mb-6">
                      {searchTerm || statusFilter !== "all" || entityFilter !== "all" || countryFilter !== "all"
                        ? "Try adjusting your filters" 
                        : "Get started by adding your first account"}
                    </p>
                    {!searchTerm && statusFilter === "all" && entityFilter === "all" && classificationFilter === "all" && countryFilter === "all" && (
                      <Button onClick={() => setShowForm(true)} style={{ backgroundColor: primaryColor }}>
                        <Plus className="w-4 h-4 mr-2" />
                        Add First Account
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50/50">
                          <TableHead className="w-12">
                            <Checkbox
                              checked={selectedAccountIds.length === filteredAccounts.length && filteredAccounts.length > 0}
                              onCheckedChange={handleSelectAll}
                            />
                          </TableHead>
                          <TableHead>Account Holder</TableHead>
                          <TableHead>Account Number</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Balance</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>RFI Entity</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredAccounts.map((account) => {
                          const accountEntity = entities.find(e => e.id === account.entity_id);
                          const isPassiveNFE = account.entity_classification === "passive_nfe";
                          const hasDocument = !!account.self_certification_document_url;
                          
                          return (
                            <TableRow key={account.id} className="hover:bg-slate-50/50">
                              <TableCell>
                                <Checkbox
                                  checked={selectedAccountIds.includes(account.id)}
                                  onCheckedChange={() => handleSelectAccount(account.id)}
                                />
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-3">
                                  <div 
                                    className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                                    style={{ backgroundColor: `${primaryColor}15` }}
                                  >
                                    {getStatusIcon(account.reportability_status)}
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <p className="font-semibold text-slate-900">{account.account_holder_name}</p>
                                      {account.self_certification_overdue && (
                                        <Badge className="bg-red-100 text-red-800 border-red-300 text-xs">
                                          <AlertCircle className="w-3 h-3 mr-1" />
                                          Cert Overdue
                                        </Badge>
                                      )}
                                      {account.has_unclassified_controlling_persons && (
                                        <Badge className="bg-orange-100 text-orange-800 border-orange-300 text-xs">
                                          <Users className="w-3 h-3 mr-1" />
                                          Classify CPs
                                        </Badge>
                                      )}
                                      {hasDocument && (
                                        <FileCheck className="w-4 h-4 text-green-600" title="Self-certification document uploaded" />
                                      )}
                                    </div>
                                    <p className="text-xs text-slate-500 capitalize">
                                      {account.account_holder_type?.replace("_", " ")}
                                      {account.entity_classification === "active_nfe" && (
                                        <span className="ml-2 text-purple-600 font-medium">(Active NFE)</span>
                                      )}
                                      {isPassiveNFE && (
                                        <span className="ml-2 text-orange-600 font-medium">(Passive NFE)</span>
                                      )}
                                      {account.entity_classification === "financial_institution" && (
                                        <span className="ml-2 text-blue-600 font-medium">(Financial Institution)</span>
                                      )}
                                    </p>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <span className="font-mono text-sm text-slate-700">{account.account_number}</span>
                              </TableCell>
                              <TableCell>
                                <span className="text-sm capitalize text-slate-700">
                                  {account.account_type?.replace(/_/g, " ")}
                                </span>
                              </TableCell>
                              <TableCell>
                                <span className="font-semibold text-slate-900">
                                  {formatCurrency(account.year_end_cash_value, account.year_end_cash_value_currency || "USD")}
                                </span>
                              </TableCell>
                              <TableCell>
                                {getStatusBadge(account.reportability_status)}
                              </TableCell>
                              <TableCell>
                                <span className="text-sm text-slate-600">
                                  {accountEntity?.entity_name || "—"}
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
                                    <DropdownMenuItem onClick={() => handleViewDetails(account)}>
                                      <FileText className="w-4 h-4 mr-2" />
                                      View Details
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleViewHistory(account)}>
                                      <History className="w-4 h-4 mr-2" />
                                      View History
                                    </DropdownMenuItem>
                                    
                                    {(isAdmin || entityAccessMap[account.entity_id] === 'edit') && (
                                      <>
                                        {account.reportability_status === "pending_review" && (
                                          <DropdownMenuItem onClick={() => handleClassify(account)}>
                                            <Eye className="w-4 h-4 mr-2" />
                                            Classify Account
                                          </DropdownMenuItem>
                                        )}
                                        {account.reportability_status !== "pending_review" && (
                                          <DropdownMenuItem onClick={() => handleClassify(account)}>
                                            <Eye className="w-4 h-4 mr-2" />
                                            Re-classify Account
                                          </DropdownMenuItem>
                                        )}
                                        
                                        {account.account_holder_type === "entity" && (
                                          <DropdownMenuItem onClick={() => handleManageControllingPersons(account)}>
                                            <Users className="w-4 h-4 mr-2" />
                                            {isPassiveNFE ? "Manage Controlling Persons ⚠️" : "Controlling Persons"}
                                          </DropdownMenuItem>
                                        )}
                                        
                                        {account.account_holder_type === "individual" && account.account_holder_is_alive === false && (
                                          <DropdownMenuItem onClick={() => handleManageBeneficiaries(account)}>
                                            <HeartHandshake className="w-4 h-4 mr-2" />
                                            Manage Beneficiaries
                                          </DropdownMenuItem>
                                        )}
                                        
                                        <DropdownMenuItem onClick={() => handleEdit(account)}>
                                          <Edit className="w-4 h-4 mr-2" />
                                          Edit Account
                                        </DropdownMenuItem>
                                        <DropdownMenuItem 
                                          onClick={() => handleDelete(account.id)}
                                          className="text-red-600"
                                        >
                                          <Trash2 className="w-4 h-4 mr-2" />
                                          Delete
                                        </DropdownMenuItem>
                                      </>
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
          </TabsContent>

          <TabsContent value="compliance">
            <ComplianceFlags 
              tenantId={user?.tenant_id}
              onSelectAccount={handleComplianceFlagSelect}
              onIssuesCountChange={setComplianceIssuesCount}
            />
          </TabsContent>

          {(tenant?.enabled_features?.ai_data_validator !== false) && (
            <TabsContent value="ai-validator">
              <AIDataValidator
                accounts={accounts}
                entities={entities}
                onIssueSelect={(issue) => {
                  if (issue.affected_record_type === 'account') {
                    const account = accounts.find(a => a.id === issue.affected_record_id);
                    if (account) handleEdit(account);
                  }
                }}
              />
            </TabsContent>
          )}

          {(tenant?.enabled_features?.ai_jurisdiction_advisor !== false) && (
            <TabsContent value="jurisdiction">
              <AIJurisdictionAdvisor initialJurisdiction={tenant?.jurisdiction} />
            </TabsContent>
          )}


        </Tabs>
      </div>

      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Account Details: {selectedAccount?.account_holder_name}</DialogTitle>
          </DialogHeader>
          <AccountDetails 
            account={selectedAccount}
            entity={entities.find(e => e.id === selectedAccount?.entity_id)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>
              {selectedAccount ? "Edit Account" : "Add New Account"}
            </DialogTitle>
          </DialogHeader>
          <AccountForm
            account={selectedAccount}
            entities={entities}
            tenant={tenant}
            onSubmit={(data) => {
              if (selectedAccount) {
                updateMutation.mutate({ id: selectedAccount.id, data });
              } else {
                createMutation.mutate(data);
              }
            }}
            onCancel={() => {
              setShowForm(false);
              setSelectedAccount(null);
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={showClassification} onOpenChange={setShowClassification}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>
              Account Classification: {selectedAccount?.account_holder_name}
            </DialogTitle>
          </DialogHeader>
          <AccountClassification
            account={selectedAccount}
            onComplete={async (data) => {
              console.log('\n🔄🔄🔄 [REDIRECT] onComplete callback started in Accounts page');
              const redirectFlowStart = performance.now();
              
              const shouldRedirect = data._redirectToControllingPersons;
              const { _redirectToControllingPersons, ...cleanData } = data;
              
              console.log(`⏱️ [REDIRECT] shouldRedirect: ${shouldRedirect}`);
              
              // Store account ID for redirect
              const accountId = selectedAccount.id;
              console.log(`⏱️ [REDIRECT] Account ID: ${accountId}`);
              
              // Merge classification data with existing account data to preserve documents
              const mergedData = {
                ...cleanData,
                // If classification adds new documents, they're already in data.documents
                // which was built from existing account.documents + new upload
              };
              
              // Update the account (skip hooks to avoid auto-classification and workflow checks)
              console.log('⏱️ [REDIRECT] Starting database update (skipHooks=true to speed up redirect)');
              const dbUpdateStart = performance.now();
              await updateMutation.mutateAsync({ id: accountId, data: mergedData, skipHooks: true });
              console.log(`⏱️ [REDIRECT] Database update completed in ${Math.round(performance.now() - dbUpdateStart)}ms`);
              
              // Close classification dialog
              console.log('⏱️ [REDIRECT] Closing classification dialog');
              const dialogCloseStart = performance.now();
              setShowClassification(false);
              console.log(`⏱️ [REDIRECT] Dialog closed in ${Math.round(performance.now() - dialogCloseStart)}ms`);
              
              // If redirect is needed, open controlling persons manager
              if (shouldRedirect) {
                console.log('⏱️ [REDIRECT] Starting query invalidation for fresh data');
                const invalidateStart = performance.now();
                
                // Ensure fresh account data is loaded
                await queryClient.invalidateQueries(['accounts']);
                await queryClient.invalidateQueries(['controlling-persons']);
                
                console.log(`⏱️ [REDIRECT] Query invalidation completed in ${Math.round(performance.now() - invalidateStart)}ms`);
                
                // Wait for queries to refresh and get the updated account
                console.log('⏱️ [REDIRECT] Scheduling controlling persons dialog open in 200ms (reduced from 500ms)');
                setTimeout(() => {
                  console.log('⏱️ [REDIRECT] Timeout fired - opening controlling persons manager');
                  const finalSetupStart = performance.now();
                  
                  const refreshedAccount = queryClient.getQueryData(['accounts', user?.tenant_id])?.find(a => a.id === accountId);
                  console.log('⏱️ [REDIRECT] Refreshed account found:', !!refreshedAccount);
                  
                  setSelectedAccount(refreshedAccount);
                  setShowControllingPersons(true);
                  
                  console.log(`⏱️ [REDIRECT] Final setup completed in ${Math.round(performance.now() - finalSetupStart)}ms`);
                  console.log(`🔄🔄🔄 [REDIRECT] Total redirect flow took ${Math.round(performance.now() - redirectFlowStart)}ms\n`);
                }, 200);
              } else {
                // If no redirect, deselect account
                console.log('⏱️ [REDIRECT] No redirect needed, deselecting account');
                setSelectedAccount(null);
                console.log(`🔄🔄🔄 [REDIRECT] Total completion flow (no redirect) took ${Math.round(performance.now() - redirectFlowStart)}ms\n`);
              }
            }}
            onCancel={() => setShowClassification(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Classification History: {selectedAccount?.account_holder_name}</DialogTitle>
          </DialogHeader>
          <AccountClassificationHistory 
            history={classificationHistory}
            account={selectedAccount}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={showControllingPersons} onOpenChange={setShowControllingPersons}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>
              Controlling Persons: {selectedAccount?.account_holder_name}
            </DialogTitle>
          </DialogHeader>
          <ControllingPersonsList account={selectedAccount} />
        </DialogContent>
      </Dialog>

      <Dialog open={showBeneficiaries} onOpenChange={setShowBeneficiaries}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>
              Beneficiaries: {selectedAccount?.account_holder_name}
            </DialogTitle>
          </DialogHeader>
          <BeneficiaryManager account={selectedAccount} tenant={tenant} />
        </DialogContent>
      </Dialog>

      <Dialog open={showBulkImport} onOpenChange={setShowBulkImport}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>AI-Powered Bulk Import</DialogTitle>
          </DialogHeader>
          <AIBulkImport 
            tenant={tenant}
            entities={accessibleEntities}
            importType="Account"
            onComplete={() => {
              setShowBulkImport(false);
              queryClient.invalidateQueries(['accounts']);
            }}
            onCancel={() => setShowBulkImport(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={showBulkUpdate} onOpenChange={setShowBulkUpdate}>
        <DialogContent className="max-w-xl" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Bulk Update Accounts</DialogTitle>
          </DialogHeader>
          <BulkUpdateForm
            selectedAccounts={accounts.filter(a => selectedAccountIds.includes(a.id))}
            onUpdate={handleBulkUpdate}
            onCancel={() => setShowBulkUpdate(false)}
            isLoading={bulkUpdateMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={showBulkDelete} onOpenChange={setShowBulkDelete}>
        <DialogContent className="max-w-xl" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Confirm Bulk Delete</DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            <Alert className="bg-red-50 border-red-200">
              <AlertTriangle className="w-4 h-4 text-red-600" />
              <AlertDescription className="text-red-900">
                <strong>Warning: This action cannot be undone!</strong>
                <p className="mt-2">
                  You are about to permanently delete <strong>{selectedAccountIds.length}</strong> account{selectedAccountIds.length !== 1 ? 's' : ''}.
                </p>
              </AlertDescription>
            </Alert>

            <div className="bg-slate-50 rounded-lg p-4 max-h-48 overflow-y-auto">
              <h4 className="text-sm font-semibold text-slate-700 mb-2">Accounts to be deleted:</h4>
              <ul className="space-y-1">
                {accounts.filter(a => selectedAccountIds.includes(a.id)).map((account) => (
                  <li key={account.id} className="text-sm text-slate-600 flex items-center gap-2">
                    <Trash2 className="w-3 h-3 text-red-600" />
                    <span className="font-medium">{account.account_holder_name}</span>
                    <span className="text-slate-400">({account.account_number})</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setShowBulkDelete(false)}
                disabled={bulkDeleteMutation.isPending}
              >
                Cancel
              </Button>
              <Button 
                onClick={() => bulkDeleteMutation.mutate()}
                disabled={bulkDeleteMutation.isPending}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {bulkDeleteMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Confirm Delete
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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