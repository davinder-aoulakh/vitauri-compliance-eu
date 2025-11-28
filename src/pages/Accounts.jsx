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
  Upload,
  Flag,
  FileCheck
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AccountForm from "../components/accounts/AccountForm";
import AccountDetails from "../components/accounts/AccountDetails";
import AccountClassification from "../components/accounts/AccountClassification";
import AccountClassificationHistory from "../components/accounts/AccountClassificationHistory";
import ControllingPersonsList from "../components/accounts/ControllingPersonsList";
import BulkImport from "../components/accounts/BulkImport";
import ComplianceFlags from "../components/accounts/ComplianceFlags";
import { suggestWorkflows } from "../components/workflows/WorkflowTriggerEvaluator";

export default function AccountsPage() {
  const [user, setUser] = useState(null);
  const [tenant, setTenant] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showClassification, setShowClassification] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showControllingPersons, setShowControllingPersons] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [showComplianceFlags, setShowComplianceFlags] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [entityFilter, setEntityFilter] = useState("all");
  const [countryFilter, setCountryFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("accounts");

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

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Account.create({ ...data, tenant_id: user.tenant_id }),
    onSuccess: async (newAccount) => {
      queryClient.invalidateQueries(['accounts']);
      setShowForm(false);
      setSelectedAccount(null);
      
      // Check for workflow triggers
      const suggestedWorkflows = await suggestWorkflows(newAccount, 'account_created');
      if (suggestedWorkflows.length > 0) {
        console.log(`${suggestedWorkflows.length} workflow(s) triggered for new account:`, suggestedWorkflows);
        // Could show a toast notification here
      }
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Account.update(id, data),
    onSuccess: async (updatedAccount) => {
      queryClient.invalidateQueries(['accounts']);
      setShowForm(false);
      setShowClassification(false);
      setSelectedAccount(null);
      
      // Check for workflow triggers
      const suggestedWorkflows = await suggestWorkflows(updatedAccount, 'account_updated');
      if (suggestedWorkflows.length > 0) {
        console.log(`${suggestedWorkflows.length} workflow(s) triggered for updated account:`, suggestedWorkflows);
        // Could show a toast notification here
      }
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Account.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['accounts']);
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

  const handleDelete = async (id) => {
    if (confirm("Are you sure you want to delete this account?")) {
      deleteMutation.mutate(id);
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

  const filteredAccounts = accounts.filter(account => {
    const matchesSearch = account.account_holder_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         account.account_number?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || account.reportability_status === statusFilter;
    const matchesEntity = entityFilter === "all" || account.entity_id === entityFilter;
    
    const matchesCountry = countryFilter === "all" || 
      (account.tax_residencies && account.tax_residencies.some(r => r.country === countryFilter)) ||
      account.account_holder_address?.country === countryFilter;
    
    return matchesSearch && matchesStatus && matchesEntity && matchesCountry;
  });

  const uniqueCountries = [...new Set(
    accounts.flatMap(a => [
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

  const complianceIssuesCount = accounts.filter(a => 
    a.reportability_status === 'pending_review' ||
    (a.entity_classification === 'passive_nfe' && !a.requires_controlling_persons) ||
    (a.account_holder_type === 'individual' && !a.self_certification_obtained && a.reportability_status !== 'non_reportable')
  ).length;

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
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">Accounts</h1>
            <p className="text-slate-600">
              Manage account holders and their reportability status
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              onClick={() => setShowBulkImport(true)}
              variant="outline"
              className="gap-2"
            >
              <Upload className="w-4 h-4" />
              Bulk Import
            </Button>
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
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="accounts">
              <Wallet className="w-4 h-4 mr-2" />
              Accounts
            </TabsTrigger>
            <TabsTrigger value="compliance" className="relative">
              <Flag className="w-4 h-4 mr-2" />
              Compliance Flags
              {complianceIssuesCount > 0 && (
                <Badge className="ml-2 bg-amber-500 text-white border-0 px-2 py-0 text-xs">
                  {complianceIssuesCount}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

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
                      <p className="text-2xl font-bold text-slate-900">{accounts.length}</p>
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
                        {accounts.filter(a => a.reportability_status === "reportable").length}
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
                        {accounts.filter(a => a.reportability_status === "pending_review").length}
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
                        {accounts.filter(a => a.reportability_status === "non_reportable").length}
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
                  <Select value={countryFilter} onValueChange={setCountryFilter}>
                    <SelectTrigger className="w-full md:w-64">
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

                  {(searchTerm || statusFilter !== "all" || entityFilter !== "all" || countryFilter !== "all") && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSearchTerm("");
                        setStatusFilter("all");
                        setEntityFilter("all");
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
                      {accounts.filter(a => a.reportability_status === "reportable").length} Reportable, {" "}
                      {accounts.filter(a => a.reportability_status === "pending_review").length} Pending Review
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
                    {!searchTerm && statusFilter === "all" && entityFilter === "all" && countryFilter === "all" && (
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
                          <TableHead>Account Holder</TableHead>
                          <TableHead>Account Number</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Balance</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Entity</TableHead>
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
                                      {hasDocument && (
                                        <FileCheck className="w-4 h-4 text-green-600" title="Self-certification document uploaded" />
                                      )}
                                    </div>
                                    <p className="text-xs text-slate-500 capitalize">
                                      {account.account_holder_type?.replace("_", " ")}
                                      {isPassiveNFE && (
                                        <span className="ml-2 text-purple-600 font-medium">(Passive NFE)</span>
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
                                  {formatCurrency(account.account_balance, account.currency)}
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
                                    
                                    {account.reportability_status === "pending_review" && (
                                      <DropdownMenuItem onClick={() => handleClassify(account)}>
                                        <Eye className="w-4 h-4 mr-2" />
                                        Classify Account
                                      </DropdownMenuItem>
                                    )}
                                    <DropdownMenuItem onClick={() => handleClassify(account)}>
                                      <Eye className="w-4 h-4 mr-2" />
                                      Re-classify Account
                                    </DropdownMenuItem>
                                    
                                    {account.account_holder_type === "entity" && (
                                      <DropdownMenuItem onClick={() => handleManageControllingPersons(account)}>
                                        <Users className="w-4 h-4 mr-2" />
                                        {isPassiveNFE ? "Manage Controlling Persons ⚠️" : "Controlling Persons"}
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
            />
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
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
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
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
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedAccount?.account_holder_type === "entity" 
                ? `Entity Classification: ${selectedAccount?.account_holder_name}`
                : `Reportability Assessment: ${selectedAccount?.account_holder_name}`
              }
            </DialogTitle>
          </DialogHeader>
          <AccountClassification
            account={selectedAccount}
            onComplete={(data) => {
              // Merge classification data with existing account data to preserve documents
              const mergedData = {
                ...data,
                // If classification adds new documents, they're already in data.documents
                // which was built from existing account.documents + new upload
              };
              updateMutation.mutate({ id: selectedAccount.id, data: mergedData });
            }}
            onCancel={() => setShowClassification(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
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
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Controlling Persons: {selectedAccount?.account_holder_name}
            </DialogTitle>
          </DialogHeader>
          <ControllingPersonsList account={selectedAccount} />
        </DialogContent>
      </Dialog>

      <Dialog open={showBulkImport} onOpenChange={setShowBulkImport}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Bulk Import Accounts</DialogTitle>
          </DialogHeader>
          <BulkImport 
            tenant={tenant}
            entities={entities}
            onComplete={() => {
              setShowBulkImport(false);
              queryClient.invalidateQueries(['accounts']);
            }}
            onCancel={() => setShowBulkImport(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}