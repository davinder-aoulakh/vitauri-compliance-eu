import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, ArrowLeft, Info, FileCheck, Loader2, AlertCircle, Users, Check, GitBranch, Sparkles } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import WorkflowVisualizer from "../workflows/WorkflowVisualizer";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import AIClassificationAssistant from "../ai/AIClassificationAssistant";
import QuestionRenderer from "../workflows/QuestionRenderer";
import ClassificationSummary from "../workflows/ClassificationSummary";
import AIWorkflowHelper from "../ai/AIWorkflowHelper";

export default function AccountClassificationFixed({ account, onComplete, onCancel }) {
  const [currentNodeId, setCurrentNodeId] = useState(null);
  const [answers, setAnswers] = useState({});
  const [selectedValue, setSelectedValue] = useState("");
  const [history, setHistory] = useState([]);
  const [user, setUser] = useState(null);
  const [workflow, setWorkflow] = useState(null);
  const [showSummary, setShowSummary] = useState(false);
  const [completedPath, setCompletedPath] = useState([]);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [multiFieldValues, setMultiFieldValues] = useState({});
  const [multiFieldErrors, setMultiFieldErrors] = useState({});
  const [showFlowchart, setShowFlowchart] = useState(false);
  const [showAIAssistant, setShowAIAssistant] = useState(false);
  const [dateValue, setDateValue] = useState("");
  const [latestAccountData, setLatestAccountData] = useState(null);
  const [addressValues, setAddressValues] = useState({
    street: "",
    city: "",
    state: "",
    postal_code: "",
    country: ""
  });
  const [dragActive, setDragActive] = useState(false);
  const [showDocumentPreview, setShowDocumentPreview] = useState(false);
  const [previewDocument, setPreviewDocument] = useState(null);
  const [dateReceivedValue, setDateReceivedValue] = useState("");

  const { data: freshAccountData, refetch: refetchAccount } = useQuery({
    queryKey: ['account-fresh', account?.id],
    queryFn: async () => {
      if (!account?.id) return null;
      const accounts = await base44.entities.Account.filter({ id: account.id });
      return accounts[0] || null;
    },
    enabled: !!account?.id,
    staleTime: 0,
  });

  useEffect(() => {
    if (freshAccountData) {
      setLatestAccountData(freshAccountData);
    }
  }, [freshAccountData]);

  useEffect(() => {
    const handleAccountUpdate = (event) => {
      console.log('[ACCOUNT UPDATE EVENT] Received:', event.detail);
      refetchAccount();
    };

    window.addEventListener('account-updated', handleAccountUpdate);
    return () => window.removeEventListener('account-updated', handleAccountUpdate);
  }, [refetchAccount]);

  const { data: workflows = [], isLoading } = useQuery({
    queryKey: ['account-workflows'],
    queryFn: () => base44.entities.Workflow.filter({
      workflow_type: 'account_reportability',
      status: 'published'
    }),
    enabled: !!account
  });

  const { data: referencedData = [] } = useQuery({
    queryKey: ['referenced-data-for-triggers'],
    queryFn: () => base44.entities.ReferencedData.list(),
    staleTime: Infinity
  });

  const { data: crsCountryMap = {} } = useQuery({
    queryKey: ['crs-country-map-for-evaluation'],
    queryFn: async () => {
      const countries = await base44.entities.CrsCountryInfo.list();
      const map = {};
      countries.forEach(c => {
        if (c.country_name) {
          map[c.country_name.toLowerCase()] = {
            code: c.country_code?.toUpperCase(),
            isCrs: c.is_crs_country
          };
        }
        if (c.country_code) {
          map[c.country_code.toLowerCase()] = {
            code: c.country_code?.toUpperCase(),
            isCrs: c.is_crs_country
          };
        }
      });
      return map;
    },
    staleTime: Infinity,
    enabled: !!account
  });

  const { data: linkedEntity } = useQuery({
    queryKey: ['linked-entity', account?.entity_id],
    queryFn: async () => {
      if (!account?.entity_id) return null;
      const entities = await base44.entities.Entity.filter({ id: account.entity_id });
      return entities[0] || null;
    },
    enabled: !!account?.entity_id,
    staleTime: 60000
  });

  // Create stepMap as useMemo for stable reference
  const stepMap = useMemo(() => {
    const map = {};
    if (workflow?.steps) {
      workflow.steps.forEach(step => {
        map[step.step_id] = step;
      });
    }
    return map;
  }, [workflow]);

  useEffect(() => {
    if (account) {
      loadUser();
    }
  }, [account]);

  // Initialize workflow and first step
  useEffect(() => {
    if (workflows.length > 0 && !workflow && account) {
      if (account.entity_id && !linkedEntity) {
        console.log('⏳ [WORKFLOW SELECTION] Waiting for linked entity to load...');
        return;
      }
      
      console.log('\n🔵🔵🔵 [WORKFLOW SELECTION] Starting workflow selection...');
      
      const matchingWorkflows = workflows.filter(w => {
        if (w.trigger_conditions?.enabled) {
          return evaluateTriggerConditions(w.trigger_conditions, account, linkedEntity);
        }
        return false;
      });

      let selectedWorkflow = null;

      if (matchingWorkflows.length > 0) {
        const sortedWorkflows = matchingWorkflows.sort((a, b) => {
          const priorityA = a.trigger_conditions?.priority || 0;
          const priorityB = b.trigger_conditions?.priority || 0;
          if (priorityB !== priorityA) return priorityB - priorityA;
          return parseFloat(b.version || "1.0") - parseFloat(a.version || "1.0");
        });
        selectedWorkflow = sortedWorkflows[0];
      }

      if (selectedWorkflow && selectedWorkflow.steps?.length > 0) {
        console.log(`🏁 Setting workflow and first step: ${selectedWorkflow.steps[0].step_id}`);
        setWorkflow(selectedWorkflow);
        setCurrentNodeId(selectedWorkflow.steps[0].step_id);
      }
    }
  }, [workflows, workflow, account, linkedEntity]);

  const loadUser = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
    } catch (error) {
      console.error("Error loading user:", error);
    }
  };

  const evaluateTriggerConditions = (triggerConfig, accountData, entityData = null) => {
    // ... keep existing code (trigger evaluation logic from lines 137-412)
    return true; // Placeholder
  };

  const getFieldValue = (fieldPath, entityData = null, currentAnswers = null) => {
    const answersToUse = currentAnswers !== null ? currentAnswers : answers;
    
    if (fieldPath.includes('.')) {
      const parts = fieldPath.split('.');
      const stepAnswer = answersToUse[parts[0]];
      if (stepAnswer && typeof stepAnswer === 'object') {
        return stepAnswer[parts[1]];
      }
      if (parts[0] === 'account_holder_address' || parts[0] === 'current_address') {
        return account?.[parts[0]]?.[parts[1]];
      }
      if (entityData && parts[0] === 'entity') {
        return entityData[parts[1]];
      }
      return null;
    }

    if (answersToUse[fieldPath] !== undefined) {
      return answersToUse[fieldPath];
    }

    if (fieldPath === '_is_pre_existing' || fieldPath === 'is_pre_existing') {
      return account?.is_pre_existing;
    } else if (fieldPath === '_account_holder_is_alive' || fieldPath === 'account_holder_is_alive') {
      return account?.account_holder_is_alive;
    } else if (fieldPath === '_account_holder_type' || fieldPath === 'account_holder_type') {
      return account?.account_holder_type;
    } else if (fieldPath === 'country_of_residence') {
      return account?.country_of_residence;
    } else if (fieldPath === 'place_of_birth') {
      return account?.place_of_birth;
    }

    if (account?.[fieldPath] !== undefined) {
      return account[fieldPath];
    }

    if (entityData?.[fieldPath] !== undefined) {
      return entityData[fieldPath];
    }

    return null;
  };

  // ... rest of component (evaluateSingleCondition, other functions, render)
  
  if (!currentNodeId && !showSummary) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        <p className="text-sm text-slate-600 ml-3">Loading workflow...</p>
      </div>
    );
  }

  const currentNode = showSummary ? null : stepMap[currentNodeId];

  if (!currentNode && !showSummary) {
    return (
      <div className="p-12 text-center">
        <Alert className="bg-red-50 border-red-200">
          <AlertDescription className="text-red-900">
            Workflow configuration error. Current step "{currentNodeId}" not found in workflow.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return <div>Placeholder - component under reconstruction</div>;
}