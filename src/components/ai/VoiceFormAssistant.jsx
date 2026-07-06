import React, { useState, useRef, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Mic, MicOff, Loader2, CheckCircle2, X, Volume2 } from "lucide-react";

/**
 * VoiceFormAssistant
 * 
 * A floating voice input button that:
 * 1. Records user speech via Web Speech API (browser-native, free)
 * 2. Sends the transcript to InvokeLLM with the current form schema
 * 3. Returns a set of field changes for user to review + apply
 * 
 * Props:
 *   formData        - current form state object
 *   formType        - "account" | "entity"
 *   onApplyChanges  - callback(changesObject) — same shape as handleAISuggestionApply
 */
export default function VoiceFormAssistant({ formData, formType = "account", onApplyChanges }) {
  const [status, setStatus] = useState("idle"); // idle | listening | processing | review
  const [transcript, setTranscript] = useState("");
  const [pendingChanges, setPendingChanges] = useState([]);
  const [error, setError] = useState("");
  const recognitionRef = useRef(null);
  const statusRef = useRef("idle");

  // Check browser support
  const isSupported = typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  const startListening = () => {
    if (!isSupported) {
      setError("Voice input is not supported in this browser. Please use Chrome or Edge.");
      return;
    }
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
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    statusRef.current = "idle";
    setStatus("idle");
  };

  const processTranscript = async (text) => {
    // Build a schema summary so the LLM knows what fields are available
    const fieldHints = formType === "account"
      ? `Available fields (use exact key names):
- first_name, last_name, middle_name, name_prefix, title (individual only)
- account_holder_name (entity accounts)
- date_of_birth (YYYY-MM-DD), place_of_birth (country name)
- current_email, current_phone
- year_end_cash_value (number), gross_payments (number)
- year_end_cash_value_currency, gross_payments_currency (3-letter currency code)
- reporting_year (4-digit year string)
- account_number
- account_holder_address.street, account_holder_address.city, account_holder_address.state, account_holder_address.postal_code, account_holder_address.country
- current_address.street, current_address.city, current_address.state, current_address.postal_code, current_address.country
- account_holder_is_alive (true/false)
- is_pre_existing (true/false)
- account_type: depository | custodial | equity_debt_interest | cash_value_insurance | annuity
- status: active | closed | dormant`
      : `Available fields (use exact key names):
- entity_name
- entity_type: corporation | trust | partnership | fund | branch | other
- country_of_incorporation (country name)
- tax_id, giin
- rfi_status: pending_classification | reporting_fi | non_reporting_fi | nfe_active | nfe_passive
- fi_type: custodial_institution | depository_institution | investment_entity | specified_insurance_company | not_applicable
- address.street, address.city, address.state, address.postal_code, address.country`;

    const prompt = `You are a compliance form assistant. A user has spoken the following voice command to update a ${formType} record:

"${text}"

Current form data (for context):
${JSON.stringify(formData, null, 2)}

${fieldHints}

Extract ONLY the fields the user explicitly wants to change from their voice command. 
Return ONLY changes the user mentioned — do not suggest other fields.
For nested fields like address, use dot notation (e.g. "account_holder_address.city").
For boolean fields, use true or false.
If the command is unclear or contains no actionable field changes, return an empty changes array.`;

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
                  field: { type: "string", description: "Dot-notation field key" },
                  value: { description: "New value for the field" },
                  label: { type: "string", description: "Human-readable field label" }
                }
              }
            },
            interpretation: { type: "string", description: "One sentence summary of what was understood" }
          }
        }
      });

      if (!result.changes || result.changes.length === 0) {
        setError(`Understood: "${result.interpretation || text}" — but no field changes were detected. Try being more specific, e.g. "Set first name to John".`);
        setStatus("idle");
        return;
      }

      setPendingChanges(result.changes);
      setStatus("review");
    } catch (err) {
      setError("Failed to process voice command. Please try again.");
      setStatus("idle");
    }
  };

  const applyAllChanges = () => {
    const changeObj = {};
    pendingChanges.forEach(({ field, value }) => {
      if (field.includes(".")) {
        const [parent, child] = field.split(".");
        if (!changeObj[parent]) changeObj[parent] = { ...(formData[parent] || {}) };
        changeObj[parent][child] = value;
      } else {
        changeObj[field] = value;
      }
    });
    onApplyChanges(changeObj);
    reset();
  };

  const removePendingChange = (index) => {
    setPendingChanges(prev => prev.filter((_, i) => i !== index));
  };

  const reset = () => {
    setStatus("idle");
    setTranscript("");
    setPendingChanges([]);
    setError("");
  };

  if (!isSupported) return null;

  return (
    <div className="space-y-3">
      {/* Main voice button */}
      <div className="flex items-center gap-3">
        {status === "idle" && (
          <Button
            type="button"
            variant="outline"
            onClick={startListening}
            className="gap-2 bg-gradient-to-r from-rose-50 to-pink-50 hover:from-rose-100 hover:to-pink-100 border-rose-200 text-rose-700"
          >
            <Mic className="w-4 h-4" />
            Voice Input
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

        {status === "review" && (
          <Button
            type="button"
            variant="outline"
            onClick={startListening}
            className="gap-2 border-slate-200"
          >
            <Mic className="w-4 h-4" />
            Record Again
          </Button>
        )}

        {transcript && (
          <div className="flex items-center gap-2 text-sm text-slate-500 italic">
            <Volume2 className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate max-w-xs">"{transcript}"</span>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          <span className="flex-1">{error}</span>
          <button type="button" onClick={() => setError("")} className="flex-shrink-0">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Pending changes review */}
      {status === "review" && pendingChanges.length > 0 && (
        <Card className="border-2 border-rose-100 bg-gradient-to-br from-rose-50/50 to-pink-50/50">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-800">AI understood these changes:</p>
              <button type="button" onClick={reset} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              {pendingChanges.map((change, idx) => (
                <div key={idx} className="flex items-center justify-between gap-3 bg-white rounded-lg border border-rose-100 px-3 py-2">
                  <div className="flex-1 min-w-0">
                    <span className="text-xs text-slate-500 capitalize">
                      {change.label || change.field.replace(/[._]/g, " ")}
                    </span>
                    <p className="text-sm font-medium text-slate-900 truncate">
                      {typeof change.value === "boolean"
                        ? (change.value ? "Yes" : "No")
                        : String(change.value)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removePendingChange(idx)}
                    className="text-slate-300 hover:text-slate-500 flex-shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex gap-2 pt-1">
              <Button
                type="button"
                size="sm"
                onClick={applyAllChanges}
                className="flex-1 bg-rose-600 hover:bg-rose-700 text-white"
              >
                <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                Apply {pendingChanges.length} Change{pendingChanges.length > 1 ? "s" : ""}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={reset}
                className="flex-1"
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