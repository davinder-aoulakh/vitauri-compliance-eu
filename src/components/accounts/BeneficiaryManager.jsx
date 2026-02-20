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
  MapPin,
  CheckCircle2,
  AlertCircle,
  PlayCircle,
  Users,
  Eye,
  MoreVertical,
  XCircle,
  AlertTriangle,
  History,
  Globe
} from "lucide-react";
import { format } from "date-fns";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import BeneficiaryAuditLog from "./BeneficiaryAuditLog";
import CountrySelect from "../shared/CountrySelect";
import BeneficiaryClassification from "./BeneficiaryClassification";
import BeneficiaryDetails from "./BeneficiaryDetails";

export default function BeneficiaryManager({ account, tenant }) {
  const [showForm, setShowForm] = useState(false);
  const [showClassification, setShowClassification] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [editingBeneficiary, setEditingBeneficiary] = useState(null);
  const [selectedBeneficiary, setSelectedBeneficiary] = useState(null);
  const [detailsBeneficiary, setDetailsBeneficiary] = useState(null);
  const [historyBeneficiary, setHistoryBeneficiary] = useState(null);

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
    setDetailsBeneficiary(beneficiary);
    setShowDetails(true);
  };

  const handleViewHistory = (beneficiary) => {
    setHistoryBeneficiary(beneficiary);
    setShowHistory(true);
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
  const nonReportableBeneficiaries = beneficiaries.filter(b => b.reportability_status === "non_reportable");
  const pendingBeneficiaries = beneficiaries.filter(b => b.reportability_status === "pending_review");

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-transparent">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 text-purple-600" />
                Beneficiaries
              </CardTitle>
              <CardDescription className="mt-1">
                Individuals who will receive benefits from this deceased account holder
              </CardDescription>
            </div>
            <Button
              onClick={() => {
                setEditingBeneficiary(null);
                setShowForm(true);
              }}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Beneficiary
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center p-4 rounded-lg bg-slate-50 border border-slate-200">
              <p className="text-2xl font-bold text-slate-900">{beneficiaries.length}</p>
              <p className="text-xs text-slate-600">Total Beneficiaries</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-green-50 border border-green-200">
              <p className="text-2xl font-bold text-green-600">
                {nonReportableBeneficiaries.length}
              </p>
              <p className="text-xs text-green-700">Non-Reportable</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-amber-50 border border-amber-200">
              <p className="text-2xl font-bold text-amber-600">
                {reportableBeneficiaries.length}
              </p>
              <p className="text-xs text-amber-700">Reportable</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-yellow-50 border border-yellow-200">
              <p className="text-2xl font-bold text-yellow-600">
                {pendingBeneficiaries.length}
              </p>
              <p className="text-xs text-yellow-700">Pending Review</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Beneficiaries Table */}
      <Card className="border-0 shadow-lg">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
            </div>
          ) : beneficiaries.length === 0 ? (
            <div className="p-12 text-center">
              <Users className="w-16 h-16 mx-auto mb-4 text-slate-300" />
              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                No Beneficiaries Added
              </h3>
              <p className="text-slate-600 mb-6">
                Add beneficiaries to track who will receive benefits from this deceased account holder.
              </p>
              <Button
                onClick={() => setShowForm(true)}
                className="bg-purple-600 hover:bg-purple-700 text-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add First Beneficiary
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/50">
                    <TableHead>Name</TableHead>
                    <TableHead>Date of Birth</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead>Tax Residencies</TableHead>
                    <TableHead>Reportability</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {beneficiaries.map((beneficiary) => (
                    <TableRow key={beneficiary.id} className="hover:bg-slate-50/50">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div>
                            <p className="font-semibold text-slate-900">
                              {beneficiary.first_name && beneficiary.last_name
                                ? `${beneficiary.first_name} ${beneficiary.last_name}`
                                : beneficiary.full_name || "N/A"}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-slate-700">
                          {beneficiary.date_of_birth ? format(new Date(beneficiary.date_of_birth), 'MMM d, yyyy') : '—'}
                        </span>
                      </TableCell>
                      <TableCell>
                        {beneficiary.address?.country ? (
                          <span className="text-sm text-slate-700">
                            {beneficiary.address.city ? `${beneficiary.address.city}, ` : ''}
                            {beneficiary.address.country}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {beneficiary.tax_residencies && beneficiary.tax_residencies.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {beneficiary.tax_residencies.map((res, idx) => (
                              <Badge key={idx} variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">
                                <Globe className="w-3 h-3 mr-1" />
                                {res.country}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {beneficiary.reportability_status === 'reportable' ? (
                          <Badge className="bg-green-100 text-green-800 border-green-200">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Reportable
                          </Badge>
                        ) : beneficiary.reportability_status === 'non_reportable' ? (
                          <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-200">
                            <XCircle className="w-3 h-3 mr-1" />
                            Non-Reportable
                          </Badge>
                        ) : (
                          <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            Pending Review
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleClassify(beneficiary)}
                            className="text-purple-600 border-purple-200 hover:bg-purple-50"
                          >
                            <PlayCircle className="w-4 h-4 mr-1" />
                            {beneficiary.reportability_status === "pending_review" || !beneficiary.reportability_status ? "Classify" : "Re-Classify"}
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleViewDetails(beneficiary)}>
                                <Eye className="w-4 h-4 mr-2" />
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleViewHistory(beneficiary)}>
                                <History className="w-4 h-4 mr-2" />
                                View History
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleEdit(beneficiary)}>
                                <Edit className="w-4 h-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleDelete(beneficiary.id)}
                                className="text-red-600"
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reportability Summary */}
      {beneficiaries.length > 0 && (
        <Alert className={reportableBeneficiaries.length > 0 ? "bg-green-50 border-green-200" : "bg-slate-50 border-slate-200"}>
          {reportableBeneficiaries.length > 0 ? (
            <>
              <CheckCircle2 className="w-4 h-4 text-green-600" />
              <AlertDescription className="text-sm text-green-900">
                <strong>Reportable Beneficiaries:</strong> {reportableBeneficiaries.length} beneficiary{reportableBeneficiaries.length !== 1 ? '(ies) are' : ' is'} tax resident in foreign CRS participating jurisdictions. 
                Their information will be included in CRS XML reporting.
              </AlertDescription>
            </>
          ) : (
            <>
              <XCircle className="w-4 h-4 text-slate-600" />
              <AlertDescription className="text-sm text-slate-700">
                <strong>No Reportable Beneficiaries:</strong> No beneficiaries are tax resident in foreign jurisdictions. 
                This account does not require CRS reporting for beneficiaries.
              </AlertDescription>
            </>
          )}
        </Alert>
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
              Beneficiary Details
            </DialogTitle>
          </DialogHeader>
          {detailsBeneficiary && (
            <BeneficiaryDetails
              beneficiary={detailsBeneficiary}
              account={account}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>
              Classification History
            </DialogTitle>
          </DialogHeader>
          {historyBeneficiary && (
            <BeneficiaryAuditLog beneficiary={historyBeneficiary} />
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