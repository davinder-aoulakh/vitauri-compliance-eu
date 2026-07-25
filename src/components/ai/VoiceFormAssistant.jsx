import React, { useState, useRef, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Mic, MicOff, Loader2, CheckCircle2, X, Volume2, MessageCircle } from "lucide-react";

const FIELD_HINTS = {
  account: `Available fields:
- first_name, last_name, middle_name, name_prefix, title
- account_holder_name (entity accounts)
- date_of_birth (YYYY-MM-DD), place_of_birth
- current_email, current_phone
- year_end_cash_value (number), gross_payments (number)
- year_end_cash_value_currency, gross_payments_currency (3-letter ISO code)
- reporting_year, account_number
- account_holder_address.street, account_holder_address.city, account_holder_address.state, account_holder_address.postal_code, account_holder_address.country
- current_address.street, current_address.city, current_address.state, current_address.postal_code, current_address.country
- account_holder_is_alive (true/false), is_pre_existing (true/false)
- account_type: depository | custodial | equity_debt_interest | cash_value_insurance | annuity
- status: active | closed | dormant`,

  controlling_person: `Available fields:
- first_name, last_name
- date_of_birth (YYYY-MM-DD)
- control_type: legal_person_ownership | legal_person_other_means | legal_person_senior_managing_official | trust_settlor | trust_trustee | trust_protector | trust_beneficiary | trust_other | legal_arrangement_settlor_equivalent | legal_arrangement_trustee_equivalent | legal_arrangement_protector_equivalent | legal_arrangement_beneficiary_equivalent | legal_arrangement_other_equivalent
- ownership_percentage (0-100)
- is_reportable (true/false)
- address.street, address.city, address.state, address.postal_code, address.country`,

  entity: `Available fields:
- entity_name
- entity_type: corporation | trust | partnership | fund | branch | other
- country_of_incorporation
- tax_id, giin
- rfi_status: pending_classification | reporting_fi | non_reporting_fi | nfe_active | nfe_passive
- fi_type: custodial_institution | depository_institution | investment_entity | specified_insurance_company | not_applicable
- address.street, address.city, address.state, address.postal_code, address.country`,
};

const CLOSE_KEYWORDS = ["close", "close form", "cancel form", "discard changes", "exit form"];
const SAVE_KEYWORDS = ["save", "save it", "save now", "save changes", "commit", "apply changes"];

export default function VoiceFormAssistant({
  formData,
  formType = "account",
  onApplyChanges,
  onRequestSave,
  onClose,
}) {
  const [status, setStatus] = useState("idle");
  const [transcript, setTranscript] = useState("");
  const [appliedChanges, setAppliedChanges] = useState([]);
  const [assistantMessage, setAssistantMessage] = useState("");
  const [error, setError] = useState("");
  const [conversationHistory, setConversationHistory] = useState([]);

  const recognitionRef = useRef(null);
  const statusRef = useRef("idle");
  const formDataRef = useRef(formData);

  // Keep formDataRef in sync with latest formData prop
  useEffect(() => {
    formDataRef.current = formData;
  }, [formData]);

  const isSupported =
    typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);
  const isSpeechSynthSupported =
    typeof window !== "undefined" && "speechSynthesis" in window;

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
      if (isSpeechSynthSupported) window.speechSynthesis.cancel();
    };
  }, []);

  const speak = (text, onDone) => {
    if (!isSpeechSynthSupported) { onDone?.(); return; }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.05;
    utterance.onend = () => onDone?.();
    window.speechSynthesis.speak(utterance);
  };

  const startListening = () => {
    if (!isSupported) {
      setError("Voice input is not supported in this browser. Please use Chrome or Edge.");
      return;
    }
    if (isSpeechSynthSupported) window.speechSynthesis.cancel();
    setError("");
    setTranscript("");

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
    recognitionRef.current?.stop();
    statusRef.current = "idle";
    setStatus("idle");
  };

  const processTranscript = async (text) => {
    const lower = text.toLowerCase().trim();

    // Pre-LLM: close keywords (exact/prefix)
    if (CLOSE_KEYWORDS.some(k => lower === k || lower.startsWith(k))) {
      speak("Closing the form.", () => onClose?.());
      statusRef.current = "idle";
      setStatus("idle");
      return;
    }

    // Pre-LLM: save keywords
    let wantsSave = SAVE_KEYWORDS.some(k => lower.includes(k));

    const recentHistory = conversationHistory.slice(-4)
      .map(h => `${h.role === "user" ? "User" : "Assistant"}: ${h.text}`)
      .join("\n");

    const prompt = `You are a friendly, conversational compliance form assistant helping a user update a ${formType} record by voice.

${recentHistory ? `Recent conversation:\n${recentHistory}\n` : ""}
User just said: "${text}"

Current form data:
${JSON.stringify(formDataRef.current, null, 2)}

${FIELD_HINTS[formType] || FIELD_HINTS.account}

Your job:
1. Extract any field changes and apply them immediately — do NOT ask for confirmation first.
2. Write a SHORT, natural conversational reply (1-2 sentences max).
3. If user says "save"/"commit"/"update"/"apply changes", set wants_save=true.
4. If nothing changed, just reply conversationally with changes=[].

Response schema: { changes: [{field, value, label}], wants_save: bool, assistant_reply: string }`;

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
                  label: { type: "string" },
                },
              },
            },
            wants_save: { type: "boolean" },
            assistant_reply: { type: "string" },
          },
        },
      });

      const changes = result.changes || [];
      const reply = result.assistant_reply || "Done! Anything else you'd like me to update?";
      if (result.wants_save) wantsSave = true;

      setConversationHistory(prev => [
        ...prev,
        { role: "user", text },
        { role: "assistant", text: reply },
      ]);

      setAssistantMessage(reply);

      if (changes.length > 0) {
        // Atomic bulk update
        const changeObj = {};
        changes.forEach(({ field, value }) => {
          changeObj[field] = value;
        });
        onApplyChanges?.(changeObj);
        setAppliedChanges(changes);
      }

      if (wantsSave && onRequestSave) {
        setTimeout(() => onRequestSave(), 600);
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
    setAppliedChanges([]);
    setAssistantMessage("");
    setError("");
    setConversationHistory([]);
  };

  if (!isSupported) return null;

  return (
    <div className="space-y-3">
      {/* Controls row */}
      <div className="flex items-center gap-3 flex-wrap">
        {status === "idle" && (
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
            onClick={() => {
              window.speechSynthesis.cancel();
              statusRef.current = "idle";
              setStatus("idle");
            }}
            className="gap-2 border-indigo-200 text-indigo-700 bg-indigo-50"
          >
            <Volume2 className="w-4 h-4 animate-pulse" />
            Speaking… (click to stop)
          </Button>
        )}

        {transcript && (
          <div className="flex items-center gap-2 text-sm text-slate-500 italic">
            <Mic className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate max-w-xs">"{transcript}"</span>
          </div>
        )}

        {conversationHistory.length > 0 && status === "idle" && (
          <button
            type="button"
            onClick={reset}
            className="text-xs text-slate-400 hover:text-slate-600 ml-auto underline"
          >
            End conversation
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          <span className="flex-1">{error}</span>
          <button type="button" onClick={() => setError("")}>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Assistant reply */}
      {assistantMessage && (
        <Card className="border border-indigo-100 bg-gradient-to-br from-indigo-50/60 to-purple-50/40">
          <CardContent className="p-3 flex items-start gap-3">
            <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center flex-shrink-0 mt-0.5">
              <MessageCircle className="w-3.5 h-3.5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-slate-800">{assistantMessage}</p>
              {appliedChanges.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {appliedChanges.map((c, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-800 rounded-full px-2 py-0.5"
                    >
                      <CheckCircle2 className="w-3 h-3" />
                      {c.label || c.field.replace(/[._]/g, " ")}:{" "}
                      {typeof c.value === "boolean"
                        ? c.value ? "Yes" : "No"
                        : String(c.value)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}