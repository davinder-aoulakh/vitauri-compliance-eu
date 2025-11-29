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
          <p className="text-sm text-slate-600">
            {filteredComponents.length} reusable workflow modules for faster building
          </p>
        </div>
        <Button 
          className="bg-indigo-600 hover:bg-indigo-700 text-white"
          onClick={() => setShowCreateForm(true)}
        >
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
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                <Package className="w-5 h-5 text-white" />
              </div>
              {selectedComponent?.component_name}
            </DialogTitle>
          </DialogHeader>
          {selectedComponent && (
            <Tabs defaultValue="overview" className="mt-4">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="overview">
                  <BookOpen className="w-4 h-4 mr-2" />
                  Overview
                </TabsTrigger>
                <TabsTrigger value="steps">
                  <Package className="w-4 h-4 mr-2" />
                  Steps ({selectedComponent.steps?.length || 0})
                </TabsTrigger>
                <TabsTrigger value="usage">
                  <Code className="w-4 h-4 mr-2" />
                  Usage Examples
                </TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-slate-700">Description</Label>
                    <p className="text-sm text-slate-900 mt-1 bg-slate-50 p-3 rounded-lg">
                      {selectedComponent.description || "No description provided."}
                    </p>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <Label className="text-sm font-medium text-slate-700">Category</Label>
                      <div className="mt-1">
                        <Badge className={getCategoryBadge(selectedComponent.category)}>
                          {categories.find(c => c.value === selectedComponent.category)?.icon} {selectedComponent.category?.replace(/_/g, " ")}
                        </Badge>
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-slate-700">Type</Label>
                      <div className="mt-1">
                        <Badge variant="outline">
                          {selectedComponent.component_type?.replace(/_/g, " ")}
                        </Badge>
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-slate-700">Usage</Label>
                      <div className="mt-1 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                        <span className="text-sm">Used {selectedComponent.usage_count || 0} times</span>
                      </div>
                    </div>
                  </div>
                </div>

                {selectedComponent.tags && selectedComponent.tags.length > 0 && (
                  <div>
                    <Label className="text-sm font-medium text-slate-700">Tags</Label>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {selectedComponent.tags.map((tag, idx) => (
                        <Badge key={idx} variant="secondary" className="text-xs">
                          <Tag className="w-3 h-3 mr-1" />
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {selectedComponent.parameters && Object.keys(selectedComponent.parameters).length > 0 && (
                  <div>
                    <Label className="text-sm font-medium text-slate-700">Configurable Parameters</Label>
                    <div className="mt-2 space-y-1">
                      {Object.entries(selectedComponent.parameters).map(([key, value]) => (
                        <div key={key} className="flex items-center justify-between text-sm p-2 bg-slate-50 rounded">
                          <span className="text-slate-600 font-medium">{key}:</span>
                          <code className="text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded text-xs">{JSON.stringify(value)}</code>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="steps" className="mt-4">
                <div className="space-y-3">
                  {selectedComponent.steps?.length > 0 ? (
                    selectedComponent.steps.map((step, idx) => (
                      <div key={idx} className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                            {idx + 1}
                          </div>
                          <div className="flex-1">
                            <h4 className="font-semibold text-slate-900 mb-1">{step.step_title}</h4>
                            {step.question_text && (
                              <p className="text-sm text-slate-600 mb-2">{step.question_text}</p>
                            )}
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">
                                {step.question_type?.replace(/_/g, " ")}
                              </Badge>
                              {step.options?.length > 0 && (
                                <Badge variant="outline" className="text-xs">
                                  {step.options.length} options
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-slate-500">
                      <Package className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                      <p>No steps defined in this component</p>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="usage" className="mt-4">
                <div className="space-y-4">
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-start gap-3">
                      <Sparkles className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-semibold text-blue-900 mb-1">How to Use</h4>
                        <p className="text-sm text-blue-800">
                          Click "Use This Component" to add all steps from this component to your workflow. 
                          You can then customize the steps as needed.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm font-medium text-slate-700">Example Workflow Integration</Label>
                    <div className="mt-2 bg-slate-900 text-slate-100 p-4 rounded-lg font-mono text-xs overflow-x-auto">
                      <pre>{`// Add ${selectedComponent.component_name} steps to your workflow
const workflowSteps = [
  ...existingSteps,
  ...${JSON.stringify(selectedComponent.component_name).replace(/"/g, "'")}.steps.map(step => ({
    ...step,
    step_id: \`\${step.step_id}_\${Date.now()}\`
  }))
];`}</pre>
                    </div>
                  </div>

                  {selectedComponent.parameters && Object.keys(selectedComponent.parameters).length > 0 && (
                    <div>
                      <Label className="text-sm font-medium text-slate-700">Customization Options</Label>
                      <ul className="mt-2 space-y-1 text-sm text-slate-600">
                        {Object.keys(selectedComponent.parameters).map(param => (
                          <li key={param} className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-green-600" />
                            Adjust <code className="bg-slate-100 px-1.5 py-0.5 rounded">{param}</code> to fit your needs
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          )}

          <div className="flex justify-between gap-2 pt-4 border-t mt-4">
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  setEditingComponent(selectedComponent);
                  setShowDetails(false);
                  setShowCreateForm(true);
                }}
              >
                <Edit className="w-4 h-4 mr-2" />
                Edit
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                className="text-red-600 hover:text-red-700"
                onClick={() => {
                  if (confirm("Delete this component?")) {
                    deleteMutation.mutate(selectedComponent.id);
                    setShowDetails(false);
                  }
                }}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </Button>
            </div>
            <div className="flex gap-2">
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
        </DialogContent>
      </Dialog>

      {/* Create/Edit Component Dialog */}
      <Dialog open={showCreateForm} onOpenChange={(open) => {
        setShowCreateForm(open);
        if (!open) setEditingComponent(null);
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingComponent ? "Edit Component" : "Create New Component"}
            </DialogTitle>
          </DialogHeader>
          <ComponentForm
            component={editingComponent}
            categories={categories.filter(c => c.value !== "all")}
            onSubmit={(data) => {
              if (editingComponent) {
                updateMutation.mutate({ id: editingComponent.id, data });
              } else {
                createMutation.mutate(data);
              }
            }}
            onCancel={() => {
              setShowCreateForm(false);
              setEditingComponent(null);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Component Form for Create/Edit
function ComponentForm({ component, categories, onSubmit, onCancel }) {
  const [formData, setFormData] = useState({
    component_name: component?.component_name || "",
    component_type: component?.component_type || "question_module",
    description: component?.description || "",
    category: component?.category || "general",
    tags: component?.tags || [],
    is_public: component?.is_public ?? true,
    steps: component?.steps || [],
    parameters: component?.parameters || {}
  });
  const [tagInput, setTagInput] = useState("");

  const handleAddTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData({ ...formData, tags: [...formData.tags, tagInput.trim()] });
      setTagInput("");
    }
  };

  const handleRemoveTag = (tagToRemove) => {
    setFormData({ ...formData, tags: formData.tags.filter(t => t !== tagToRemove) });
  };

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-sm font-medium">Component Name *</Label>
        <Input
          value={formData.component_name}
          onChange={(e) => setFormData({ ...formData, component_name: e.target.value })}
          placeholder="e.g., Tax Residency Collector"
          className="mt-1"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-sm font-medium">Type *</Label>
          <Select
            value={formData.component_type}
            onValueChange={(value) => setFormData({ ...formData, component_type: value })}
          >
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="question_module">Question Module</SelectItem>
              <SelectItem value="decision_logic">Decision Logic</SelectItem>
              <SelectItem value="data_collection">Data Collection</SelectItem>
              <SelectItem value="validation_rule">Validation Rule</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-sm font-medium">Category *</Label>
          <Select
            value={formData.category}
            onValueChange={(value) => setFormData({ ...formData, category: value })}
          >
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {categories.map(cat => (
                <SelectItem key={cat.value} value={cat.value}>
                  {cat.icon} {cat.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label className="text-sm font-medium">Description</Label>
        <Textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Describe what this component does and when to use it..."
          rows={3}
          className="mt-1"
        />
      </div>

      <div>
        <Label className="text-sm font-medium">Tags</Label>
        <div className="flex gap-2 mt-1">
          <Input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            placeholder="Add a tag..."
            onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), handleAddTag())}
          />
          <Button type="button" onClick={handleAddTag} variant="outline">
            <Plus className="w-4 h-4" />
          </Button>
        </div>
        {formData.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {formData.tags.map((tag, idx) => (
              <Badge key={idx} variant="secondary" className="gap-1">
                {tag}
                <button onClick={() => handleRemoveTag(tag)}>
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          className="bg-indigo-600 hover:bg-indigo-700 text-white"
          onClick={() => onSubmit(formData)}
          disabled={!formData.component_name}
        >
          {component ? "Update Component" : "Create Component"}
        </Button>
      </div>
    </div>
  );
}

function Label({ children, className }) {
  return <label className={`block text-sm font-medium text-slate-700 ${className}`}>{children}</label>;
}