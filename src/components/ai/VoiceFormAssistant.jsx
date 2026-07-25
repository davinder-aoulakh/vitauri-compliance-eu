import React, { useState, useRef, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Mic, MicOff, Loader2, CheckCircle2, X, Volume2, MessageCircle, Save, Trash2 } from "lucide-react";

/**
 * VoiceFormAssistant
 * Conversational voice assistant that:
 * 1. Listens to speech via Web Speech API
 * 2. Extracts field changes + generates a conversational reply
 * 3. Stages changes locally — only commits when user says "save" or clicks Save Changes
 * 4. Stays in conversation — user can continue speaking follow-ups
 */
export default function VoiceFormAssistant({ formData, formType = "account", onApplyChanges, onSaveChanges }) {
  const [status, setStatus] = useState("idle"); // idle | listening | processing | speaking
  const [transcript, setTranscript] = useState("");
  // stagedChanges: accumulated voice changes not yet saved. key = field path, value = { value, label }
  const [stagedChanges, setStagedChanges] = useState({});
  const [pendingChanges, setPendingChanges] = useState([]); // last-utterance changes for display
  const [assistantMessage, setAssistantMessage] = useState("");
  const [error, setError] = useState("");
  const [conversationHistory, setConversationHistory] = useState([]);

  const recognitionRef = useRef(null);
  const statusRef = useRef("idle");
  const utteranceRef = useRef(null);

  const isSupported = typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);
  const isSpeechSynthSupported = typeof window !== "undefined" && "speechSynthesis" in window;

  useEffect(() => {
    return () => {
      if (recognitionRef.current) recognitionRef.current.abort();
      if (isSpeechSynthSupported) window.speechSynthesis.cancel();
    };
  }, []);

  const speak = (text, onDone) => {
    if (!isSpeechSynthSupported) {
      onDone?.();
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.05;
    utterance.pitch = 1;
    utterance.onend = () => onDone?.();
    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };

  const startListening = () => {
    if (!isSupported) {
      setError("Voice input is not supported in this browser. Please use Chrome or Edge.");
      return;
    }
    // Stop any ongoing speech before listening
    if (isSpeechSynthSupported) window.speechSynthesis.cancel();

    setError("");
    setTranscript("");
    setPendingChanges([]);

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognitionRef.current = recognition;

    recognition.onstart = () => { statusRef.current = "listening"; setStatus("listening"); };

    recognition.onresult = (event) => {
      const text = event.results[0][0].transcript;
      setTranscript(text);
      statusRef.current = "processing";
      setStatus("processing");
      processTranscript(text);
    };

    recognition.onerror = (event) => {
      setError("Microphone error: " + event.error);
      statusRef.current = "idle";
      setStatus("idle");
    };

    recognition.onend = () => {
      if (statusRef.current === "listening") {
        statusRef.current = "idle";
        setStatus("idle");
      }
    };

    recognition.start();
  };

  const stopListening = () => {
    if (recognitionRef.current) recognitionRef.current.stop();
    statusRef.current = "idle";
    setStatus("idle");
  };

  const buildFieldHints = () => {
    if (formType === "account") return `Available fields:
- first_name, last_name, middle_name, name_prefix, title
- account_holder_name (entity accounts)
- date_of_birth (YYYY-MM-DD), place_of_birth
- current_email, current_phone
- year_end_cash_value (number), gross_payments (number)
- year_end_cash_value_currency, gross_payments_currency (3-letter code)
- reporting_year, account_number
- account_holder_address.street, account_holder_address.city, account_holder_address.state, account_holder_address.postal_code, account_holder_address.country
- current_address.street, current_address.city, current_address.state, current_address.postal_code, current_address.country
- account_holder_is_alive (true/false), is_pre_existing (true/false)
- account_type: depository | custodial | equity_debt_interest | cash_value_insurance | annuity
- status: active | closed | dormant`;
    if (formType === "controlling_person") return `Available fields:
- first_name, last_name
- date_of_birth (YYYY-MM-DD)
- control_type: legal_person_ownership | legal_person_other_means | legal_person_senior_managing_official | trust_settlor | trust_trustee | trust_protector | trust_beneficiary | trust_other
- ownership_percentage (number)
- address.street, address.city, address.state, address.postal_code, address.country
- is_reportable (true/false)`;
    return `Available fields:
- entity_name
- entity_type: corporation | trust | partnership | fund | branch | other
- country_of_incorporation
- tax_id, giin
- rfi_status: pending_classification | reporting_fi | non_reporting_fi | nfe_active | nfe_passive
- fi_type: custodial_institution | depository_institution | investment_entity | specified_insurance_company | not_applicable
- address.street, address.city, address.state, address.postal_code, address.country`;
  };

  // Detect if the user's command is a save/commit intent
  const isSaveIntent = (text) => {
    const t = text.toLowerCase();
    return /\b(save|commit|confirm|apply|done|submit|go ahead|yes save|save (the )?changes|save (and )?update|save (and )?submit)\b/.test(t);
  };

  // Detect if the user wants to discard/cancel staged changes
  const isDiscardIntent = (text) => {
    const t = text.toLowerCase();
    return /\b(discard|cancel|undo|reset|revert|clear changes|forget (that|it)|start over)\b/.test(t);
  };

  const processTranscript = async (text) => {
    // Handle save intent — commit staged changes without calling LLM
    if (isSaveIntent(text)) {
      const hasStagedChanges = Object.keys(stagedChanges).length > 0;
      const reply = hasStagedChanges
        ? "Saving your changes now!"
        : "There are no pending changes to save.";

      setConversationHistory(prev => [...prev, { role: "user", text }, { role: "assistant", text: reply }]);
      setAssistantMessage(reply);

      if (hasStagedChanges) {
        commitStagedChanges();
      }

      statusRef.current = "speaking";
      setStatus("speaking");
      speak(reply, () => { statusRef.current = "idle"; setStatus("idle"); });
      return;
    }

    // Handle discard intent
    if (isDiscardIntent(text)) {
      const hasStagedChanges = Object.keys(stagedChanges).length > 0;
      const reply = hasStagedChanges
        ? "Okay, I've discarded all pending changes."
        : "There's nothing to discard.";

      setConversationHistory(prev => [...prev, { role: "user", text }, { role: "assistant", text: reply }]);
      setAssistantMessage(reply);
      setStagedChanges({});
      setPendingChanges([]);

      statusRef.current = "speaking";
      setStatus("speaking");
      speak(reply, () => { statusRef.current = "idle"; setStatus("idle"); });
      return;
    }

    const recentHistory = conversationHistory.slice(-4).map(h =>
      `${h.role === "user" ? "User" : "Assistant"}: ${h.text}`
    ).join("\n");

    // Merge formData with current staged changes so LLM sees up-to-date values
    const effectiveFormData = { ...formData };
    Object.entries(stagedChanges).forEach(([field, { value }]) => {
      if (field.includes(".")) {
        const [parent, child] = field.split(".");
        effectiveFormData[parent] = { ...(effectiveFormData[parent] || {}), [child]: value };
      } else {
        effectiveFormData[field] = value;
      }
    });

    const prompt = `You are a friendly, conversational compliance form assistant helping a user update a ${formType} record by voice.

${recentHistory ? `Recent conversation:\n${recentHistory}\n` : ""}
User just said: "${text}"

Current form data (including any pending changes not yet saved):
${JSON.stringify(effectiveFormData, null, 2)}

${buildFieldHints()}

Your job:
1. Extract any field changes the user wants to make and stage them — they will be saved when the user says "save".
2. Write a SHORT, natural conversational reply (1-2 sentences max) confirming what you've staged for update.
3. If nothing changed (e.g. a question or unclear command), just reply conversationally and set changes to empty.
4. Remind the user they can say "save changes" or "save" when ready to apply.

Keep replies warm and concise. Do not be robotic.`;

    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            changes: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  field: { type: "string" },
                  value: {},
                  label: { type: "string" }
                }
              }
            },
            assistant_reply: { type: "string" }
          }
        }
      });

      const changes = result.changes || [];
      const reply = result.assistant_reply || "Got it! Say 'save changes' when you're ready to apply.";

      setConversationHistory(prev => [
        ...prev,
        { role: "user", text },
        { role: "assistant", text: reply }
      ]);
      setAssistantMessage(reply);

      if (changes.length > 0) {
        // Stage changes locally — do NOT call onApplyChanges yet
        setStagedChanges(prev => {
          const updated = { ...prev };
          changes.forEach(({ field, value, label }) => {
            updated[field] = { value, label };
          });
          return updated;
        });
        setPendingChanges(changes);
      }

      statusRef.current = "speaking";
      setStatus("speaking");
      speak(reply, () => {
        statusRef.current = "idle";
        setStatus("idle");
      });

    } catch (err) {
      setError("Failed to process voice command. Please try again.");
      statusRef.current = "idle";
      setStatus("idle");
    }
  };

  const reset = () => {
    if (isSpeechSynthSupported) window.speechSynthesis.cancel();
    setStatus("idle");
    setTranscript("");
    setStagedChanges({});
    setPendingChanges([]);
    setAssistantMessage("");
    setError("");
    setConversationHistory([]);
  };

  // Commit all staged changes to the parent form
  const commitStagedChanges = () => {
    if (Object.keys(stagedChanges).length === 0) return;
    const changeObj = {};
    Object.entries(stagedChanges).forEach(([field, { value }]) => {
      if (field.includes(".")) {
        const [parent, child] = field.split(".");
        if (!changeObj[parent]) changeObj[parent] = { ...(formData[parent] || {}) };
        changeObj[parent][child] = value;
      } else {
        changeObj[field] = value;
      }
    });
    onApplyChanges(changeObj);
    if (onSaveChanges) onSaveChanges(changeObj);
    setStagedChanges({});
    setPendingChanges([]);
  };

  if (!isSupported) return null;

  return (
    <div className="space-y-3">
      {/* Controls row */}
      <div className="flex items-center gap-3 flex-wrap">
        {(status === "idle") && (
          <Button
            type="button"
            variant="outline"
            onClick={startListening}
            className="gap-2 bg-gradient-to-r from-rose-50 to-pink-50 hover:from-rose-100 hover:to-pink-100 border-rose-200 text-rose-700"
          >
            <Mic className="w-4 h-4" />
            {conversationHistory.length > 0 ? "Continue Speaking" : "Voice Input"}
          </Button>
        )}

        {status === "listening" && (
          <Button
            type="button"
            variant="outline"
            onClick={stopListening}
            className="gap-2 bg-rose-600 hover:bg-rose-700 text-white border-rose-600 animate-pulse"
          >
            <MicOff className="w-4 h-4" />
            Listening… (click to stop)
          </Button>
        )}

        {status === "processing" && (
          <Button type="button" variant="outline" disabled className="gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Processing…
          </Button>
        )}

        {status === "speaking" && (
          <Button
            type="button"
            variant="outline"
            onClick={() => { window.speechSynthesis.cancel(); statusRef.current = "idle"; setStatus("idle"); }}
            className="gap-2 border-indigo-200 text-indigo-700 bg-indigo-50"
          >
            <Volume2 className="w-4 h-4 animate-pulse" />
            Speaking… (click to stop)
          </Button>
        )}

        {transcript && (
          <div className="flex items-center gap-2 text-sm text-slate-500 italic">
            <Volume2 className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate max-w-xs">"{transcript}"</span>
          </div>
        )}

        {conversationHistory.length > 0 && status === "idle" && (
          <button type="button" onClick={reset} className="text-xs text-slate-400 hover:text-slate-600 ml-auto underline">
            End conversation
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          <span className="flex-1">{error}</span>
          <button type="button" onClick={() => setError("")}><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {/* Assistant conversational message */}
      {assistantMessage && (
        <Card className="border border-indigo-100 bg-gradient-to-br from-indigo-50/60 to-purple-50/40">
          <CardContent className="p-3 flex items-start gap-3">
            <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center flex-shrink-0 mt-0.5">
              <MessageCircle className="w-3.5 h-3.5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-slate-800">{assistantMessage}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Staged changes panel — shown when there are pending voice changes awaiting save */}
      {Object.keys(stagedChanges).length > 0 && (
        <Card className="border-2 border-amber-200 bg-amber-50/60">
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-amber-900 uppercase tracking-wide">
                Pending Voice Changes (not saved yet)
              </p>
              <button
                type="button"
                onClick={() => { setStagedChanges({}); setPendingChanges([]); }}
                className="text-amber-600 hover:text-amber-800"
                title="Discard all pending changes"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex flex-wrap gap-1 mb-3">
              {Object.entries(stagedChanges).map(([field, { value, label }], i) => (
                <span key={i} className="inline-flex items-center gap-1 text-xs bg-amber-100 text-amber-900 border border-amber-300 rounded-full px-2 py-0.5">
                  {label || field.replace(/[._]/g, " ")}: <strong>{typeof value === "boolean" ? (value ? "Yes" : "No") : String(value)}</strong>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                onClick={commitStagedChanges}
                className="bg-green-600 hover:bg-green-700 text-white text-xs h-7 px-3 gap-1"
              >
                <Save className="w-3 h-3" />
                Save Changes
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => { setStagedChanges({}); setPendingChanges([]); }}
                className="text-xs h-7 px-3 text-slate-600 border-slate-300"
              >
                Discard
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}