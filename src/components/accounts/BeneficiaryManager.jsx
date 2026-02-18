import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Plus,
  Trash2,
  Edit,
  User,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Clock,
  PlayCircle,
  Users,
  Eye
} from "lucide-react";
import CountrySelect from "../shared/CountrySelect";
import BeneficiaryClassification from "./BeneficiaryClassification";
import BeneficiaryDetails from "./BeneficiaryDetails";

export default function BeneficiaryManager({ account, tenant }) {
  const [showForm, setShowForm] = useState(false);
  const [showClassification, setShowClassification] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [editingBeneficiary, setEditingBeneficiary] = useState(null);
  const [selectedBeneficiary, setSelectedBeneficiary] = useState(null);

  const queryClient = useQueryClient();

  const { data: beneficiaries = [], isLoading } = useQuery({
    queryKey: ['beneficiaries', account?.id],
    queryFn: () => base44.entities.Beneficiary.filter({ account_id: account?.id }),
    enabled: !!account?.id
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Beneficiary.create({
      ...data,
      tenant_id: tenant?.id || account?.tenant_id,
      account_id: account.id
    }),
    onSuccess: () => {
      queryClient.invalidateQueries(['beneficiaries', account?.id]);
      setShowForm(false);
      setEditingBeneficiary(null);
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Beneficiary.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['beneficiaries', account?.id]);
      setShowForm(false);
      setEditingBeneficiary(null);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Beneficiary.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['beneficiaries', account?.id]);
    }
  });

  const handleEdit = (beneficiary) => {
    setEditingBeneficiary(beneficiary);
    setShowForm(true);
  };

  const handleDelete = (id) => {
    if (confirm("Delete this beneficiary?")) {
      deleteMutation.mutate(id);
    }
  };

  const handleClassify = (beneficiary) => {
    setSelectedBeneficiary(beneficiary);
    setShowClassification(true);
  };

  const handleViewDetails = (beneficiary) => {
    setSelectedBeneficiary(beneficiary);
    setShowDetails(true);
  };

  const handleClassificationComplete = async (classificationData) => {
    if (selectedBeneficiary) {
      await updateMutation.mutateAsync({
        id: selectedBeneficiary.id,
        data: classificationData
      });
      setShowClassification(false);
      setSelectedBeneficiary(null);
    }
  };

  const getStatusBadge = (status) => {
    const config = {
      reportable: { label: "Reportable", color: "bg-green-100 text-green-800", icon: CheckCircle2 },
      non_reportable: { label: "Non-Reportable", color: "bg-slate-100 text-slate-800", icon: CheckCircle2 },
      pending_review: { label: "Pending Review", color: "bg-amber-100 text-amber-800", icon: Clock },
      excluded: { label: "Excluded", color: "bg-red-100 text-red-800", icon: AlertCircle }
    };
    const { label, color, icon: Icon } = config[status] || config.pending_review;
    return (
      <Badge className={`${color} flex items-center gap-1`}>
        <Icon className="w-3 h-3" />
        {label}
      </Badge>
    );
  };

  const reportableBeneficiaries = beneficiaries.filter(b => b.reportability_status === "reportable");
  const pendingBeneficiaries = beneficiaries.filter(b => b.reportability_status === "pending_review");

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-purple-600" />
          <h3 className="text-sm font-semibold text-slate-700">
            Beneficiaries ({beneficiaries.length})
          </h3>
        </div>
        <Button
          type="button"
          size="sm"
          onClick={() => {
            setEditingBeneficiary(null);
            setShowForm(true);
          }}
          className="bg-purple-600 hover:bg-purple-700 text-white"
        >
          <Plus className="w-4 h-4 mr-1" />
          Add Beneficiary
        </Button>
      </div>

      {/* Summary Alert */}
      {beneficiaries.length > 0 && (
        <Alert className={`${
          reportableBeneficiaries.length > 0 
            ? "bg-amber-50 border-amber-200" 
            : pendingBeneficiaries.length > 0
              ? "bg-blue-50 border-blue-200"
              : "bg-green-50 border-green-200"
        }`}>
          <Users className={`w-4 h-4 ${
            reportableBeneficiaries.length > 0 ? "text-amber-600" : 
            pendingBeneficiaries.length > 0 ? "text-blue-600" : "text-green-600"
          }`} />
          <AlertDescription className="text-sm">
            {reportableBeneficiaries.length > 0 ? (
              <span className="text-amber-900">
                <strong>{reportableBeneficiaries.length}</strong> beneficiary(ies) are reportable
              </span>
            ) : pendingBeneficiaries.length > 0 ? (
              <span className="text-blue-900">
                <strong>{pendingBeneficiaries.length}</strong> beneficiary(ies) pending classification
              </span>
            ) : (
              <span className="text-green-900">
                All beneficiaries have been classified
              </span>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Beneficiaries List */}
      {isLoading ? (
        <div className="text-center py-8 text-slate-500">Loading beneficiaries...</div>
      ) : beneficiaries.length === 0 ? (
        <div className="text-center py-8 border-2 border-dashed border-slate-200 rounded-lg">
          <Users className="w-12 h-12 mx-auto mb-3 text-slate-300" />
          <p className="text-slate-600 mb-2">No beneficiaries added yet</p>
          <p className="text-xs text-slate-500">
            Add beneficiaries who will inherit this account
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {beneficiaries.map((beneficiary) => (
            <Card key={beneficiary.id} className="border border-slate-200">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                      <User className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-900">
                        {beneficiary.first_name && beneficiary.last_name 
                          ? `${beneficiary.first_name} ${beneficiary.last_name}`
                          : beneficiary.full_name || "N/A"}
                      </h4>
                      {beneficiary.address?.country && (
                        <div className="flex items-center gap-1 text-sm text-slate-600 mt-1">
                          <MapPin className="w-3 h-3" />
                          {[
                            beneficiary.address.city,
                            beneficiary.address.country
                          ].filter(Boolean).join(", ")}
                        </div>
                      )}
                      <div className="mt-2">
                        {getStatusBadge(beneficiary.reportability_status)}
                      </div>
                      {beneficiary.reportability_reason && (
                        <p className="text-xs text-slate-500 mt-1">
                          {beneficiary.reportability_reason}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleViewDetails(beneficiary);
                      }}
                      className="text-purple-600 border-purple-200 hover:bg-purple-50"
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleClassify(beneficiary);
                      }}
                      className="text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                    >
                      <PlayCircle className="w-4 h-4 mr-1" />
                      Classify
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleEdit(beneficiary);
                      }}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleDelete(beneficiary.id);
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

      {/* Add/Edit Beneficiary Dialog */}
      {showForm && (
        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogContent className="max-w-2xl" onInteractOutside={(e) => e.preventDefault()}>
            <DialogHeader>
              <DialogTitle>
                {editingBeneficiary ? "Edit Beneficiary" : "Add Beneficiary"}
              </DialogTitle>
            </DialogHeader>
            <BeneficiaryForm
              beneficiary={editingBeneficiary}
              onSubmit={(data) => {
                if (editingBeneficiary) {
                  updateMutation.mutate({ id: editingBeneficiary.id, data });
                } else {
                  createMutation.mutate(data);
                }
              }}
              onCancel={() => {
                setShowForm(false);
                setEditingBeneficiary(null);
              }}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Classification Dialog */}
      <Dialog open={showClassification} onOpenChange={setShowClassification}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>
              Classify Beneficiary: {selectedBeneficiary?.first_name && selectedBeneficiary?.last_name 
                ? `${selectedBeneficiary.first_name} ${selectedBeneficiary.last_name}`
                : selectedBeneficiary?.full_name}
            </DialogTitle>
          </DialogHeader>
          {selectedBeneficiary && (
            <BeneficiaryClassification
              beneficiary={selectedBeneficiary}
              account={account}
              onComplete={handleClassificationComplete}
              onCancel={() => {
                setShowClassification(false);
                setSelectedBeneficiary(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Details Dialog */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>
              Beneficiary Details: {selectedBeneficiary?.first_name && selectedBeneficiary?.last_name 
                ? `${selectedBeneficiary.first_name} ${selectedBeneficiary.last_name}`
                : selectedBeneficiary?.full_name}
            </DialogTitle>
          </DialogHeader>
          {selectedBeneficiary && (
            <BeneficiaryDetails
              beneficiary={selectedBeneficiary}
              account={account}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Beneficiary Form Component
function BeneficiaryForm({ beneficiary, onSubmit, onCancel }) {
  const [formData, setFormData] = useState({
    first_name: beneficiary?.first_name || "",
    last_name: beneficiary?.last_name || "",
    date_of_birth: beneficiary?.date_of_birth || "",
    place_of_birth: beneficiary?.place_of_birth || "",
    address: beneficiary?.address || {
      street: "",
      city: "",
      state: "",
      postal_code: "",
      country: ""
    }
  });

  const handleAddressChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      address: { ...prev.address, [field]: value }
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
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
          <Label htmlFor="place_of_birth">Place of Birth</Label>
          <div className="mt-1.5">
            <CountrySelect
              value={formData.place_of_birth}
              onValueChange={(value) => setFormData({ ...formData, place_of_birth: value })}
              placeholder="Select country..."
            />
          </div>
        </div>
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
            <Label htmlFor="country">Country *</Label>
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

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button 
          type="submit" 
          className="bg-purple-600 hover:bg-purple-700 text-white"
          disabled={!formData.first_name || !formData.last_name}
        >
          {beneficiary ? "Update Beneficiary" : "Add Beneficiary"}
        </Button>
      </div>
    </form>
  );
}