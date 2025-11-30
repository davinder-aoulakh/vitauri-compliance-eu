import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { XCircle, Save, Building2, Palette, Settings } from "lucide-react";

export default function TenantForm({ tenant, onSubmit, onCancel }) {
  const [formData, setFormData] = useState(tenant || {
    name: "",
    short_name: "",
    jurisdiction: "",
    tax_id: "",
    contact_email: "",
    contact_phone: "",
    address: {
      street: "",
      city: "",
      state: "",
      postal_code: "",
      country: ""
    },
    branding: {
      logo_url: "",
      primary_color: "#464feb",
      secondary_color: "#1e293b",
      font_family: "Inter"
    },
    subscription_status: "active",
    subscription_tier: "professional"
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleNestedChange = (parent, field, value) => {
    setFormData(prev => ({
      ...prev,
      [parent]: { ...prev[parent], [field]: value }
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Tabs defaultValue="basic" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="basic">
            <Building2 className="w-4 h-4 mr-2" />
            Basic Info
          </TabsTrigger>
          <TabsTrigger value="branding">
            <Palette className="w-4 h-4 mr-2" />
            Branding
          </TabsTrigger>
          <TabsTrigger value="subscription">
            <Settings className="w-4 h-4 mr-2" />
            Subscription
          </TabsTrigger>
        </TabsList>

        <TabsContent value="basic" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <Label htmlFor="name">Legal Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleChange("name", e.target.value)}
                placeholder="Full legal name of the institution"
                required
                className="mt-1.5"
              />
            </div>

            <div>
              <Label htmlFor="short_name">Display Name *</Label>
              <Input
                id="short_name"
                value={formData.short_name}
                onChange={(e) => handleChange("short_name", e.target.value)}
                placeholder="Short name for UI"
                required
                className="mt-1.5"
              />
            </div>

            <div>
              <Label htmlFor="jurisdiction">Jurisdiction *</Label>
              <Input
                id="jurisdiction"
                value={formData.jurisdiction}
                onChange={(e) => handleChange("jurisdiction", e.target.value)}
                placeholder="e.g., United States, United Kingdom"
                required
                className="mt-1.5"
              />
            </div>

            <div>
              <Label htmlFor="tax_id">Tax ID</Label>
              <Input
                id="tax_id"
                value={formData.tax_id}
                onChange={(e) => handleChange("tax_id", e.target.value)}
                placeholder="Tax identification number"
                className="mt-1.5"
              />
            </div>

            <div>
              <Label htmlFor="contact_email">Contact Email *</Label>
              <Input
                id="contact_email"
                type="email"
                value={formData.contact_email}
                onChange={(e) => handleChange("contact_email", e.target.value)}
                placeholder="admin@institution.com"
                required
                className="mt-1.5"
              />
            </div>

            <div className="md:col-span-2">
              <Label htmlFor="contact_phone">Contact Phone</Label>
              <Input
                id="contact_phone"
                value={formData.contact_phone}
                onChange={(e) => handleChange("contact_phone", e.target.value)}
                placeholder="+1 (555) 123-4567"
                className="mt-1.5"
              />
            </div>
          </div>

          <div className="border-t pt-6">
            <h3 className="text-sm font-semibold text-slate-900 mb-4">Address</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Label htmlFor="street">Street Address</Label>
                <Input
                  id="street"
                  value={formData.address.street}
                  onChange={(e) => handleNestedChange("address", "street", e.target.value)}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={formData.address.city}
                  onChange={(e) => handleNestedChange("address", "city", e.target.value)}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="state">State/Province</Label>
                <Input
                  id="state"
                  value={formData.address.state}
                  onChange={(e) => handleNestedChange("address", "state", e.target.value)}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="postal_code">Postal Code</Label>
                <Input
                  id="postal_code"
                  value={formData.address.postal_code}
                  onChange={(e) => handleNestedChange("address", "postal_code", e.target.value)}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="country">Country</Label>
                <Input
                  id="country"
                  value={formData.address.country}
                  onChange={(e) => handleNestedChange("address", "country", e.target.value)}
                  className="mt-1.5"
                />
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="branding" className="space-y-6 mt-6">
          <div className="space-y-6">
            <div>
              <Label htmlFor="logo_url">Logo URL</Label>
              <Input
                id="logo_url"
                value={formData.branding.logo_url}
                onChange={(e) => handleNestedChange("branding", "logo_url", e.target.value)}
                placeholder="https://example.com/logo.png"
                className="mt-1.5"
              />
              <p className="text-xs text-slate-500 mt-1">
                Upload logo to a hosting service and paste URL here
              </p>
              {formData.branding.logo_url && (
                <div className="mt-3 p-4 border rounded-lg bg-slate-50">
                  <p className="text-xs font-medium text-slate-700 mb-2">Preview:</p>
                  <img 
                    src={formData.branding.logo_url} 
                    alt="Logo preview"
                    className="h-12 object-contain"
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="primary_color">Primary Color</Label>
                <div className="flex gap-2 mt-1.5">
                  <Input
                    id="primary_color"
                    type="color"
                    value={formData.branding.primary_color}
                    onChange={(e) => handleNestedChange("branding", "primary_color", e.target.value)}
                    className="w-20 h-10"
                  />
                  <Input
                    value={formData.branding.primary_color}
                    onChange={(e) => handleNestedChange("branding", "primary_color", e.target.value)}
                    placeholder="#464feb"
                    className="flex-1"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="secondary_color">Secondary Color</Label>
                <div className="flex gap-2 mt-1.5">
                  <Input
                    id="secondary_color"
                    type="color"
                    value={formData.branding.secondary_color}
                    onChange={(e) => handleNestedChange("branding", "secondary_color", e.target.value)}
                    className="w-20 h-10"
                  />
                  <Input
                    value={formData.branding.secondary_color}
                    onChange={(e) => handleNestedChange("branding", "secondary_color", e.target.value)}
                    placeholder="#1e293b"
                    className="flex-1"
                  />
                </div>
              </div>
            </div>

            <div>
              <Label htmlFor="font_family">Font Family</Label>
              <Select
                value={formData.branding.font_family}
                onValueChange={(value) => handleNestedChange("branding", "font_family", value)}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Inter">Inter</SelectItem>
                  <SelectItem value="Roboto">Roboto</SelectItem>
                  <SelectItem value="Open Sans">Open Sans</SelectItem>
                  <SelectItem value="Poppins">Poppins</SelectItem>
                  <SelectItem value="Montserrat">Montserrat</SelectItem>
                  <SelectItem value="Arial">Arial</SelectItem>
                  <SelectItem value="Helvetica">Helvetica</SelectItem>
                  <SelectItem value="Georgia">Georgia</SelectItem>
                  <SelectItem value="Times New Roman">Times New Roman</SelectItem>
                  <SelectItem value="Verdana">Verdana</SelectItem>
                  <SelectItem value="Lato">Lato</SelectItem>
                  <SelectItem value="Source Sans Pro">Source Sans Pro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="p-4 border rounded-lg bg-slate-50">
              <p className="text-sm font-medium text-slate-900 mb-3">Preview</p>
              <div 
                className="p-6 rounded-lg text-white"
                style={{ 
                  background: `linear-gradient(135deg, ${formData.branding.primary_color} 0%, ${formData.branding.secondary_color} 100%)`,
                  fontFamily: formData.branding.font_family
                }}
              >
                <h3 className="text-xl font-bold mb-2">{formData.short_name || "Your Institution"}</h3>
                <p className="text-sm opacity-90">CRS Compliance Platform</p>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="subscription" className="space-y-6 mt-6">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <Label htmlFor="subscription_status">Status</Label>
              <Select
                value={formData.subscription_status}
                onValueChange={(value) => handleChange("subscription_status", value)}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="trial">Trial</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="subscription_tier">Tier</Label>
              <Select
                value={formData.subscription_tier}
                onValueChange={(value) => handleChange("subscription_tier", value)}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="basic">Basic</SelectItem>
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="enterprise">Enterprise</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="p-4 border rounded-lg bg-blue-50 border-blue-200">
            <h4 className="font-semibold text-blue-900 mb-2">Subscription Information</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• <strong>Basic:</strong> Up to 100 accounts, 2 entities</li>
              <li>• <strong>Professional:</strong> Up to 1,000 accounts, 10 entities</li>
              <li>• <strong>Enterprise:</strong> Unlimited accounts and entities</li>
            </ul>
          </div>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end gap-3 pt-6 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>
          <XCircle className="w-4 h-4 mr-2" />
          Cancel
        </Button>
        <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white">
          <Save className="w-4 h-4 mr-2" />
          {tenant ? "Update Tenant" : "Create Tenant"}
        </Button>
      </div>
    </form>
  );
}