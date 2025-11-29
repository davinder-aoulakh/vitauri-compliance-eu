import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  Plus,
  Copy,
  Trash2,
  Edit,
  CheckCircle2,
  Package,
  Tag,
  X,
  Filter,
  SortAsc,
  SortDesc,
  Code,
  BookOpen,
  Sparkles
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function ComponentLibrary({ onSelectComponent }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedType, setSelectedType] = useState("all");
  const [selectedTag, setSelectedTag] = useState("");
  const [sortBy, setSortBy] = useState("name");
  const [sortOrder, setSortOrder] = useState("asc");
  const [showDetails, setShowDetails] = useState(false);
  const [selectedComponent, setSelectedComponent] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingComponent, setEditingComponent] = useState(null);

  const queryClient = useQueryClient();

  const { data: components = [] } = useQuery({
    queryKey: ['workflow-components'],
    queryFn: () => base44.entities.WorkflowComponent.list()
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.WorkflowComponent.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['workflow-components']);
      setShowCreateForm(false);
      setEditingComponent(null);
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.WorkflowComponent.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['workflow-components']);
      setShowCreateForm(false);
      setEditingComponent(null);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.WorkflowComponent.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['workflow-components']);
    }
  });

  const categories = [
    { value: "all", label: "All Components", count: components.length, icon: "📦" },
    { value: "financial_institution_check", label: "FI Checks", count: components.filter(c => c.category === "financial_institution_check").length, icon: "🏦" },
    { value: "tax_residency_collection", label: "Tax Residency", count: components.filter(c => c.category === "tax_residency_collection").length, icon: "🌍" },
    { value: "indicia_search", label: "Indicia Search", count: components.filter(c => c.category === "indicia_search").length, icon: "🔍" },
    { value: "self_certification", label: "Self Certification", count: components.filter(c => c.category === "self_certification").length, icon: "📝" },
    { value: "controlling_persons", label: "Controlling Persons", count: components.filter(c => c.category === "controlling_persons").length, icon: "👥" },
    { value: "entity_classification", label: "Entity Classification", count: components.filter(c => c.category === "entity_classification").length, icon: "🏢" },
    { value: "account_review", label: "Account Review", count: components.filter(c => c.category === "account_review").length, icon: "💳" },
    { value: "general", label: "General", count: components.filter(c => c.category === "general").length, icon: "⚙️" }
  ];

  const componentTypes = [
    { value: "all", label: "All Types" },
    { value: "question_module", label: "Question Module" },
    { value: "decision_logic", label: "Decision Logic" },
    { value: "data_collection", label: "Data Collection" },
    { value: "validation_rule", label: "Validation Rule" },
    { value: "custom", label: "Custom" }
  ];

  // Get all unique tags from components
  const allTags = [...new Set(components.flatMap(c => c.tags || []))].sort();

  const filteredComponents = components
    .filter(component => {
      const matchesSearch = 
        component.component_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        component.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        component.tags?.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesCategory = selectedCategory === "all" || component.category === selectedCategory;
      const matchesType = selectedType === "all" || component.component_type === selectedType;
      const matchesTag = !selectedTag || component.tags?.includes(selectedTag);
      return matchesSearch && matchesCategory && matchesType && matchesTag;
    })
    .sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case "name":
          comparison = (a.component_name || "").localeCompare(b.component_name || "");
          break;
        case "usage":
          comparison = (b.usage_count || 0) - (a.usage_count || 0);
          break;
        case "steps":
          comparison = (b.steps?.length || 0) - (a.steps?.length || 0);
          break;
        case "date":
          comparison = new Date(b.created_date || 0) - new Date(a.created_date || 0);
          break;
        default:
          comparison = 0;
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });

  const handleViewDetails = (component) => {
    setSelectedComponent(component);
    setShowDetails(true);
  };

  const handleUseComponent = (component) => {
    if (onSelectComponent) {
      onSelectComponent(component);
    }
  };

  const getCategoryBadge = (category) => {
    const colors = {
      financial_institution_check: "bg-blue-100 text-blue-700",
      tax_residency_collection: "bg-green-100 text-green-700",
      indicia_search: "bg-amber-100 text-amber-700",
      self_certification: "bg-purple-100 text-purple-700",
      controlling_persons: "bg-pink-100 text-pink-700",
      general: "bg-slate-100 text-slate-700"
    };
    return colors[category] || colors.general;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-slate-900">Component Library</h3>
          <p className="text-sm text-slate-600">Reusable workflow modules for faster building</p>
        </div>
        <Button className="bg-indigo-600 hover:bg-indigo-700 text-white">
          <Plus className="w-4 h-4 mr-2" />
          Create Component
        </Button>
      </div>

      {/* Search & Filter */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4">
            {/* Search Input */}
            <div className="flex-1 min-w-[250px] relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
              <Input
                placeholder="Search by name, description, or tags..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Type Filter */}
            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger className="w-[160px]">
                <Filter className="w-4 h-4 mr-2 text-slate-400" />
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                {componentTypes.map(type => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Tag Filter */}
            <Select value={selectedTag} onValueChange={setSelectedTag}>
              <SelectTrigger className="w-[160px]">
                <Tag className="w-4 h-4 mr-2 text-slate-400" />
                <SelectValue placeholder="Filter by tag" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={null}>All Tags</SelectItem>
                {allTags.map(tag => (
                  <SelectItem key={tag} value={tag}>
                    {tag}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Sort Options */}
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Name</SelectItem>
                <SelectItem value="usage">Usage Count</SelectItem>
                <SelectItem value="steps">Step Count</SelectItem>
                <SelectItem value="date">Date Created</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="icon"
              onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
              title={sortOrder === "asc" ? "Ascending" : "Descending"}
            >
              {sortOrder === "asc" ? <SortAsc className="w-4 h-4" /> : <SortDesc className="w-4 h-4" />}
            </Button>
          </div>

          {/* Active Filters Display */}
          {(selectedCategory !== "all" || selectedType !== "all" || selectedTag || searchTerm) && (
            <div className="flex items-center gap-2 mt-3 pt-3 border-t">
              <span className="text-xs text-slate-500">Active filters:</span>
              {searchTerm && (
                <Badge variant="secondary" className="gap-1">
                  Search: "{searchTerm}"
                  <button onClick={() => setSearchTerm("")}><X className="w-3 h-3" /></button>
                </Badge>
              )}
              {selectedCategory !== "all" && (
                <Badge variant="secondary" className="gap-1">
                  {categories.find(c => c.value === selectedCategory)?.label}
                  <button onClick={() => setSelectedCategory("all")}><X className="w-3 h-3" /></button>
                </Badge>
              )}
              {selectedType !== "all" && (
                <Badge variant="secondary" className="gap-1">
                  {componentTypes.find(t => t.value === selectedType)?.label}
                  <button onClick={() => setSelectedType("all")}><X className="w-3 h-3" /></button>
                </Badge>
              )}
              {selectedTag && (
                <Badge variant="secondary" className="gap-1">
                  Tag: {selectedTag}
                  <button onClick={() => setSelectedTag("")}><X className="w-3 h-3" /></button>
                </Badge>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchTerm("");
                  setSelectedCategory("all");
                  setSelectedType("all");
                  setSelectedTag("");
                }}
                className="text-xs"
              >
                Clear all
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-12 gap-6">
        {/* Category Sidebar */}
        <div className="col-span-3">
          <Card className="border-0 shadow-sm sticky top-4">
            <CardHeader className="border-b">
              <CardTitle className="text-sm flex items-center gap-2">
                <Filter className="w-4 h-4" />
                Categories
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2">
              <div className="space-y-1">
                {categories.map((category) => (
                  <button
                    key={category.value}
                    onClick={() => setSelectedCategory(category.value)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-all ${
                      selectedCategory === category.value
                        ? "bg-indigo-100 text-indigo-700 font-medium shadow-sm"
                        : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span>{category.icon}</span>
                      <span>{category.label}</span>
                    </span>
                    <Badge 
                      variant="outline" 
                      className={`text-xs ${selectedCategory === category.value ? 'bg-indigo-200 border-indigo-300' : ''}`}
                    >
                      {category.count}
                    </Badge>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Popular Tags */}
          {allTags.length > 0 && (
            <Card className="border-0 shadow-sm mt-4">
              <CardHeader className="border-b py-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Tag className="w-4 h-4" />
                  Popular Tags
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3">
                <div className="flex flex-wrap gap-1.5">
                  {allTags.slice(0, 10).map(tag => (
                    <Badge
                      key={tag}
                      variant={selectedTag === tag ? "default" : "outline"}
                      className={`cursor-pointer text-xs ${
                        selectedTag === tag 
                          ? "bg-indigo-600" 
                          : "hover:bg-slate-100"
                      }`}
                      onClick={() => setSelectedTag(selectedTag === tag ? "" : tag)}
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Components Grid */}
        <div className="col-span-9">
          {filteredComponents.length === 0 ? (
            <Card className="border-0 shadow-sm">
              <CardContent className="p-12 text-center">
                <Package className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                <h3 className="text-lg font-semibold text-slate-900 mb-2">No components found</h3>
                <p className="text-slate-600">
                  {searchTerm ? "Try adjusting your search" : "Be the first to create a component"}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredComponents.map((component) => (
                <Card key={component.id} className="border-0 shadow-lg hover:shadow-xl transition-shadow">
                  <CardContent className="p-5">
                    <div className="flex items-start gap-3 mb-3">
                      <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                        <Package className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-slate-900 mb-1">
                          {component.component_name}
                        </h4>
                        <p className="text-sm text-slate-600 line-clamp-2">
                          {component.description}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 mb-3">
                      <Badge className={getCategoryBadge(component.category)}>
                        {component.category?.replace(/_/g, " ")}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {component.steps?.length || 0} steps
                      </Badge>
                      {component.usage_count > 0 && (
                        <Badge variant="outline" className="text-xs">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Used {component.usage_count}x
                        </Badge>
                      )}
                    </div>

                    {component.tags && component.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {component.tags.slice(0, 3).map((tag, idx) => (
                          <Badge key={idx} variant="secondary" className="text-xs">
                            <Tag className="w-3 h-3 mr-1" />
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white"
                        onClick={() => handleUseComponent(component)}
                      >
                        <Copy className="w-3 h-3 mr-1" />
                        Use Component
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleViewDetails(component)}
                      >
                        View
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Component Details Dialog */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Component: {selectedComponent?.component_name}</DialogTitle>
          </DialogHeader>
          {selectedComponent && (
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium text-slate-700">Description</Label>
                <p className="text-sm text-slate-900 mt-1">{selectedComponent.description}</p>
              </div>

              <div>
                <Label className="text-sm font-medium text-slate-700">Category</Label>
                <Badge className={`${getCategoryBadge(selectedComponent.category)} mt-1`}>
                  {selectedComponent.category?.replace(/_/g, " ")}
                </Badge>
              </div>

              <div>
                <Label className="text-sm font-medium text-slate-700">Steps ({selectedComponent.steps?.length || 0})</Label>
                <div className="mt-2 space-y-2">
                  {selectedComponent.steps?.map((step, idx) => (
                    <div key={idx} className="p-3 bg-slate-50 rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-xs">{idx + 1}</Badge>
                        <span className="font-medium text-sm text-slate-900">{step.step_title}</span>
                      </div>
                      {step.question_text && (
                        <p className="text-xs text-slate-600 ml-8">{step.question_text}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {selectedComponent.parameters && Object.keys(selectedComponent.parameters).length > 0 && (
                <div>
                  <Label className="text-sm font-medium text-slate-700">Configurable Parameters</Label>
                  <div className="mt-2 space-y-1">
                    {Object.entries(selectedComponent.parameters).map(([key, value]) => (
                      <div key={key} className="flex items-center justify-between text-sm p-2 bg-slate-50 rounded">
                        <span className="text-slate-600">{key}:</span>
                        <span className="text-slate-900 font-mono text-xs">{JSON.stringify(value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="outline" onClick={() => setShowDetails(false)}>
                  Close
                </Button>
                <Button
                  className="bg-indigo-600 hover:bg-indigo-700 text-white"
                  onClick={() => {
                    handleUseComponent(selectedComponent);
                    setShowDetails(false);
                  }}
                >
                  <Copy className="w-4 h-4 mr-2" />
                  Use This Component
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Label({ children, className }) {
  return <label className={`block text-sm font-medium text-slate-700 ${className}`}>{children}</label>;
}