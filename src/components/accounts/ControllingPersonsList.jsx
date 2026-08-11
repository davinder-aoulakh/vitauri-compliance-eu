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
import { Plus, Users, MoreVertical, Edit, Trash2, CheckCircle2, XCircle, AlertTriangle, Globe, AlertCircle, PlayCircle, Eye, History, RefreshCw, Save } from "lucide-react";
import { useClassificationDraftMap } from "@/hooks/useClassificationDraft";
import ControllingPersonForm from "./ControllingPersonForm";
import WorkflowRunner from "../workflows/WorkflowRunner";
import ControllingPersonDetails from "./ControllingPersonDetails";
import ControllingPersonClassificationHistory from "./ControllingPersonClassificationHistory";
import ControllingPersonBulkUpdateForm from "./ControllingPersonBulkUpdateForm";
import { Checkbox } from "@/components/ui/checkbox";
import { format } from "date-fns";

export default function ControllingPersonsList({ account, onUpdateCount, user: userProp }) {
  const [showForm, setShowForm] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [showClassification, setShowClassification] = useState(false);
  const [classifyingPerson, setClassifyingPerson] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [detailsPerson, setDetailsPerson] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [historyPerson, setHistoryPerson] = useState(null);
  const [entity, setEntity] = useState(null);
  const [selectedPersonIds, setSelectedPersonIds] = useState([]);
  const [showBulkUpdate, setShowBulkUpdate] = useState(false);
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const queryClient = useQueryClient();

  const { data: controllingPersons = [], isLoading } = useQuery({
    queryKey: ['controlling-persons', account?.id],
    queryFn: () => account?.id
      ? base44.entities.ControllingPerson.filter({ account_id: account.id })
      : [],
    enabled: !!account?.id
  });

  const { data: workflows = [] } = useQuery({
    queryKey: ['workflows', 'controlling_person_classification'],
    queryFn: () => base44.entities.Workflow.filter({ 
      workflow_type: 'controlling_person_classification',
      status: 'published'
    }),
    staleTime: 0, // Always fetch fresh data
    cacheTime: 0 // Don't cache workflow data
  });

  // Fetch entity data for workflow conditional logic
  useEffect(() => {
    if (account?.entity_id) {
      base44.entities.Entity.filter({ id: account.entity_id })
        .then(entities => {
          if (entities.length > 0) {
            setEntity(entities[0]);
          }
        })
        .catch(err => console.error('Error fetching entity:', err));
    }
  }, [account?.entity_id]);

  const syncControllingPersons = async () => {
    try {
      await base44.functions.invoke('syncAccountControllingPersons', { accountId: account.id });
      queryClient.invalidateQueries(['accounts']);
    } catch (error) {
      console.error('Failed to sync controlling persons count:', error);
    }
  };

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.ControllingPerson.create({
      ...data,
      tenant_id: account.tenant_id,
      account_id: account.id
    }),
    onSuccess: async () => {
      queryClient.invalidateQueries(['controlling-persons']);
      setShowForm(false);
      setSelectedPerson(null);
      await syncControllingPersons();
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ControllingPerson.update(id, data),
    onSuccess: async () => {
      queryClient.invalidateQueries(['controlling-persons']);
      setShowForm(false);
      setSelectedPerson(null);
      await syncControllingPersons();
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

  const handleSelectPerson = (personId) => {
    setSelectedPersonIds(prev =>
      prev.includes(personId) ? prev.filter(id => id !== personId) : [...prev, personId]
    );
  };

  const handleSelectAll = () => {
    if (selectedPersonIds.length === controllingPersons.length) {
      setSelectedPersonIds([]);
    } else {
      setSelectedPersonIds(controllingPersons.map(p => p.id));
    }
  };

  const handleBulkUpdate = async (field, value) => {
    setBulkUpdating(true);
    try {
      await Promise.all(selectedPersonIds.map(id =>
        base44.entities.ControllingPerson.update(id, { [field]: value })
      ));
      queryClient.invalidateQueries(['controlling-persons', account?.id]);
      setShowBulkUpdate(false);
      setSelectedPersonIds([]);
    } catch (err) {
      alert("Error updating controlling persons: " + err.message);
    } finally {
      setBulkUpdating(false);
    }
  };

  const handleClassify = async (person) => {
    // Invalidate workflow cache to ensure we get the latest version
    await queryClient.invalidateQueries(['workflows', 'controlling_person_classification']);
    setClassifyingPerson(person);
    setShowClassification(true);
  };

  const handleClassificationComplete = async (completionData) => {
    console.log('[ControllingPersonsList] handleClassificationComplete called');
    console.log('[ControllingPersonsList] Completion Data:', completionData);
    
    try {
      // Fetch current user for audit log
      const user = await base44.auth.me();
      
      // Extract classification data from workflow completion
      // completionData is an array of {step_id, step_title, answer, result_status, result_description}
      const workflowAnswers = {};
      let reportabilityStatus = null;
      let reportabilityReason = '';
      
      completionData.forEach(item => {
        workflowAnswers[item.step_id] = item.answer;
        
        // Get status from the last result step
        if (item.result_status) {
          reportabilityStatus = item.result_status;
        }
        if (item.result_description) {
          reportabilityReason = item.result_description;
        }
      });
      
      // Determine is_reportable boolean from status
      const isReportable = reportabilityStatus === 'reportable' || reportabilityStatus === true;
      
      // NOTE: The workflow's post-completion actions have already updated is_reportable
      // We only need to update the classification metadata here
      const classificationUpdate = {
        classification_answers: workflowAnswers,
        classification_date: new Date().toISOString(),
        classified_by: user?.email || 'unknown'
      };
      
      // Update the controlling person with classification metadata (workflow already updated is_reportable)
      await base44.entities.ControllingPerson.update(classifyingPerson.id, classificationUpdate);
      console.log('[ControllingPersonsList] ControllingPerson metadata updated successfully');
      
      // Create classification history record
      try {
        await base44.entities.ControllingPersonClassificationHistory.create({
          tenant_id: account.tenant_id,
          controlling_person_id: classifyingPerson.id,
          account_id: account.id,
          classification_date: new Date().toISOString(),
          reportability_status: isReportable,
          classification_reason: reportabilityReason || 'Classification completed via workflow',
          classification_source: 'workflow',
          workflow_answers: workflowAnswers,
          performed_by: user?.email || 'unknown',
          controlling_person_name: `${classifyingPerson.first_name || ''} ${classifyingPerson.last_name || ''}`.trim(),
          control_type: classifyingPerson.control_type,
          tax_residencies: classifyingPerson.tax_residencies
        });
        console.log('[ControllingPersonsList] ControllingPersonClassificationHistory created successfully');
      } catch (historyError) {
        console.error('[ControllingPersonsList] Error creating classification history:', historyError);
      }
      
      // Create audit log entry
      try {
        await base44.entities.AuditLog.create({
          tenant_id: account.tenant_id,
          action_type: 'account_updated',
          actor_email: user?.email || 'unknown',
          actor_role: user?.app_role || 'unknown',
          target_entity_type: 'ControllingPerson',
          target_entity_id: classifyingPerson.id,
          target_entity_name: `${classifyingPerson.first_name || ''} ${classifyingPerson.last_name || ''}`.trim(),
          changes: {
            is_reportable: isReportable,
            classification_date: classificationUpdate.classification_date
          },
          timestamp: new Date().toISOString()
        });
        console.log('[ControllingPersonsList] AuditLog entry created successfully');
      } catch (auditError) {
        console.error('[ControllingPersonsList] Error creating audit log:', auditError);
      }
      
      // Invalidate queries to refresh the data
      await queryClient.invalidateQueries(['controlling-persons', account?.id]);
      await queryClient.invalidateQueries(['accounts']);
      
      // Close the dialog
      setShowClassification(false);
      setClassifyingPerson(null);
      
      console.log('[ControllingPersonsList] Classification completed, queries invalidated');
    } catch (error) {
      console.error('[ControllingPersonsList] Error in handleClassificationComplete:', error);
      alert('Error completing classification: ' + error.message);
    }
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
            <div className="flex gap-2">
              {selectedPersonIds.length > 0 && (
                <Button
                  onClick={() => setShowBulkUpdate(true)}
                  variant="outline"
                  className="gap-2 border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                >
                  <RefreshCw className="w-4 h-4" />
                  Bulk Update ({selectedPersonIds.length})
                </Button>
              )}
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
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedPersonIds.length === controllingPersons.length && controllingPersons.length > 0}
                        onCheckedChange={handleSelectAll}
                      />
                    </TableHead>
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
                        <Checkbox
                          checked={selectedPersonIds.includes(person.id)}
                          onCheckedChange={() => handleSelectPerson(person.id)}
                        />
                      </TableCell>
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
                          {person.date_of_birth ? format(new Date(person.date_of_birth.replace(/-/g, '/')), 'MMM d, yyyy') : '—'}
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
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => {
                                setDetailsPerson(person);
                                setShowDetails(true);
                              }}>
                                <Eye className="w-4 h-4 mr-2" />
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => {
                                setHistoryPerson(person);
                                setShowHistory(true);
                              }}>
                                <History className="w-4 h-4 mr-2" />
                                View History
                              </DropdownMenuItem>
                              {workflows.length > 0 && (
                                <DropdownMenuItem onClick={() => handleClassify(person)}>
                                  <PlayCircle className="w-4 h-4 mr-2 text-indigo-600" />
                                  {person.is_reportable === null || person.is_reportable === undefined ? "Classify" : "Re-Classify"}
                                </DropdownMenuItem>
                              )}
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
              <DialogTitle>
                Classify Controlling Person: {
                  classifyingPerson.first_name && classifyingPerson.last_name
                    ? `${classifyingPerson.first_name} ${classifyingPerson.last_name}`
                    : classifyingPerson.full_name || "N/A"
                }
              </DialogTitle>
            </DialogHeader>
            <WorkflowRunner
              workflow={workflows[0]}
              accountId={account?.id}
              initialData={{ controlling_person: classifyingPerson, account, entity }}
              onComplete={handleClassificationComplete}
              onCancel={() => setShowClassification(false)}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Details Dialog */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Controlling Person Details</DialogTitle>
          </DialogHeader>
          <ControllingPersonDetails 
            controllingPerson={detailsPerson} 
            account={account}
          />
        </DialogContent>
      </Dialog>

      {/* Bulk Update Dialog */}
      <Dialog open={showBulkUpdate} onOpenChange={setShowBulkUpdate}>
        <DialogContent className="max-w-xl" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Bulk Update Controlling Persons</DialogTitle>
          </DialogHeader>
          <ControllingPersonBulkUpdateForm
            selectedPersons={controllingPersons.filter(p => selectedPersonIds.includes(p.id))}
            onUpdate={handleBulkUpdate}
            onCancel={() => setShowBulkUpdate(false)}
            isLoading={bulkUpdating}
          />
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Classification History</DialogTitle>
          </DialogHeader>
          <ControllingPersonClassificationHistory 
            controllingPerson={historyPerson}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}