import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Trash2,
  Edit,
  User,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Clock,
  Users,
  Globe,
  GitBranch
} from "lucide-react";
import CountrySelect from "../shared/CountrySelect";
import WorkflowRunner from "../workflows/WorkflowRunner";

export default function ControllingPersonManager({ account, tenant }) {
  const [showForm, setShowForm] = useState(false);
  const [editingPerson, setEditingPerson] = useState(null);
  const [showClassification, setShowClassification] = useState(false);
  const [classifyingPerson, setClassifyingPerson] = useState(null);

  const queryClient = useQueryClient();

  const { data: controllingPersons = [], isLoading } = useQuery({
    queryKey: ['controlling-persons', account?.id],
    queryFn: () => base44.entities.ControllingPerson.filter({ account_id: account?.id }),
    enabled: !!account?.id
  });

  const { data: workflows = [] } = useQuery({
    queryKey: ['workflows'],
    queryFn: () => base44.entities.Workflow.filter({ 
      workflow_type: 'controlling_person_classification',
      status: 'published'
    })
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.ControllingPerson.create({
      ...data,
      tenant_id: tenant?.id || account?.tenant_id,
      account_id: account.id
    }),
    onSuccess: () => {
      queryClient.invalidateQueries(['controlling-persons', account?.id]);
      setShowForm(false);
      setEditingPerson(null);
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ControllingPerson.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['controlling-persons', account?.id]);
      setShowForm(false);
      setEditingPerson(null);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ControllingPerson.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['controlling-persons', account?.id]);
    }
  });

  const handleEdit = (person) => {
    setEditingPerson(person);
    setShowForm(true);
  };

  const handleDelete = (id) => {
    if (confirm("Delete this controlling person?")) {
      deleteMutation.mutate(id);
    }
  };

  const handleClassify = (person) => {
    setClassifyingPerson(person);
    setShowClassification(true);
  };

  const handleClassificationComplete = async (answers) => {
    const finalStep = answers[answers.length - 1];
    const isReportable = finalStep?.result_status === 'reportable';
    
    await base44.entities.ControllingPerson.update(classifyingPerson.id, {
      is_reportable: isReportable,
      classification_answers: answers
    });
    
    queryClient.invalidateQueries(['controlling-persons', account?.id]);
    setShowClassification(false);
    setClassifyingPerson(null);
  };

  const getStatusBadge = (isReportable) => {
    if (isReportable) {
      return (
        <Badge className="bg-green-100 text-green-800 flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3" />
          Reportable
        </Badge>
      );
    }
    return (
      <Badge className="bg-slate-100 text-slate-800 flex items-center gap-1">
        <AlertCircle className="w-3 h-3" />
        Non-Reportable
      </Badge>
    );
  };

  const reportablePersons = controllingPersons.filter(p => p.is_reportable);
  const pendingPersons = controllingPersons.filter(p => p.is_reportable === undefined || p.is_reportable === null);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-indigo-600" />
          <h3 className="text-sm font-semibold text-slate-700">
            Controlling Persons ({controllingPersons.length})
          </h3>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setEditingPerson(null);
            setShowForm(true);
          }}
          className="bg-indigo-600 hover:bg-indigo-700 text-white"
        >
          <Plus className="w-4 h-4 mr-1" />
          Add Controlling Person
        </Button>
      </div>

      {/* Summary Alert */}
      {controllingPersons.length > 0 && (
        <Alert className={`${
          reportablePersons.length > 0 
            ? "bg-green-50 border-green-200" 
            : pendingPersons.length > 0
              ? "bg-blue-50 border-blue-200"
              : "bg-slate-50 border-slate-200"
        }`}>
          <Users className={`w-4 h-4 ${
            reportablePersons.length > 0 ? "text-green-600" : 
            pendingPersons.length > 0 ? "text-blue-600" : "text-slate-600"
          }`} />
          <AlertDescription className="text-sm">
            {reportablePersons.length > 0 ? (
              <span className="text-green-900">
                <strong>{reportablePersons.length}</strong> controlling person(s) are reportable (foreign tax resident)
              </span>
            ) : pendingPersons.length > 0 ? (
              <span className="text-blue-900">
                <strong>{pendingPersons.length}</strong> controlling person(s) pending review
              </span>
            ) : (
              <span className="text-slate-900">
                No controlling persons are reportable
              </span>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Controlling Persons List */}
      {isLoading ? (
        <div className="text-center py-8 text-slate-500">Loading controlling persons...</div>
      ) : controllingPersons.length === 0 ? (
        <div className="text-center py-8 border-2 border-dashed border-slate-200 rounded-lg">
          <Users className="w-12 h-12 mx-auto mb-3 text-slate-300" />
          <p className="text-slate-600 mb-2">No controlling persons added yet</p>
          <p className="text-xs text-slate-500">
            Add individuals who exercise control over this entity (&gt;25% ownership or senior management)
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {controllingPersons.map((person) => (
            <Card key={person.id} className="border border-slate-200">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                      <User className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-900">
                        {person.first_name && person.last_name 
                          ? `${person.first_name} ${person.last_name}`
                          : person.full_name || "N/A"}
                      </h4>
                      <div className="flex items-center gap-3 text-sm text-slate-600 mt-1">
                        {person.control_type && (
                          <Badge variant="outline" className="capitalize text-xs">
                            {person.control_type?.replace(/_/g, ' ')}
                          </Badge>
                        )}
                        {person.ownership_percentage > 0 && (
                          <span className="text-xs">{person.ownership_percentage}% ownership</span>
                        )}
                      </div>
                      {person.address?.country && (
                        <div className="flex items-center gap-1 text-sm text-slate-600 mt-1">
                          <MapPin className="w-3 h-3" />
                          {[
                            person.address.city,
                            person.address.country
                          ].filter(Boolean).join(", ")}
                        </div>
                      )}
                      {person.tax_residencies && person.tax_residencies.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {person.tax_residencies.map((res, idx) => (
                            <Badge key={idx} variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">
                              <Globe className="w-3 h-3 mr-1" />
                              {res.country}
                            </Badge>
                          ))}
                        </div>
                      )}
                      <div className="mt-2">
                        {getStatusBadge(person.is_reportable)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {workflows.length > 0 && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleClassify(person);
                        }}
                        className="text-indigo-600 hover:text-indigo-700"
                      >
                        <GitBranch className="w-4 h-4" />
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleEdit(person);
                      }}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleDelete(person.id);
                      }}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit Controlling Person Dialog */}
      {showForm && (
        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" onInteractOutside={(e) => e.preventDefault()}>
            <DialogHeader>
              <DialogTitle>
                {editingPerson ? "Edit Controlling Person" : "Add Controlling Person"}
              </DialogTitle>
            </DialogHeader>
            <ControllingPersonForm
              person={editingPerson}
              onSubmit={(data) => {
                if (editingPerson) {
                  updateMutation.mutate({ id: editingPerson.id, data });
                } else {
                  createMutation.mutate(data);
                }
              }}
              onCancel={() => {
                setShowForm(false);
                setEditingPerson(null);
              }}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Classification Workflow Dialog */}
      {showClassification && workflows.length > 0 && classifyingPerson && (
        <Dialog open={showClassification} onOpenChange={setShowClassification}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                Classify Controlling Person: {classifyingPerson.first_name && classifyingPerson.last_name 
                  ? `${classifyingPerson.first_name} ${classifyingPerson.last_name}`
                  : classifyingPerson.full_name}
              </DialogTitle>
            </DialogHeader>
            <WorkflowRunner
              workflow={workflows[0]}
              initialData={{ controlling_person: classifyingPerson, account }}
              onComplete={handleClassificationComplete}
              onCancel={() => setShowClassification(false)}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// Controlling Person Form Component
function ControllingPersonForm({ person, onSubmit, onCancel }) {
  const [formData, setFormData] = useState({
    first_name: person?.first_name || "",
    last_name: person?.last_name || "",
    date_of_birth: person?.date_of_birth || "",
    control_type: person?.control_type || "ownership",
    ownership_percentage: person?.ownership_percentage || 0,
    is_reportable: person?.is_reportable || false,
    address: person?.address || {
      street: "",
      city: "",
      state: "",
      postal_code: "",
      country: ""
    },
    tax_residencies: person?.tax_residencies || []
  });

  const handleAddressChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      address: { ...prev.address, [field]: value }
    }));
  };

  const handleAddTaxResidency = () => {
    setFormData(prev => ({
      ...prev,
      tax_residencies: [...prev.tax_residencies, { country: "", tin: "", tin_unavailable_reason: "" }]
    }));
  };

  const handleRemoveTaxResidency = (index) => {
    setFormData(prev => ({
      ...prev,
      tax_residencies: prev.tax_residencies.filter((_, i) => i !== index)
    }));
  };

  const handleTaxResidencyChange = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      tax_residencies: prev.tax_residencies.map((r, i) => 
        i === index ? { ...r, [field]: value } : r
      )
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // Auto-determine reportability based on foreign tax residencies
    const hasForeignResidency = formData.tax_residencies.some(r => r.country);
    onSubmit({
      ...formData,
      is_reportable: hasForeignResidency
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="first_name">First Name *</Label>
          <Input
            id="first_name"
            value={formData.first_name}
            onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
            placeholder="First name"
            required
            className="mt-1.5"
          />
        </div>

        <div>
          <Label htmlFor="last_name">Last Name *</Label>
          <Input
            id="last_name"
            value={formData.last_name}
            onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
            placeholder="Last name"
            required
            className="mt-1.5"
          />
        </div>

        <div>
          <Label htmlFor="date_of_birth">Date of Birth</Label>
          <Input
            id="date_of_birth"
            type="date"
            value={formData.date_of_birth}
            onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
            className="mt-1.5"
          />
        </div>

        <div>
          <Label htmlFor="control_type">Control Type</Label>
          <Select
            value={formData.control_type}
            onValueChange={(value) => setFormData({ ...formData, control_type: value })}
          >
            <SelectTrigger className="mt-1.5">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ownership">Ownership</SelectItem>
              <SelectItem value="senior_management">Senior Management</SelectItem>
              <SelectItem value="other_means">Other Means</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {formData.control_type === "ownership" && (
          <div>
            <Label htmlFor="ownership_percentage">Ownership Percentage</Label>
            <Input
              id="ownership_percentage"
              type="number"
              min="0"
              max="100"
              value={formData.ownership_percentage}
              onChange={(e) => setFormData({ ...formData, ownership_percentage: parseFloat(e.target.value) || 0 })}
              className="mt-1.5"
            />
          </div>
        )}
      </div>

      {/* Address Section */}
      <div className="pt-4 border-t">
        <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
          <MapPin className="w-4 h-4" />
          Address
        </h4>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Label htmlFor="street">Street Address</Label>
            <Input
              id="street"
              value={formData.address.street}
              onChange={(e) => handleAddressChange("street", e.target.value)}
              placeholder="123 Main Street"
              className="mt-1.5"
            />
          </div>

          <div>
            <Label htmlFor="city">City</Label>
            <Input
              id="city"
              value={formData.address.city}
              onChange={(e) => handleAddressChange("city", e.target.value)}
              placeholder="City"
              className="mt-1.5"
            />
          </div>

          <div>
            <Label htmlFor="state">State/Province</Label>
            <Input
              id="state"
              value={formData.address.state}
              onChange={(e) => handleAddressChange("state", e.target.value)}
              placeholder="State/Province"
              className="mt-1.5"
            />
          </div>

          <div>
            <Label htmlFor="postal_code">Postal Code</Label>
            <Input
              id="postal_code"
              value={formData.address.postal_code}
              onChange={(e) => handleAddressChange("postal_code", e.target.value)}
              placeholder="Postal Code"
              className="mt-1.5"
            />
          </div>

          <div>
            <Label htmlFor="country">Country</Label>
            <div className="mt-1.5">
              <CountrySelect
                value={formData.address.country}
                onValueChange={(value) => handleAddressChange("country", value)}
                placeholder="Select country..."
              />
            </div>
          </div>
        </div>
      </div>

      {/* Tax Residencies Section */}
      <div className="pt-4 border-t">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <Globe className="w-4 h-4" />
            Tax Residencies
          </h4>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleAddTaxResidency}
          >
            <Plus className="w-3 h-3 mr-1" />
            Add Tax Residency
          </Button>
        </div>

        {formData.tax_residencies.length === 0 ? (
          <p className="text-sm text-slate-500 italic">No tax residencies added</p>
        ) : (
          <div className="space-y-3">
            {formData.tax_residencies.map((residency, index) => (
              <div key={index} className="grid grid-cols-3 gap-3 p-3 bg-slate-50 rounded-lg">
                <div>
                  <Label className="text-xs">Country</Label>
                  <div className="mt-1">
                    <CountrySelect
                      value={residency.country}
                      onValueChange={(value) => handleTaxResidencyChange(index, "country", value)}
                      placeholder="Select..."
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">TIN</Label>
                  <Input
                    value={residency.tin}
                    onChange={(e) => handleTaxResidencyChange(index, "tin", e.target.value)}
                    placeholder="Tax ID Number"
                    className="mt-1 h-9"
                  />
                </div>
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <Label className="text-xs">TIN Unavailable Reason</Label>
                    <Input
                      value={residency.tin_unavailable_reason}
                      onChange={(e) => handleTaxResidencyChange(index, "tin_unavailable_reason", e.target.value)}
                      placeholder="If no TIN..."
                      className="mt-1 h-9"
                    />
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => handleRemoveTaxResidency(index)}
                    className="text-red-600 h-9"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button 
          type="submit" 
          className="bg-indigo-600 hover:bg-indigo-700 text-white"
          disabled={!formData.first_name || !formData.last_name}
        >
          {person ? "Update Controlling Person" : "Add Controlling Person"}
        </Button>
      </div>
    </form>
  );
}