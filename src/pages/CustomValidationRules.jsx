import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { Plus, Shield, Edit, Trash2, MoreVertical, AlertCircle, CheckCircle2, XCircle } from "lucide-react";
import CustomValidationRuleForm from "../components/validation/CustomValidationRuleForm";

export default function CustomValidationRulesPage() {
  const [user, setUser] = useState(null);
  const [tenant, setTenant] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [selectedRule, setSelectedRule] = useState(null);

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

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ['custom-validation-rules', user?.tenant_id],
    queryFn: () => user?.tenant_id 
      ? base44.entities.CustomValidationRule.filter({ tenant_id: user.tenant_id })
      : [],
    enabled: !!user?.tenant_id
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.CustomValidationRule.create({
      ...data,
      tenant_id: user.tenant_id,
      created_by: user.email
    }),
    onSuccess: () => {
      queryClient.invalidateQueries(['custom-validation-rules']);
      setShowForm(false);
      setSelectedRule(null);
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.CustomValidationRule.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['custom-validation-rules']);
      setShowForm(false);
      setSelectedRule(null);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.CustomValidationRule.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['custom-validation-rules']);
    }
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }) => base44.entities.CustomValidationRule.update(id, { is_active: !isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries(['custom-validation-rules']);
    }
  });

  const handleEdit = (rule) => {
    setSelectedRule(rule);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (confirm("Are you sure you want to delete this validation rule?")) {
      deleteMutation.mutate(id);
    }
  };

  const getSeverityBadge = (severity) => {
    const config = {
      high: { label: "High", color: "bg-red-100 text-red-800 border-red-200" },
      medium: { label: "Medium", color: "bg-amber-100 text-amber-800 border-amber-200" },
      low: { label: "Low", color: "bg-blue-100 text-blue-800 border-blue-200" }
    };
    const { label, color } = config[severity] || config.medium;
    return <Badge variant="outline" className={`${color} border`}>{label}</Badge>;
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
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">Custom Validation Rules</h1>
            <p className="text-slate-600">
              Define custom validation rules for AI-powered data quality checks
            </p>
          </div>
          <Button 
            onClick={() => {
              setSelectedRule(null);
              setShowForm(true);
            }}
            className="gap-2 text-white shadow-lg"
            style={{ background: `linear-gradient(135deg, ${primaryColor} 0%, ${primaryColor}dd 100%)` }}
          >
            <Plus className="w-4 h-4" />
            Add Rule
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="border-0 shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-600">Total Rules</p>
                  <p className="text-2xl font-bold text-slate-900">{rules.length}</p>
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
                  <p className="text-xs text-slate-600">Active</p>
                  <p className="text-2xl font-bold text-slate-900">
                    {rules.filter(r => r.is_active).length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                  <AlertCircle className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-600">High Severity</p>
                  <p className="text-2xl font-bold text-slate-900">
                    {rules.filter(r => r.severity === 'high').length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                  <XCircle className="w-5 h-5 text-slate-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-600">Inactive</p>
                  <p className="text-2xl font-bold text-slate-900">
                    {rules.filter(r => !r.is_active).length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-0 shadow-lg">
          <CardHeader className="border-b bg-slate-50/50">
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" style={{ color: primaryColor }} />
              Validation Rules ({rules.length})
            </CardTitle>
            <CardDescription>
              {rules.filter(r => r.is_active).length} active rules will be applied during AI validation
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
              </div>
            ) : rules.length === 0 ? (
              <div className="p-12 text-center">
                <Shield className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                <h3 className="text-lg font-semibold text-slate-900 mb-2">No validation rules yet</h3>
                <p className="text-slate-600 mb-6">
                  Create your first custom validation rule to enhance AI data quality checks
                </p>
                <Button onClick={() => setShowForm(true)} style={{ backgroundColor: primaryColor }}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add First Rule
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/50">
                      <TableHead>Rule Name</TableHead>
                      <TableHead>Target Entity</TableHead>
                      <TableHead>Rule Type</TableHead>
                      <TableHead>Severity</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rules.map((rule) => (
                      <TableRow key={rule.id} className="hover:bg-slate-50/50">
                        <TableCell>
                          <div>
                            <p className="font-semibold text-slate-900">{rule.rule_name}</p>
                            <p className="text-xs text-slate-500">{rule.description}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {rule.target_entity_type}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm capitalize text-slate-700">
                            {rule.rule_type?.replace(/_/g, " ")}
                          </span>
                        </TableCell>
                        <TableCell>
                          {getSeverityBadge(rule.severity)}
                        </TableCell>
                        <TableCell>
                          <Badge 
                            className={rule.is_active 
                              ? "bg-green-100 text-green-800" 
                              : "bg-slate-100 text-slate-800"
                            }
                          >
                            {rule.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleEdit(rule)}>
                                <Edit className="w-4 h-4 mr-2" />
                                Edit Rule
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => toggleActiveMutation.mutate({ id: rule.id, isActive: rule.is_active })}
                              >
                                {rule.is_active ? (
                                  <>
                                    <XCircle className="w-4 h-4 mr-2" />
                                    Deactivate
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle2 className="w-4 h-4 mr-2" />
                                    Activate
                                  </>
                                )}
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => handleDelete(rule.id)}
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

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>
              {selectedRule ? "Edit Validation Rule" : "Add New Validation Rule"}
            </DialogTitle>
          </DialogHeader>
          <CustomValidationRuleForm
            rule={selectedRule}
            onSubmit={(data) => {
              if (selectedRule) {
                updateMutation.mutate({ id: selectedRule.id, data });
              } else {
                createMutation.mutate(data);
              }
            }}
            onCancel={() => {
              setShowForm(false);
              setSelectedRule(null);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}