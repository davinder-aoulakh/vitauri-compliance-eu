import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Plus,
  Trash2,
  User,
  MapPin,
  CheckCircle2,
  Users,
  Globe,
  AlertTriangle,
  Edit,
  XCircle,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import CountrySelect from "../shared/CountrySelect";
import ControllingPersonForm from "./ControllingPersonForm";

export default function ControllingPersonInputRenderer({
  account,
  onControllingPersonsAdded,
  onPersonsChange,
  minPersons = 1,
  initialPersons,
  savedPersons,
}) {
  const queryClient = useQueryClient();

  // ── DB records ──────────────────────────────────────────────────────────────
  const { data: dbCPs = [], isLoading: loadingDB } = useQuery({
    queryKey: ["controlling-persons", account?.id],
    queryFn: () =>
      account?.id
        ? base44.entities.ControllingPerson.filter({ account_id: account.id })
        : [],
    enabled: !!account?.id,
  });

  // ── Dialog state for editing an existing DB record ───────────────────────
  const [editingPerson, setEditingPerson] = useState(null);
  const [showEditDialog, setShowEditDialog] = useState(false);

  // ── Draft form for adding NEW persons ────────────────────────────────────
  const [showAddForm, setShowAddForm] = useState(false);
  const [draft, setDraft] = useState(createEmptyPerson());
  const [draftErrors, setDraftErrors] = useState({});
  const [saving, setSaving] = useState(false);

  // ── Ownership calculations ────────────────────────────────────────────────
  const dbOwnership = dbCPs.reduce((sum, cp) => {
    if (cp.control_type === "legal_person_ownership") {
      return sum + (parseFloat(cp.ownership_percentage) || 0);
    }
    return sum;
  }, 0);

  // When the add-form is open, include draft's ownership in the running total
  const draftOwnership =
    showAddForm && draft.control_type === "legal_person_ownership"
      ? parseFloat(draft.ownership_percentage) || 0
      : 0;

  const totalOwnership = dbOwnership + draftOwnership;
  const remainingOwnership = Math.max(
    0,
    Math.round((100 - dbOwnership) * 10000) / 10000
  );
  const canAddMore = dbOwnership < 100;
  const ownershipExceedsLimit = totalOwnership > 100;

  // ── Mutations ────────────────────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ControllingPerson.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(["controlling-persons", account?.id]);
      toast.success("Controlling person removed.");
    },
    onError: () => toast.error("Failed to remove controlling person."),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) =>
      base44.entities.ControllingPerson.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(["controlling-persons", account?.id]);
      setShowEditDialog(false);
      setEditingPerson(null);
      toast.success("Controlling person updated.");
    },
    onError: () => toast.error("Failed to update controlling person."),
  });

  // ── Helper: create empty draft ────────────────────────────────────────────
  function createEmptyPerson() {
    return {
      first_name: "",
      last_name: "",
      date_of_birth: "",
      control_type: "legal_person_ownership",
      ownership_percentage: 0,
      address: { street: "", city: "", state: "", postal_code: "", country: "" },
      tax_residencies: [{ country: "", tin: "" }],
    };
  }

  // ── Draft handlers ────────────────────────────────────────────────────────
  const handleDraftChange = (field, value) => {
    setDraft((prev) => {
      if (field.startsWith("address.")) {
        const af = field.replace("address.", "");
        return { ...prev, address: { ...prev.address, [af]: value } };
      }
      return { ...prev, [field]: value };
    });
    if (draftErrors[field]) {
      setDraftErrors((prev) => { const n = { ...prev }; delete n[field]; return n; });
    }
  };

  const handleTaxResidencyChange = (idx, field, value) => {
    const updated = [...(draft.tax_residencies || [])];
    updated[idx] = { ...updated[idx], [field]: value };
    setDraft((prev) => ({ ...prev, tax_residencies: updated }));
  };

  const handleAddTaxResidency = () => {
    setDraft((prev) => ({
      ...prev,
      tax_residencies: [...(prev.tax_residencies || []), { country: "", tin: "" }],
    }));
  };

  const handleRemoveTaxResidency = (idx) => {
    if (draft.tax_residencies.length <= 1) return;
    setDraft((prev) => ({
      ...prev,
      tax_residencies: prev.tax_residencies.filter((_, i) => i !== idx),
    }));
  };

  // ── Validate draft ────────────────────────────────────────────────────────
  const validateDraft = () => {
    const errs = {};
    if (!draft.first_name?.trim()) errs["first_name"] = "First name is required";
    if (!draft.last_name?.trim()) errs["last_name"] = "Last name is required";
    if (!draft.address?.country) errs["address.country"] = "Country is required";
    setDraftErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // ── Save draft → DB ───────────────────────────────────────────────────────
  const handleSaveDraft = async () => {
    if (!validateDraft()) return;
    if (ownershipExceedsLimit) {
      toast.error(
        `Total ownership (${totalOwnership.toFixed(1)}%) exceeds 100%. Correct before saving.`
      );
      return;
    }

    setSaving(true);
    try {
      // Dedup check
      const nameKey = `${draft.first_name.toLowerCase().trim()}|${draft.last_name.toLowerCase().trim()}`;
      const existingKey = dbCPs.find(
        (cp) =>
          `${(cp.first_name || "").toLowerCase().trim()}|${(cp.last_name || "").toLowerCase().trim()}` ===
          nameKey
      );
      if (existingKey) {
        toast.warning(
          `${draft.first_name} ${draft.last_name} already exists for this account.`
        );
        setSaving(false);
        return;
      }

      const created = await base44.entities.ControllingPerson.create({
        tenant_id: account?.tenant_id,
        account_id: account.id,
        first_name: draft.first_name,
        last_name: draft.last_name,
        date_of_birth: draft.date_of_birth || null,
        control_type: draft.control_type,
        ownership_percentage: parseFloat(draft.ownership_percentage) || 0,
        address: draft.address,
        tax_residencies: draft.tax_residencies?.filter((tr) => tr.country) || [],
        is_reportable: null,
      });

      await queryClient.invalidateQueries(["controlling-persons", account?.id]);
      toast.success(`${created.first_name} ${created.last_name} added successfully!`);

      // Reset draft & hide form
      setDraft(createEmptyPerson());
      setDraftErrors({});
      setShowAddForm(false);
    } catch (err) {
      console.error("[ControllingPersonInputRenderer] Save error:", err);
      toast.error("Failed to save controlling person.");
    } finally {
      setSaving(false);
    }
  };

  // ── "Confirm & Continue" — passes saved DB records up to WorkflowRunner ──
  const handleConfirmAndContinue = () => {
    if (dbCPs.length === 0) {
      toast.error("Please add at least one controlling person before continuing.");
      return;
    }
    if (onControllingPersonsAdded) {
      onControllingPersonsAdded(dbCPs);
    }
  };

  const alreadySaved = savedPersons && savedPersons.length > 0;

  // ── Reportability badge helper ────────────────────────────────────────────
  const reportabilityBadge = (cp) => {
    if (cp.is_reportable === true)
      return (
        <Badge className="bg-green-100 text-green-800 border-green-200 text-xs">
          <CheckCircle2 className="w-3 h-3 mr-1" />Reportable
        </Badge>
      );
    if (cp.is_reportable === false)
      return (
        <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-200 text-xs">
          <XCircle className="w-3 h-3 mr-1" />Non-Reportable
        </Badge>
      );
    return (
      <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200 text-xs">
        <AlertTriangle className="w-3 h-3 mr-1" />Pending
      </Badge>
    );
  };

  return (
    <div className="space-y-4">
      {/* ── Instruction banner ── */}
      <Alert className="bg-purple-50 border-purple-200">
        <Users className="w-4 h-4 text-purple-600" />
        <AlertDescription className="text-sm text-purple-900">
          <strong>Controlling Persons:</strong> Identify individuals who exercise control over
          this entity (&gt;25% ownership or senior management). Any controlling person with
          foreign tax residency makes this account reportable for the controlling persons if
          resident in a CRS participating jurisdiction.
        </AlertDescription>
      </Alert>

      {/* ── "Already saved" success banner ── */}
      {alreadySaved && (
        <Alert className="bg-green-50 border-green-200">
          <CheckCircle2 className="w-4 h-4 text-green-600" />
          <AlertDescription className="text-sm text-green-900">
            <strong>Confirmed:</strong> {savedPersons.length} controlling person(s) saved for
            this account.
          </AlertDescription>
        </Alert>
      )}

      {/* ── Ownership summary bar ── */}
      {!loadingDB && dbCPs.some((cp) => cp.control_type === "legal_person_ownership") && (
        <div
          className={`flex items-center justify-between px-4 py-2.5 rounded-lg border text-sm font-medium ${
            dbOwnership > 100
              ? "bg-red-50 border-red-300 text-red-700"
              : dbOwnership === 100
              ? "bg-green-50 border-green-300 text-green-700"
              : "bg-slate-50 border-slate-200 text-slate-700"
          }`}
        >
          <span className="flex items-center gap-2">
            {dbOwnership > 100 && <AlertTriangle className="w-4 h-4" />}
            Total Ownership Allocated
          </span>
          <span className={`text-base font-bold ${dbOwnership > 100 ? "text-red-700" : dbOwnership === 100 ? "text-green-700" : "text-slate-900"}`}>
            {dbOwnership.toFixed(1)}% / 100%
            {dbOwnership < 100 && (
              <span className="ml-2 text-xs font-normal text-blue-600">
                ({remainingOwnership}% remaining)
              </span>
            )}
          </span>
        </div>
      )}

      {/* ── Existing DB records table ── */}
      {loadingDB ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600"></div>
          <span className="ml-2 text-sm text-slate-600">Loading existing records…</span>
        </div>
      ) : dbCPs.length > 0 ? (
        <Card className="border border-purple-100 shadow-sm">
          <CardHeader className="py-3 px-4 bg-purple-50/50 border-b border-purple-100">
            <CardTitle className="text-sm font-semibold text-purple-900 flex items-center gap-2">
              <Users className="w-4 h-4" />
              Existing Controlling Persons ({dbCPs.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/50">
                    <TableHead className="text-xs">Name</TableHead>
                    <TableHead className="text-xs">Control Type</TableHead>
                    <TableHead className="text-xs">Ownership</TableHead>
                    <TableHead className="text-xs">Tax Residencies</TableHead>
                    <TableHead className="text-xs">Reportability</TableHead>
                    <TableHead className="text-xs text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dbCPs.map((cp) => (
                    <TableRow key={cp.id} className="hover:bg-purple-50/30">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                            <User className="w-3.5 h-3.5 text-purple-600" />
                          </div>
                          <div>
                            <p className="font-medium text-slate-900 text-sm">
                              {cp.first_name && cp.last_name
                                ? `${cp.first_name} ${cp.last_name}`
                                : cp.full_name || "N/A"}
                            </p>
                            {cp.date_of_birth && (
                              <p className="text-xs text-slate-500">{cp.date_of_birth}</p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs capitalize whitespace-nowrap">
                          {cp.control_type?.replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {cp.control_type === "legal_person_ownership" ? (
                          <span className="text-sm font-medium text-slate-800">
                            {cp.ownership_percentage ?? 0}%
                          </span>
                        ) : (
                          <span className="text-slate-400 text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {cp.tax_residencies && cp.tax_residencies.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {cp.tax_residencies.map((res, i) => (
                              <Badge key={i} variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">
                                <Globe className="w-3 h-3 mr-1" />
                                {res.country}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell>{reportabilityBadge(cp)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {!alreadySaved && (
                            <>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
                                onClick={() => {
                                  setEditingPerson(cp);
                                  setShowEditDialog(true);
                                }}
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                onClick={() => {
                                  if (confirm(`Remove ${cp.first_name} ${cp.last_name}?`)) {
                                    deleteMutation.mutate(cp.id);
                                  }
                                }}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="text-center py-6 border-2 border-dashed border-purple-200 rounded-lg bg-purple-50/20">
          <Users className="w-10 h-10 mx-auto mb-2 text-purple-300" />
          <p className="text-sm font-medium text-slate-600">No controlling persons added yet.</p>
          <p className="text-xs text-slate-500 mt-1">Add at least one to proceed.</p>
        </div>
      )}

      {/* ── "Add New" inline form ── */}
      {!alreadySaved && (
        <>
          {!showAddForm ? (
            <div className="flex items-center gap-3">
              {canAddMore ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => { setDraft(createEmptyPerson()); setShowAddForm(true); }}
                  className="border-purple-200 text-purple-700 hover:bg-purple-50"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add {dbCPs.length === 0 ? "Controlling Person" : "Another Controlling Person"}
                </Button>
              ) : (
                <Alert className="w-full bg-slate-50 border-slate-200">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  <AlertDescription className="text-sm text-slate-700">
                    Ownership is fully allocated (100%). No further controlling persons with
                    ownership control can be added.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          ) : (
            // ── Inline Add Form ──────────────────────────────────────────────
            <Card className="border-2 border-purple-200 bg-purple-50/20">
              <CardHeader className="py-3 px-4 border-b border-purple-100 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm font-semibold text-purple-900">
                  New Controlling Person
                </CardTitle>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => { setShowAddForm(false); setDraftErrors({}); }}
                  className="h-7 px-2 text-slate-500"
                >
                  <XCircle className="w-4 h-4" />
                </Button>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                {/* Names */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm">First Name *</Label>
                    <Input
                      value={draft.first_name}
                      onChange={(e) => handleDraftChange("first_name", e.target.value)}
                      placeholder="First name"
                      className={`mt-1 ${draftErrors["first_name"] ? "border-red-500" : ""}`}
                    />
                    {draftErrors["first_name"] && (
                      <p className="text-xs text-red-600 mt-1">{draftErrors["first_name"]}</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-sm">Last Name *</Label>
                    <Input
                      value={draft.last_name}
                      onChange={(e) => handleDraftChange("last_name", e.target.value)}
                      placeholder="Last name"
                      className={`mt-1 ${draftErrors["last_name"] ? "border-red-500" : ""}`}
                    />
                    {draftErrors["last_name"] && (
                      <p className="text-xs text-red-600 mt-1">{draftErrors["last_name"]}</p>
                    )}
                  </div>
                </div>

                {/* DOB & Control Type */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm">Date of Birth</Label>
                    <Input
                      type="date"
                      value={draft.date_of_birth}
                      onChange={(e) => handleDraftChange("date_of_birth", e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-sm">Control Type</Label>
                    <Select
                      value={draft.control_type}
                      onValueChange={(v) => handleDraftChange("control_type", v)}
                    >
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="legal_person_ownership">Control by ownership</SelectItem>
                        <SelectItem value="legal_person_other_means">Control by other means</SelectItem>
                        <SelectItem value="legal_person_senior_managing_official">Senior managing official</SelectItem>
                        <SelectItem value="trust_settlor">Trust – settlor</SelectItem>
                        <SelectItem value="trust_trustee">Trust – trustee</SelectItem>
                        <SelectItem value="trust_protector">Trust – protector</SelectItem>
                        <SelectItem value="trust_beneficiary">Trust – beneficiary</SelectItem>
                        <SelectItem value="trust_other">Trust – other</SelectItem>
                        <SelectItem value="legal_arrangement_settlor_equivalent">Legal arrangement – settlor-equivalent</SelectItem>
                        <SelectItem value="legal_arrangement_trustee_equivalent">Legal arrangement – trustee-equivalent</SelectItem>
                        <SelectItem value="legal_arrangement_protector_equivalent">Legal arrangement – protector-equivalent</SelectItem>
                        <SelectItem value="legal_arrangement_beneficiary_equivalent">Legal arrangement – beneficiary-equivalent</SelectItem>
                        <SelectItem value="legal_arrangement_other_equivalent">Legal arrangement – other-equivalent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Ownership % */}
                {draft.control_type === "legal_person_ownership" && (
                  <div>
                    <Label className="text-sm">
                      Ownership Percentage
                      <span className="ml-2 text-xs font-normal text-blue-600">
                        (max: {remainingOwnership}%)
                      </span>
                    </Label>
                    <Input
                      type="number"
                      min="0"
                      max={remainingOwnership}
                      value={draft.ownership_percentage}
                      onChange={(e) => handleDraftChange("ownership_percentage", e.target.value)}
                      placeholder="e.g., 30"
                      className={`mt-1 ${ownershipExceedsLimit ? "border-red-500" : ""}`}
                    />
                    {ownershipExceedsLimit && (
                      <p className="text-xs text-red-600 mt-1">
                        This would bring total ownership to {totalOwnership.toFixed(1)}%, exceeding
                        100%.
                      </p>
                    )}
                  </div>
                )}

                {/* Address */}
                <div className="pt-3 border-t">
                  <div className="flex items-center gap-2 mb-3">
                    <MapPin className="w-4 h-4 text-slate-500" />
                    <span className="text-sm font-medium text-slate-700">Address</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <Label className="text-xs">Street Address</Label>
                      <Input
                        value={draft.address.street}
                        onChange={(e) => handleDraftChange("address.street", e.target.value)}
                        placeholder="123 Main Street"
                        className="mt-1 h-9"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">City</Label>
                      <Input
                        value={draft.address.city}
                        onChange={(e) => handleDraftChange("address.city", e.target.value)}
                        placeholder="City"
                        className="mt-1 h-9"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">State/Province</Label>
                      <Input
                        value={draft.address.state}
                        onChange={(e) => handleDraftChange("address.state", e.target.value)}
                        placeholder="State"
                        className="mt-1 h-9"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Postal Code</Label>
                      <Input
                        value={draft.address.postal_code}
                        onChange={(e) => handleDraftChange("address.postal_code", e.target.value)}
                        placeholder="Postal Code"
                        className="mt-1 h-9"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Country *</Label>
                      <div className="mt-1">
                        <CountrySelect
                          value={draft.address.country}
                          onValueChange={(v) => handleDraftChange("address.country", v)}
                          placeholder="Select..."
                          className={draftErrors["address.country"] ? "border-red-500" : ""}
                        />
                      </div>
                      {draftErrors["address.country"] && (
                        <p className="text-xs text-red-600 mt-1">
                          {draftErrors["address.country"]}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Tax Residencies */}
                <div className="pt-3 border-t">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4 text-slate-500" />
                      <span className="text-sm font-medium text-slate-700">Tax Residencies</span>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAddTaxResidency}
                      className="h-7 text-xs"
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      Add
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {draft.tax_residencies?.map((residency, rIdx) => (
                      <div key={rIdx} className="flex gap-2 items-end">
                        <div className="flex-1">
                          <Label className="text-xs">Country</Label>
                          <div className="mt-1">
                            <CountrySelect
                              value={residency.country}
                              onValueChange={(v) => handleTaxResidencyChange(rIdx, "country", v)}
                              placeholder="Select..."
                            />
                          </div>
                        </div>
                        <div className="flex-1">
                          <Label className="text-xs">TIN</Label>
                          <Input
                            value={residency.tin}
                            onChange={(e) => handleTaxResidencyChange(rIdx, "tin", e.target.value)}
                            placeholder="Tax ID Number"
                            className="mt-1 h-9"
                          />
                        </div>
                        {draft.tax_residencies.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveTaxResidency(rIdx)}
                            className="text-red-600 h-9 px-2"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Save Draft Buttons */}
                <div className="flex gap-3 pt-3 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => { setShowAddForm(false); setDraftErrors({}); }}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={handleSaveDraft}
                    disabled={saving || ownershipExceedsLimit}
                    className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
                  >
                    {saving ? "Saving…" : "Save Person"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* ── Confirm & Continue button ── */}
      {!alreadySaved && (
        <Button
          type="button"
          onClick={handleConfirmAndContinue}
          disabled={dbCPs.length === 0 || loadingDB}
          className="w-full bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50"
        >
          <ArrowRight className="w-4 h-4 mr-2" />
          Confirm {dbCPs.length > 0 ? `${dbCPs.length} Controlling Person(s)` : "Controlling Persons"} & Continue
        </Button>
      )}

      {alreadySaved && (
        <Button
          type="button"
          disabled
          className="w-full bg-green-600 text-white opacity-80 cursor-not-allowed"
        >
          <CheckCircle2 className="w-4 h-4 mr-2" />
          {savedPersons.length} Controlling Person(s) Confirmed ✓
        </Button>
      )}

      {/* ── Edit existing person dialog ── */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Controlling Person</DialogTitle>
          </DialogHeader>
          {editingPerson && (
            <ControllingPersonForm
              controllingPerson={editingPerson}
              account={account}
              remainingOwnership={
                // Exclude this person's own ownership from the remaining calculation
                Math.max(
                  0,
                  Math.round(
                    (100 -
                      dbCPs.reduce((sum, cp) => {
                        if (cp.id === editingPerson.id) return sum;
                        if (cp.control_type === "legal_person_ownership")
                          return sum + (parseFloat(cp.ownership_percentage) || 0);
                        return sum;
                      }, 0)) *
                      10000
                  ) / 10000
                )
              }
              onSubmit={(data) =>
                updateMutation.mutate({ id: editingPerson.id, data })
              }
              onCancel={() => {
                setShowEditDialog(false);
                setEditingPerson(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}