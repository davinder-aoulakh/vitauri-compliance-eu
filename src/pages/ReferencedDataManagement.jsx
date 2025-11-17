import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Edit,
  Trash2,
  MoreVertical,
  Search,
  Database,
  CheckCircle2,
  XCircle,
  Info
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ReferencedDataForm from "../components/referenced-data/ReferencedDataForm";

export default function ReferencedDataManagementPage() {
  const [user, setUser] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("Account");

  const queryClient = useQueryClient();

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);

      if (currentUser.user_role !== 'super_admin') {
        window.location.href = '/';
      }
    } catch (error) {
      console.error("Error loading user:", error);
      window.location.href = '/';
    }
  };

  const { data: referencedData = [], isLoading } = useQuery({
    queryKey: ['referenced-data'],
    queryFn: () => base44.entities.ReferencedData.list(),
    enabled: !!user
  });

  const { data: crsCountryInfo = [] } = useQuery({
    queryKey: ['crs-country-info'],
    queryFn: () => base44.entities.CrsCountryInfo.list(),
    enabled: !!user
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ReferencedData.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['referenced-data']);
    }
  });

  const togglePublishMutation = useMutation({
    mutationFn: ({ id, is_published }) => 
      base44.entities.ReferencedData.update(id, { is_published }),
    onSuccess: () => {
      queryClient.invalidateQueries(['referenced-data']);
    }
  });

  const handleEdit = (item) => {
    setSelectedItem(item);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (confirm("Are you sure you want to delete this option?")) {
      deleteMutation.mutate(id);
    }
  };

  const handleTogglePublish = (item) => {
    togglePublishMutation.mutate({
      id: item.id,
      is_published: !item.is_published
    });
  };

  const filteredData = referencedData
    .filter(item => item.entity_name === activeTab)
    .filter(item => 
      searchTerm === "" ||
      item.field_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.value.toLowerCase().includes(searchTerm.toLowerCase())
    );

  const getCrsInfo = (countryCode) => {
    return crsCountryInfo.find(c => c.country_code === countryCode);
  };

  const groupedData = filteredData.reduce((acc, item) => {
    if (!acc[item.field_name]) {
      acc[item.field_name] = [];
    }
    acc[item.field_name].push(item);
    return acc;
  }, {});

  const stats = {
    total: referencedData.length,
    published: referencedData.filter(d => d.is_published).length,
    account: referencedData.filter(d => d.entity_name === 'Account').length,
    entity: referencedData.filter(d => d.entity_name === 'Entity').length,
    global: referencedData.filter(d => d.entity_name === 'Global').length
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/20 to-slate-50">
      <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">Referenced Data Management</h1>
            <p className="text-slate-600">
              Configure dropdown options for Entity and Account fields
            </p>
          </div>
          <Button 
            onClick={() => {
              setSelectedItem(null);
              setShowForm(true);
            }}
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add New Option
          </Button>
        </div>

        <Alert className="bg-blue-50 border-blue-200">
          <Info className="w-4 h-4 text-blue-600" />
          <AlertDescription className="text-sm text-blue-900">
            <strong>Super Admin Only:</strong> Manage dropdown values for select fields across all tenant forms. 
            Published options are immediately available to all tenants.
          </AlertDescription>
        </Alert>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card className="border-0 shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                  <Database className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-600">Total Options</p>
                  <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
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
                  <p className="text-xs text-slate-600">Published</p>
                  <p className="text-2xl font-bold text-slate-900">{stats.published}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                  <Database className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-600">Account Fields</p>
                  <p className="text-2xl font-bold text-slate-900">{stats.account}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                  <Database className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-600">Entity Fields</p>
                  <p className="text-2xl font-bold text-slate-900">{stats.entity}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                  <Database className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-600">Global Lists</p>
                  <p className="text-2xl font-bold text-slate-900">{stats.global}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <Card className="border-0 shadow-lg">
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search by field name, label, or value..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Data Tables */}
        <Card className="border-0 shadow-lg">
          <CardHeader className="border-b bg-slate-50/50">
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5 text-indigo-600" />
              Dropdown Options
            </CardTitle>
            <CardDescription>
              Manage dropdown values for form fields
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="w-full grid grid-cols-3 rounded-none border-b">
                <TabsTrigger value="Account">
                  Account Fields ({stats.account})
                </TabsTrigger>
                <TabsTrigger value="Entity">
                  Entity Fields ({stats.entity})
                </TabsTrigger>
                <TabsTrigger value="Global">
                  Global Lists ({stats.global})
                </TabsTrigger>
              </TabsList>

              <TabsContent value={activeTab} className="m-0">
                {isLoading ? (
                  <div className="p-8 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
                  </div>
                ) : Object.keys(groupedData).length === 0 ? (
                  <div className="p-12 text-center">
                    <Database className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">
                      No options configured
                    </h3>
                    <p className="text-slate-600 mb-6">
                      Add dropdown options for {activeTab} fields
                    </p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {Object.entries(groupedData).map(([fieldName, items]) => (
                      <div key={fieldName} className="p-6">
                        <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                          {fieldName}
                          <Badge variant="outline">{items.length} options</Badge>
                        </h3>
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-slate-50">
                              <TableHead>Value</TableHead>
                              <TableHead>Label</TableHead>
                              {fieldName === "country" && <TableHead>CRS</TableHead>}
                              <TableHead>Description</TableHead>
                              <TableHead>Order</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {items
                              .sort((a, b) => a.order - b.order)
                              .map((item) => {
                                const crsInfo = fieldName === "country" ? getCrsInfo(item.value) : null;
                                return (
                                  <TableRow key={item.id}>
                                    <TableCell>
                                      <code className="text-xs bg-slate-100 px-2 py-1 rounded">
                                        {item.value}
                                      </code>
                                    </TableCell>
                                    <TableCell>
                                      <span className="font-medium text-slate-900">
                                        {item.label}
                                      </span>
                                    </TableCell>
                                    {fieldName === "country" && (
                                      <TableCell>
                                        {crsInfo?.is_crs_country ? (
                                          <Badge className="bg-green-100 text-green-800 border-green-200">
                                            Yes
                                          </Badge>
                                        ) : (
                                          <Badge className="bg-slate-100 text-slate-800 border-slate-200">
                                            No
                                          </Badge>
                                        )}
                                      </TableCell>
                                    )}
                                    <TableCell>
                                      <span className="text-sm text-slate-600">
                                        {item.description || "-"}
                                      </span>
                                    </TableCell>
                                    <TableCell>
                                      <span className="text-sm text-slate-600">{item.order}</span>
                                    </TableCell>
                                    <TableCell>
                                      {item.is_published ? (
                                        <Badge className="bg-green-100 text-green-800 border-green-200">
                                          <CheckCircle2 className="w-3 h-3 mr-1" />
                                          Published
                                        </Badge>
                                      ) : (
                                        <Badge className="bg-slate-100 text-slate-800 border-slate-200">
                                          <XCircle className="w-3 h-3 mr-1" />
                                          Unpublished
                                        </Badge>
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
                                          <DropdownMenuItem onClick={() => handleEdit(item)}>
                                            <Edit className="w-4 h-4 mr-2" />
                                            Edit
                                          </DropdownMenuItem>
                                          <DropdownMenuItem onClick={() => handleTogglePublish(item)}>
                                            {item.is_published ? (
                                              <>
                                                <XCircle className="w-4 h-4 mr-2" />
                                                Unpublish
                                              </>
                                            ) : (
                                              <>
                                                <CheckCircle2 className="w-4 h-4 mr-2" />
                                                Publish
                                              </>
                                            )}
                                          </DropdownMenuItem>
                                          <DropdownMenuItem
                                            onClick={() => handleDelete(item.id)}
                                            className="text-red-600"
                                          >
                                            <Trash2 className="w-4 h-4 mr-2" />
                                            Delete
                                          </DropdownMenuItem>
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                          </TableBody>
                        </Table>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {selectedItem ? 'Edit' : 'Add'} Dropdown Option
            </DialogTitle>
          </DialogHeader>
          <ReferencedDataForm
            item={selectedItem}
            onSave={() => {
              setShowForm(false);
              setSelectedItem(null);
              queryClient.invalidateQueries(['referenced-data']);
            }}
            onCancel={() => {
              setShowForm(false);
              setSelectedItem(null);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}