import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Plus, Users, MoreVertical, Edit, Trash2, CheckCircle2, XCircle, AlertTriangle, Globe, AlertCircle, PlayCircle } from "lucide-react";
import ControllingPersonForm from "./ControllingPersonForm";
import WorkflowRunner from "../workflows/WorkflowRunner";
import { format } from "date-fns";

export default function ControllingPersonsList({ account, onUpdateCount }) {
  const [showForm, setShowForm] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [showClassification, setShowClassification] = useState(false);
  const [classifyingPerson, setClassifyingPerson] = useState(null);
  const queryClient = useQueryClient();

  const { data: controllingPersons = [], isLoading } = useQuery({
    queryKey: ['controlling-persons', account?.id],
    queryFn: () => account?.id
      ? base44.entities.ControllingPerson.filter({ account_id: account.id })
      : [],
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
      tenant_id: account.tenant_id,
      account_id: account.id
    }),
    onSuccess: () => {
      queryClient.invalidateQueries(['controlling-persons']);
      setShowForm(false);
      setSelectedPerson(null);
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ControllingPerson.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['controlling-persons']);
      setShowForm(false);
      setSelectedPerson(null);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ControllingPerson.delete(id),
    onSuccess: async () => {
      queryClient.invalidateQueries(['controlling-persons']);
      // Trigger background sync to update controlling persons count
      try {
        await base44.functions.invoke('syncAccountControllingPersons', {
          accountId: account.id
        });
        queryClient.invalidateQueries(['accounts']);
      } catch (error) {
        console.error('Failed to sync controlling persons count:', error);
      }
    }
  });

  const handleEdit = (person) => {
    setSelectedPerson(person);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (confirm("Are you sure you want to delete this controlling person?")) {
      deleteMutation.mutate(id);
    }
  };

  const handleClassify = (person) => {
    setClassifyingPerson(person);
    setShowClassification(true);
  };

  const handleClassificationComplete = async (answers) => {
    // Update controlling person based on classification results
    const finalStep = answers[answers.length - 1];
    const isReportable = finalStep?.result_status === 'reportable';
    
    await base44.entities.ControllingPerson.update(classifyingPerson.id, {
      is_reportable: isReportable,
      classification_answers: answers
    });
    
    queryClient.invalidateQueries(['controlling-persons']);
    setShowClassification(false);
    setClassifyingPerson(null);
  };

  const isPassiveNFE = account?.entity_classification === "passive_nfe";
  const reportablePersons = controllingPersons.filter(p => p.is_reportable === true);
  const nonReportablePersons = controllingPersons.filter(p => p.is_reportable === false);
  const pendingReviewPersons = controllingPersons.filter(p => p.is_reportable === null || p.is_reportable === undefined);
  const hasReportableControllingPersons = reportablePersons.length > 0;

  // Notify parent component about the count of controlling persons
  useEffect(() => {
    if (onUpdateCount) {
      onUpdateCount(controllingPersons.length);
    }
  }, [controllingPersons, onUpdateCount]);

  // Removed auto-trigger - user should manually click "Add Controlling Person" button

  return (
    <div className="space-y-6">
      {/* Passive NFE Alert */}
      {isPassiveNFE && (
        <Alert className="bg-purple-50 border-purple-200">
          <AlertCircle className="w-4 h-4 text-purple-600" />
          <AlertDescription className="text-sm text-purple-900">
            <strong>Passive NFE Account:</strong> Under CRS, all controlling persons must be identified. 
            Any controlling persons with foreign tax residency will make this account reportable.
            {controllingPersons.length === 0 && (
              <p className="mt-2 font-medium text-purple-800">
                ⚠️ No controlling persons identified yet. Please add controlling persons to complete compliance review.
              </p>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Header Card */}
      <Card className={`border-0 shadow-lg ${isPassiveNFE && controllingPersons.length === 0 ? 'border-2 border-purple-200' : ''}`}>
        <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-transparent">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-600" />
                Controlling Persons
                {isPassiveNFE && (
                  <Badge className="bg-purple-100 text-purple-800 ml-2">
                    Required for Passive NFE
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="mt-1">
                Individuals who exercise control over the entity ({">"}25% ownership or senior management)
              </CardDescription>
            </div>
            <Button
              onClick={() => {
                setSelectedPerson(null);
                setShowForm(true);
              }}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Controlling Person
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center p-4 rounded-lg bg-slate-50 border border-slate-200">
              <p className="text-2xl font-bold text-slate-900">{controllingPersons.length}</p>
              <p className="text-xs text-slate-600">Total Persons</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-green-50 border border-green-200">
              <p className="text-2xl font-bold text-green-600">
                {nonReportablePersons.length}
              </p>
              <p className="text-xs text-green-700">Non-Reportable</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-amber-50 border border-amber-200">
              <p className="text-2xl font-bold text-amber-600">
                {reportablePersons.length}
              </p>
              <p className="text-xs text-amber-700">Reportable (Foreign)</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-yellow-50 border border-yellow-200">
              <p className="text-2xl font-bold text-yellow-600">
                {pendingReviewPersons.length}
              </p>
              <p className="text-xs text-yellow-700">Pending Review</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Controlling Persons Table */}
      <Card className="border-0 shadow-lg">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
            </div>
          ) : controllingPersons.length === 0 ? (
            <div className="p-12 text-center">
              <Users className="w-16 h-16 mx-auto mb-4 text-slate-300" />
              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                No Controlling Persons Added
              </h3>
              <p className="text-slate-600 mb-6">
                {isPassiveNFE
                  ? "This Passive NFE account requires controlling persons to be identified for CRS reporting."
                  : "Add individuals who exercise control over the entity account holder."}
              </p>
              <Button
                onClick={() => setShowForm(true)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add First Controlling Person
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/50">
                    <TableHead>Name</TableHead>
                    <TableHead>Date of Birth</TableHead>
                    <TableHead>Control Type</TableHead>
                    <TableHead>Tax Residencies</TableHead>
                    <TableHead>Reportability</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {controllingPersons.map((person) => (
                    <TableRow key={person.id} className="hover:bg-slate-50/50">
                      <TableCell>
                       <div className="flex items-center gap-3">
                         <div>
                           <p className="font-semibold text-slate-900">
                             {person.first_name && person.last_name 
                               ? `${person.first_name} ${person.last_name}`
                               : person.full_name || "N/A"}
                           </p>
                           {person.ownership_percentage > 0 && (
                             <p className="text-xs text-slate-500">
                               {person.ownership_percentage}% ownership
                             </p>
                           )}
                         </div>
                       </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-slate-700">
                          {person.date_of_birth ? format(new Date(person.date_of_birth), 'MMM d, yyyy') : '—'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {person.control_type?.replace(/_/g, ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {person.tax_residencies && person.tax_residencies.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {person.tax_residencies.map((res, idx) => (
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
                        {person.is_reportable === true ? (
                          <Badge className="bg-green-100 text-green-800 border-green-200">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Reportable
                          </Badge>
                        ) : person.is_reportable === false ? (
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
                          {workflows.length > 0 && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleClassify(person)}
                              className="text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                            >
                              <PlayCircle className="w-4 h-4 mr-1" />
                              Classify
                            </Button>
                          )}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleEdit(person)}>
                                <Edit className="w-4 h-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleDelete(person.id)}
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
      {controllingPersons.length > 0 && (
        <Alert className={reportablePersons.length > 0 ? "bg-green-50 border-green-200" : "bg-slate-50 border-slate-200"}>
          {reportablePersons.length > 0 ? (
            <>
              <CheckCircle2 className="w-4 h-4 text-green-600" />
              <AlertDescription className="text-sm text-green-900">
                <strong>Account is Reportable:</strong> {reportablePersons.length} controlling {reportablePersons.length === 1 ? 'person is' : 'persons are'} tax resident in foreign CRS participating jurisdictions. 
                Their information will be included in CRS XML reporting.
              </AlertDescription>
            </>
          ) : (
            <>
              <XCircle className="w-4 h-4 text-slate-600" />
              <AlertDescription className="text-sm text-slate-700">
                <strong>Account is Non-Reportable:</strong> No controlling persons are tax resident in foreign jurisdictions. 
                This account does not require CRS reporting for controlling persons.
              </AlertDescription>
            </>
          )}
        </Alert>
      )}

      {/* Controlling Person Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedPerson ? "Edit Controlling Person" : "Add Controlling Person"}
            </DialogTitle>
          </DialogHeader>
          <ControllingPersonForm
            controllingPerson={selectedPerson}
            account={account}
            onSubmit={(data) => {
              if (selectedPerson) {
                updateMutation.mutate({ id: selectedPerson.id, data });
              } else {
                createMutation.mutate(data);
              }
            }}
            onCancel={() => {
              setShowForm(false);
              setSelectedPerson(null);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Classification Workflow Dialog */}
      {showClassification && workflows.length > 0 && classifyingPerson && (
        <Dialog open={showClassification} onOpenChange={setShowClassification}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Classify Controlling Person: {classifyingPerson.full_name}</DialogTitle>
            </DialogHeader>
            <WorkflowRunner
              workflow={workflows[0]}
              initialData={{ controlling_person: classifyingPerson, account }}
              controllingPersonId={classifyingPerson.id}
              accountId={account.id}
              onComplete={handleClassificationComplete}
              onCancel={() => setShowClassification(false)}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}