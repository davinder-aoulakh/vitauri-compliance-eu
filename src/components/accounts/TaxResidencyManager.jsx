import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Edit, Save, X, Globe, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function TaxResidencyManager({ residencies = [], onChange, accountHolderType = "individual" }) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);
  const [formData, setFormData] = useState({
    country: "",
    tin: "",
    tin_unavailable_reason: ""
  });

  const commonCountries = [
    { code: "US", name: "United States" },
    { code: "GB", name: "United Kingdom" },
    { code: "DE", name: "Germany" },
    { code: "FR", name: "France" },
    { code: "NL", name: "Netherlands" },
    { code: "AW", name: "Aruba" },
    { code: "CW", name: "Curaçao" },
    { code: "SX", name: "Sint Maarten" },
    { code: "CH", name: "Switzerland" },
    { code: "LU", name: "Luxembourg" },
    { code: "SG", name: "Singapore" },
    { code: "HK", name: "Hong Kong" },
    { code: "CA", name: "Canada" },
    { code: "AU", name: "Australia" },
    { code: "JP", name: "Japan" },
    { code: "IT", name: "Italy" },
    { code: "ES", name: "Spain" },
    { code: "BE", name: "Belgium" },
    { code: "AT", name: "Austria" },
    { code: "SE", name: "Sweden" }
  ];

  const tinUnavailableReasons = [
    { value: "not_required", label: "TIN not required by jurisdiction" },
    { value: "no_tin_issued", label: "Jurisdiction does not issue TINs" },
    { value: "unable_to_obtain", label: "Unable to obtain TIN" },
    { value: "requested", label: "TIN requested but not yet provided" }
  ];

  const handleAdd = () => {
    if (!formData.country) return;
    
    const newResidency = {
      country: formData.country,
      tin: formData.tin || undefined,
      tin_unavailable_reason: formData.tin_unavailable_reason || undefined
    };

    onChange([...residencies, newResidency]);
    resetForm();
  };

  const handleUpdate = () => {
    if (!formData.country || editingIndex === null) return;

    const updated = [...residencies];
    updated[editingIndex] = {
      country: formData.country,
      tin: formData.tin || undefined,
      tin_unavailable_reason: formData.tin_unavailable_reason || undefined
    };

    onChange(updated);
    resetForm();
  };

  const handleDelete = (index) => {
    if (confirm("Remove this tax residency?")) {
      onChange(residencies.filter((_, i) => i !== index));
    }
  };

  const handleEdit = (index) => {
    const residency = residencies[index];
    setFormData({
      country: residency.country || "",
      tin: residency.tin || "",
      tin_unavailable_reason: residency.tin_unavailable_reason || ""
    });
    setEditingIndex(index);
    setIsAdding(true);
  };

  const resetForm = () => {
    setFormData({ country: "", tin: "", tin_unavailable_reason: "" });
    setIsAdding(false);
    setEditingIndex(null);
  };

  const getCountryName = (countryCode) => {
    const country = commonCountries.find(c => c.code === countryCode);
    return country ? country.name : countryCode;
  };

  return (
    <Card className="border-slate-200">
      <CardHeader className="border-b bg-slate-50">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Globe className="w-5 h-5 text-indigo-600" />
            Tax Residencies
          </CardTitle>
          {!isAdding && (
            <Button
              type="button"
              size="sm"
              onClick={() => setIsAdding(true)}
              variant="outline"
              className="gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Residency
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-6">
        {/* Info Alert */}
        <Alert className="mb-4 bg-blue-50 border-blue-200">
          <AlertCircle className="w-4 h-4 text-blue-600" />
          <AlertDescription className="text-sm text-blue-900">
            Under CRS, all jurisdictions where the {accountHolderType === "individual" ? "account holder" : "entity"} is 
            tax resident must be reported, along with their Tax Identification Number (TIN) for each jurisdiction.
          </AlertDescription>
        </Alert>

        {/* Add/Edit Form */}
        {isAdding && (
          <div className="mb-6 p-4 border-2 border-indigo-200 rounded-lg bg-indigo-50/30 space-y-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-slate-900">
                {editingIndex !== null ? "Edit Tax Residency" : "Add Tax Residency"}
              </h4>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={resetForm}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="country">Country of Tax Residence *</Label>
                <Select
                  value={formData.country}
                  onValueChange={(value) => setFormData({ ...formData, country: value })}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder="Select country..." />
                  </SelectTrigger>
                  <SelectContent>
                    {commonCountries.map((country) => (
                      <SelectItem key={country.code} value={country.code}>
                        {country.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="tin">Tax Identification Number (TIN)</Label>
                <Input
                  id="tin"
                  value={formData.tin}
                  onChange={(e) => setFormData({ ...formData, tin: e.target.value })}
                  placeholder="Enter TIN..."
                  className="mt-1.5"
                  disabled={!!formData.tin_unavailable_reason}
                />
                <p className="text-xs text-slate-500 mt-1">
                  Leave blank if TIN is unavailable (provide reason below)
                </p>
              </div>

              <div className="md:col-span-2">
                <Label htmlFor="tin_unavailable_reason">TIN Unavailable Reason (if applicable)</Label>
                <Select
                  value={formData.tin_unavailable_reason}
                  onValueChange={(value) => setFormData({ 
                    ...formData, 
                    tin_unavailable_reason: value,
                    tin: value ? "" : formData.tin // Clear TIN if reason provided
                  })}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder="Select reason if TIN unavailable..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={null}>TIN is available</SelectItem>
                    {tinUnavailableReasons.map((reason) => (
                      <SelectItem key={reason.value} value={reason.value}>
                        {reason.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={resetForm}
                size="sm"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={editingIndex !== null ? handleUpdate : handleAdd}
                disabled={!formData.country}
                size="sm"
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                <Save className="w-4 h-4 mr-2" />
                {editingIndex !== null ? "Update" : "Add"} Residency
              </Button>
            </div>
          </div>
        )}

        {/* Residencies Table */}
        {residencies.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <Globe className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p className="text-sm">No tax residencies added yet</p>
            <p className="text-xs mt-1">At least one tax residency is required for CRS reporting</p>
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead className="font-semibold">Country</TableHead>
                  <TableHead className="font-semibold">TIN</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                  <TableHead className="text-right font-semibold">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {residencies.map((residency, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Globe className="w-4 h-4 text-slate-400" />
                        {getCountryName(residency.country)}
                      </div>
                    </TableCell>
                    <TableCell>
                      {residency.tin ? (
                        <code className="px-2 py-1 bg-slate-100 rounded text-sm">
                          {residency.tin}
                        </code>
                      ) : (
                        <span className="text-slate-400 text-sm">Not provided</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {residency.tin ? (
                        <Badge className="bg-green-100 text-green-800">
                          TIN Provided
                        </Badge>
                      ) : residency.tin_unavailable_reason ? (
                        <Badge className="bg-amber-100 text-amber-800">
                          {tinUnavailableReasons.find(r => r.value === residency.tin_unavailable_reason)?.label || "TIN Unavailable"}
                        </Badge>
                      ) : (
                        <Badge className="bg-red-100 text-red-800">
                          Missing TIN
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEdit(index)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(index)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Summary */}
        {residencies.length > 0 && (
          <div className="mt-4 p-3 bg-slate-50 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-slate-700">
              <Badge variant="outline" className="bg-white">
                {residencies.length} {residencies.length === 1 ? "Jurisdiction" : "Jurisdictions"}
              </Badge>
              <span className="text-slate-600">•</span>
              <span className="text-slate-600">
                {residencies.filter(r => r.tin).length} with TIN
              </span>
            </div>
            {residencies.some(r => !r.tin && !r.tin_unavailable_reason) && (
              <Badge className="bg-red-100 text-red-800 border-red-200">
                Action Required
              </Badge>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}