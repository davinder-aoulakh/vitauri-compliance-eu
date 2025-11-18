import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { auditLog } from "@/components/utils/auditLogger";
import { toast } from "sonner";
import { 
  Plus, 
  Building2, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Search,
  Filter,
  MoreVertical,
  Edit,
  Trash2,
  Eye,
  History,
  FileText,
  AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import moment from "moment";
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
import EntityForm from "../components/entities/EntityForm";
import EntityClassification from "../components/entities/EntityClassification";
import ClassificationHistory from "../components/entities/ClassificationHistory";
import EntityDetails from "../components/entities/EntityDetails";

export default function EntitiesPage() {
  const [user, setUser] = useState(null);
  const [tenant, setTenant] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState(null);
  const [showClassification, setShowClassification] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

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

        // Add sample data for re-classification testing if not exists
        const existingEntities = await base44.entities.Entity.filter({ tenant_id: currentUser.tenant_id });
        if (!existingEntities.some(e => e.entity_name === "ACME Old Entity")) {
          await base44.entities.Entity.create({
            tenant_id: currentUser.tenant_id,
            entity_name: "ACME Old Entity",
            entity_type: "corporation",
            country_of_incorporation: "United Kingdom",
            rfi_status: "reporting_fi",
            fi_type: "investment_entity",
            classification_completed_date: "2024-01-15"
          });
        }
      }
    } catch (error) {
      console.error("Error loading user:", error);
    }
  };

  const { data: entities = [], isLoading } = useQuery({
    queryKey: ['entities', user?.tenant_id],
    queryFn: () => user?.tenant_id 
      ? base44.entities.Entity.filter({ tenant_id: user.tenant_id })
      : [],
    enabled: !!user?.tenant_id
  });

  // Fetch referenced data for labels
  const { data: referencedData = [] } = useQuery({
    queryKey: ['referenced-data-labels'],
    queryFn: () => base44.entities.ReferencedData.list(),
    enabled: !!user
  });

  // Helper function to get label from value
  const getLabel = (entityName, fieldName, value) => {
    const item = referencedData.find(
      rd => rd.entity_name === entityName && rd.field_name === fieldName && rd.value === value
    );
    return item?.label || value;
  };

  const { data: classificationHistory = [] } = useQuery({
    queryKey: ['classification-history', selectedEntity?.id],
    queryFn: () => selectedEntity?.id
      ? base44.entities.EntityClassificationHistory.filter({ entity_id: selectedEntity.id })
      : [],
    enabled: !!selectedEntity?.id && showHistory
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Entity.create({ ...data, tenant_id: user.tenant_id }),
    onSuccess: async (newEntity) => {
      queryClient.invalidateQueries(['entities']);
      setShowForm(false);
      setSelectedEntity(null);
      toast.success("Entity created successfully");
      await auditLog.entityCreated(newEntity.id, newEntity);
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Entity.update(id, data),
    onSuccess: async (updatedEntity, variables) => {
      const beforeData = entities.find(e => e.id === variables.id);
      queryClient.invalidateQueries(['entities']);
      setShowForm(false);
      setShowClassification(false);
      setSelectedEntity(null);
      toast.success("Entity updated successfully");
      await auditLog.entityUpdated(variables.id, beforeData, variables.data);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Entity.delete(id),
    onSuccess: async (_, entityId) => {
      const deletedEntity = entities.find(e => e.id === entityId);
      queryClient.invalidateQueries(['entities']);
      toast.success("Entity deleted successfully");
      await auditLog.entityDeleted(entityId, deletedEntity);
    }
  });

  const handleClassify = (entity) => {
    setSelectedEntity(entity);
    setShowClassification(true);
  };

  const handleViewHistory = (entity) => {
    setSelectedEntity(entity);
    setShowHistory(true);
  };

  const handleViewDetails = (entity) => {
    setSelectedEntity(entity);
    setShowDetails(true);
  };

  const handleEdit = (entity) => {
    setSelectedEntity(entity);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (confirm("Are you sure you want to delete this entity?")) {
      deleteMutation.mutate(id);
    }
  };

  const filteredEntities = entities.filter(entity => {
    const matchesSearch = entity.entity_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         entity.country_of_incorporation.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || entity.rfi_status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status) => {
    const config = {
      reporting_fi: { label: "Reporting FI", color: "bg-green-100 text-green-800 border-green-200" },
      non_reporting_fi: { label: "Non-Reporting FI", color: "bg-slate-100 text-slate-800 border-slate-200" },
      nfe_active: { label: "Active NFE", color: "bg-blue-100 text-blue-800 border-blue-200" },
      nfe_passive: { label: "Passive NFE", color: "bg-purple-100 text-purple-800 border-purple-200" },
      pending_classification: { label: "Pending", color: "bg-amber-100 text-amber-800 border-amber-200" }
    };
    const { label, color } = config[status] || config.pending_classification;
    return <Badge variant="outline" className={`${color} border`}>{label}</Badge>;
  };

  const getStatusIcon = (status) => {
    if (status === "reporting_fi") return <CheckCircle2 className="w-4 h-4 text-green-600" />;
    if (status === "pending_classification") return <Clock className="w-4 h-4 text-amber-600" />;
    return <XCircle className="w-4 h-4 text-slate-600" />;
  };

  const primaryColor = tenant?.branding?.primary_color || "#464feb";

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
            <h1 className="text-3xl font-bold text-slate-900 mb-2">Legal Entities</h1>
            <p className="text-slate-600">
              Manage and classify your legal entities for CRS reporting
            </p>
          </div>
          <Button 
            onClick={() => {
              setSelectedEntity(null);
              setShowForm(true);
            }}
            className="gap-2 text-white shadow-lg"
            style={{ background: `linear-gradient(135deg, ${primaryColor} 0%, ${primaryColor}dd 100%)` }}
          >
            <Plus className="w-4 h-4" />
            Add Entity
          </Button>
        </div>

        {/* Filters */}
        <Card className="border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <Input
                    placeholder="Search entities by name or country..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-64">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="reporting_fi">Reporting FI</SelectItem>
                  <SelectItem value="non_reporting_fi">Non-Reporting FI</SelectItem>
                  <SelectItem value="nfe_active">Active NFE</SelectItem>
                  <SelectItem value="nfe_passive">Passive NFE</SelectItem>
                  <SelectItem value="pending_classification">Pending Classification</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Entities Table */}
        <Card className="border-0 shadow-lg">
          <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-transparent">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="w-5 h-5" style={{ color: primaryColor }} />
                  Entities ({filteredEntities.length})
                </CardTitle>
                <CardDescription>
                  {entities.filter(e => e.rfi_status === "reporting_fi").length} Reporting FIs, {" "}
                  {entities.filter(e => e.rfi_status === "pending_classification").length} Pending Classification
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
              </div>
            ) : filteredEntities.length === 0 ? (
              <div className="p-12 text-center">
                <Building2 className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                <h3 className="text-lg font-semibold text-slate-900 mb-2">No entities found</h3>
                <p className="text-slate-600 mb-6">
                  {searchTerm || statusFilter !== "all" 
                    ? "Try adjusting your filters" 
                    : "Get started by adding your first legal entity"}
                </p>
                {!searchTerm && statusFilter === "all" && (
                  <Button onClick={() => setShowForm(true)} style={{ backgroundColor: primaryColor }}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add First Entity
                  </Button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/50">
                      <TableHead>Entity Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Country</TableHead>
                      <TableHead>CRS Status</TableHead>
                      <TableHead>FI Type</TableHead>
                      <TableHead>Re-classify?</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEntities.map((entity) => (
                      <TableRow key={entity.id} className="hover:bg-slate-50/50">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div 
                              className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                              style={{ backgroundColor: `${primaryColor}15` }}
                            >
                              {getStatusIcon(entity.rfi_status)}
                            </div>
                            <div>
                              <p className="font-semibold text-slate-900">{entity.entity_name}</p>
                              {entity.tax_id && (
                                <p className="text-xs text-slate-500">Tax ID: {entity.tax_id}</p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-slate-700">
                            {getLabel('Entity', 'entity_type', entity.entity_type)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-slate-700">
                            {getLabel('Global', 'country', entity.country_of_incorporation)}
                          </span>
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(entity.rfi_status)}
                        </TableCell>
                        <TableCell>
                          {entity.fi_type && entity.fi_type !== "not_applicable" ? (
                            <span className="text-sm capitalize text-slate-700">
                              {entity.fi_type.replace(/_/g, " ")}
                            </span>
                          ) : (
                            <span className="text-sm text-slate-400">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {entity.classification_completed_date &&
                          moment().diff(moment(entity.classification_completed_date), 'months') >= 10 ? (
                            <Badge variant="destructive" className="bg-red-50 text-red-700 border-red-200">
                              <AlertCircle className="w-3 h-3 mr-1" /> Re-classify
                            </Badge>
                          ) : (
                            <span className="text-sm text-slate-400">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleViewDetails(entity)}>
                                <FileText className="w-4 h-4 mr-2" />
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleViewHistory(entity)}>
                                <History className="w-4 h-4 mr-2" />
                                View History
                              </DropdownMenuItem>
                              {entity.rfi_status === "pending_classification" && (
                                <DropdownMenuItem onClick={() => handleClassify(entity)}>
                                  <Eye className="w-4 h-4 mr-2" />
                                  Classify Entity
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={() => handleClassify(entity)}>
                                <Eye className="w-4 h-4 mr-2" />
                                Re-classify Entity
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleEdit(entity)}>
                                <Edit className="w-4 h-4 mr-2" />
                                Edit Details
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => handleDelete(entity.id)}
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
      </div>

      {/* Entity Details Dialog */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Entity Details: {selectedEntity?.entity_name}</DialogTitle>
          </DialogHeader>
          <EntityDetails entity={selectedEntity} />
        </DialogContent>
      </Dialog>

      {/* Entity Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedEntity ? "Edit Entity" : "Add New Entity"}
            </DialogTitle>
          </DialogHeader>
          <EntityForm
            entity={selectedEntity}
            onSubmit={(data) => {
              if (selectedEntity) {
                updateMutation.mutate({ id: selectedEntity.id, data });
              } else {
                createMutation.mutate(data);
              }
            }}
            onCancel={() => {
              setShowForm(false);
              setSelectedEntity(null);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Classification Dialog */}
      <Dialog open={showClassification} onOpenChange={setShowClassification}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>RFI Classification: {selectedEntity?.entity_name}</DialogTitle>
          </DialogHeader>
          <EntityClassification
            entity={selectedEntity}
            onComplete={(data) => {
              updateMutation.mutate({ id: selectedEntity.id, data });
            }}
            onCancel={() => setShowClassification(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Classification History Dialog */}
      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Classification History: {selectedEntity?.entity_name}</DialogTitle>
          </DialogHeader>
          <ClassificationHistory 
            history={classificationHistory}
            entity={selectedEntity}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}