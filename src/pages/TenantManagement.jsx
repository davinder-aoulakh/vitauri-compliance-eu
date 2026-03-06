import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Building2,
  Search,
  MoreVertical,
  Edit,
  Trash2,
  CheckCircle2,
  Clock,
  XCircle,
  Mail,
  MapPin,
  Activity
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import TenantForm from "../components/superadmin/TenantForm";
import TenantHealthDashboard from "../components/superadmin/TenantHealthDashboard";

export default function TenantManagement() {
  const [user, setUser] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  const queryClient = useQueryClient();

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      
      if (currentUser.user_role !== "super_admin") {
        window.location.href = createPageUrl("Dashboard");
      }
    } catch (error) {
      console.error("Error loading user:", error);
    }
  };

  const { data: tenants = [], isLoading } = useQuery({
    queryKey: ['tenants'],
    queryFn: () => base44.entities.Tenant.list(),
    enabled: !!user
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Tenant.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['tenants']);
      setShowForm(false);
      setSelectedTenant(null);
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Tenant.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['tenants']);
      setShowForm(false);
      setSelectedTenant(null);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Tenant.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['tenants']);
    }
  });

  const handleEdit = (tenant) => {
    setSelectedTenant(tenant);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (confirm("Are you sure you want to delete this tenant? This action cannot be undone.")) {
      deleteMutation.mutate(id);
    }
  };

  const filteredTenants = tenants.filter(tenant =>
    tenant.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tenant.short_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tenant.jurisdiction?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status) => {
    const config = {
      active: { label: "Active", color: "bg-green-100 text-green-800 border-green-200", icon: CheckCircle2 },
      trial: { label: "Trial", color: "bg-blue-100 text-blue-800 border-blue-200", icon: Clock },
      suspended: { label: "Suspended", color: "bg-red-100 text-red-800 border-red-200", icon: XCircle }
    };
    const { label, color, icon: Icon } = config[status] || config.active;
    return (
      <Badge variant="outline" className={`${color} border`}>
        <Icon className="w-3 h-3 mr-1" />
        {label}
      </Badge>
    );
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-900">
      <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Tenant Management</h1>
            <p className="text-indigo-200">
              Onboard and manage financial institutions on the platform
            </p>
          </div>
          <Button
            onClick={() => {
              setSelectedTenant(null);
              setShowForm(true);
            }}
            className="gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-lg"
          >
            <Plus className="w-4 h-4" />
            Add New Tenant
          </Button>
        </div>

        <Tabs defaultValue="tenants" className="space-y-6">
          <TabsList className="bg-white/10 backdrop-blur-sm">
            <TabsTrigger value="tenants" className="text-white data-[state=active]:bg-white/20 gap-2">
              <Building2 className="w-4 h-4" /> Tenants
            </TabsTrigger>
            <TabsTrigger value="health" className="text-white data-[state=active]:bg-white/20 gap-2">
              <Activity className="w-4 h-4" /> Health Monitor
            </TabsTrigger>
          </TabsList>

          <TabsContent value="health">
            <TenantHealthDashboard />
          </TabsContent>

          <TabsContent value="tenants" className="space-y-6">

        {/* Search */}
        <Card className="border-0 shadow-xl bg-white/10 backdrop-blur-sm border border-white/20">
          <CardContent className="p-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-indigo-300 w-4 h-4" />
              <Input
                placeholder="Search tenants by name, jurisdiction..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-white/5 border-white/20 text-white placeholder:text-indigo-300"
              />
            </div>
          </CardContent>
        </Card>

        {/* Tenants Table */}
        <Card className="border-0 shadow-xl bg-white/10 backdrop-blur-sm border border-white/20">
          <CardHeader className="border-b border-white/10">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-white">
                  <Building2 className="w-5 h-5" />
                  Tenants ({filteredTenants.length})
                </CardTitle>
                <CardDescription className="text-indigo-200">
                  {tenants.filter(t => t.subscription_status === "active").length} active, {" "}
                  {tenants.filter(t => t.subscription_status === "trial").length} on trial
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto"></div>
              </div>
            ) : filteredTenants.length === 0 ? (
              <div className="p-12 text-center">
                <Building2 className="w-16 h-16 mx-auto mb-4 text-indigo-300" />
                <h3 className="text-lg font-semibold text-white mb-2">No tenants found</h3>
                <p className="text-indigo-200 mb-6">
                  {searchTerm ? "Try adjusting your search" : "Get started by adding your first tenant"}
                </p>
                {!searchTerm && (
                  <Button 
                    onClick={() => setShowForm(true)}
                    className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add First Tenant
                  </Button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/10 hover:bg-white/5">
                      <TableHead className="text-indigo-200">Tenant</TableHead>
                      <TableHead className="text-indigo-200">Tenant ID</TableHead>
                      <TableHead className="text-indigo-200">Jurisdiction</TableHead>
                      <TableHead className="text-indigo-200">Contact</TableHead>
                      <TableHead className="text-indigo-200">Status</TableHead>
                      <TableHead className="text-indigo-200">Tier</TableHead>
                      <TableHead className="text-right text-indigo-200">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTenants.map((tenant) => (
                      <TableRow key={tenant.id} className="border-white/10 hover:bg-white/5">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            {tenant.branding?.logo_url ? (
                              <img 
                                src={tenant.branding.logo_url}
                                alt={tenant.name}
                                className="w-10 h-10 rounded-lg object-contain bg-white p-1"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                                <span className="text-white font-bold text-sm">
                                  {tenant.short_name?.[0] || tenant.name?.[0] || "T"}
                                </span>
                              </div>
                            )}
                            <div>
                              <p className="font-semibold text-white">{tenant.name}</p>
                              {tenant.short_name && (
                                <p className="text-xs text-indigo-300">{tenant.short_name}</p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs font-mono text-indigo-200 bg-white/5 px-2 py-1 rounded select-all">
                            {tenant.id}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-indigo-300" />
                            <span className="text-white">{tenant.jurisdiction}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Mail className="w-4 h-4 text-indigo-300" />
                            <span className="text-sm text-indigo-200">{tenant.contact_email}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(tenant.subscription_status)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-purple-100 text-purple-800 border-purple-200 capitalize">
                            {tenant.subscription_tier}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="text-white hover:bg-white/10">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleEdit(tenant)}>
                                <Edit className="w-4 h-4 mr-2" />
                                Edit Tenant
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleDelete(tenant.id)}
                                className="text-red-600"
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

          </TabsContent>
        </Tabs>
      </div>

      {/* Tenant Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedTenant ? "Edit Tenant" : "Add New Tenant"}
            </DialogTitle>
          </DialogHeader>
          <TenantForm
            tenant={selectedTenant}
            onSubmit={(data) => {
              if (selectedTenant) {
                updateMutation.mutate({ id: selectedTenant.id, data });
              } else {
                createMutation.mutate(data);
              }
            }}
            onCancel={() => {
              setShowForm(false);
              setSelectedTenant(null);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}