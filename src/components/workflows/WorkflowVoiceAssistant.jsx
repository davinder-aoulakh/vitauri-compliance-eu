import React, { useState, useRef, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Mic, MicOff, Loader2, CheckCircle2, X, Volume2, MessageCircle } from "lucide-react";

const NEXT_PHRASES = ["next", "confirm", "done", "submit", "proceed", "continue", "go ahead", "move on"];
const BACK_PHRASES = ["back", "previous", "go back", "prev", "undo", "last question", "previous question"];
const SUMMARY_PHRASES = ["view summary", "show summary", "summary", "go to summary", "proceed to summary", "see summary", "open summary"];
const COMPLETE_PHRASES = ["complete classification", "complete", "finish classification", "finish", "save classification", "submit classification", "finalize", "confirm classification"];

function matchPhrase(lowerText, phrases) {
  return phrases.some(p => lowerText === p || lowerText.includes(p));
}

function buildStepContext(step) {
  if (!step) return "";
  const qt = step.question_type;
  const opts = step.options || [];

  switch (qt) {
    case "yes_no":
    case "single_choice": {
      const optList = opts.map(o => `value="${o.value}" label="${o.label}"`).join(" | ");
      return `Question type: ${qt}.
AVAILABLE OPTIONS: ${optList}
CRITICAL: You MUST return the EXACT "value" string from one of the options above — do NOT return the label, do NOT paraphrase, do NOT return any other string. For yes/no questions the values are typically "YES" or "NO". If the user says "yes", "yeah", "correct", "affirmative" → return "YES". If the user says "no", "nope", "negative" → return "NO". Match the user's intent to the closest option value.`;
    }
    case "multiple_choice": {
      const optList = opts.map(o => `value="${o.value}" label="${o.label}"`).join(" | ");
      return `Question type: multiple_choice.
AVAILABLE OPTIONS: ${optList}
Return a JSON ARRAY of exact "value" strings from the options above that match what the user said. NEVER return labels.`;
    }
    case "text_input":
    case "textarea":
      return `Question type: ${qt}. Extract the free-text answer. Return as a string.`;
    case "number_input":
      return `Question type: number_input. Extract the numeric value. Return as a string of just the number.`;
    case "date_input":
      return `Question type: date_input. Extract the date and return in YYYY-MM-DD format only.`;
    case "file_upload": {
      const hasDateRequired = step.file_upload_config?.require_date_received;
      if (hasDateRequired) {
        return `Question type: file_upload with date_received required. Voice cannot upload files. If user mentions a date, return it in YYYY-MM-DD format. Otherwise return null and explain file upload must be done manually.`;
      }
      return `Question type: file_upload. Voice cannot upload files. Return null and tell the user to use the upload button.`;
    }
    case "multi_field_input": {
      const fields = step.multi_fields || [];
      return `Question type: multi_field_input. Fields: ${fields.map(f => `${f.field_id} (${f.label})`).join(", ")}. Return a JSON object {field_id: value}. Only include fields the user actually mentioned. NEVER return a raw string.`;
    }
    case "address_input":
      return `Question type: address_input. Return a JSON object with only the fields the user mentioned: {street, city, state, postal_code, country, tax_residence_country, tin}.`;
    case "beneficiary_input":
    case "controlling_person_input":
      return `Question type: ${qt}. These require manual form input. Return null and tell the user to use the form.`;
    case "info":
    case "result":
      return `This is a navigation-only step (${qt}). Do not extract answers — only handle navigation phrases.`;
    default:
      return `Question type: ${qt}.`;
  }
}

export default function WorkflowVoiceAssistant({
  currentStep,
  answers,
  onApplyAnswer,
  onProceed,
  onGoBack,
  onSummary,
  onComplete,
  summaryMode = false,
}) {
  const [status, setStatus] = useState("idle");
  const [transcript, setTranscript] = useState("");
  const [message, setMessage] = useState("");
  const [confirmedValue, setConfirmedValue] = useState(null);
  const [error, setError] = useState("");

  const recognitionRef = useRef(null);
  const statusRef = useRef("idle");

  const isSupported =
    typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);
  const isSpeechSynthSupported =
    typeof window !== "undefined" && "speechSynthesis" in window;

  // Reset state when step changes
  useEffect(() => {
    setTranscript("");
    setMessage("");
    setConfirmedValue(null);
    setError("");
    statusRef.current = "idle";
    setStatus("idle");
    recognitionRef.current?.abort();
    if (isSpeechSynthSupported) window.speechSynthesis.cancel();
  }, [currentStep?.step_id]);

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
      setError("Voice input not supported. Please use Chrome or Edge.");
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

    // Nav-only mode: summaryMode or info/result step
    const isNavOnly = summaryMode || currentStep?.question_type === "info" || currentStep?.question_type === "result";

    // Pre-LLM phrase matching — instant, no API
    if (matchPhrase(lower, COMPLETE_PHRASES) && onComplete) {
      speak("Completing the classification.", () => onComplete());
      statusRef.current = "idle"; setStatus("idle");
      return;
    }
    if (matchPhrase(lower, SUMMARY_PHRASES) && onSummary) {
      speak("Going to the summary.", () => onSummary());
      statusRef.current = "idle"; setStatus("idle");
      return;
    }
    if (matchPhrase(lower, NEXT_PHRASES) && onProceed) {
      speak("Moving to the next question.", () => onProceed());
      statusRef.current = "idle"; setStatus("idle");
      return;
    }
    if (matchPhrase(lower, BACK_PHRASES) && onGoBack) {
      speak("Going back.", () => onGoBack());
      statusRef.current = "idle"; setStatus("idle");
      return;
    }

    if (isNavOnly) {
      setMessage("You can say 'next', 'back', 'summary', or 'complete' to navigate.");
      statusRef.current = "idle"; setStatus("idle");
      return;
    }

    // LLM call for answer extraction
    const stepContext = buildStepContext(currentStep);
    const prompt = `You are a compliance workflow voice assistant helping a user answer a classification question by voice.

Step: "${currentStep?.step_title}"
Question: "${currentStep?.question_text || ""}"
Help text: "${currentStep?.help_text || ""}"

${stepContext}

User said: "${text}"

RULES:
- For yes_no and single_choice questions, "value" MUST be one of the exact option value strings listed above — nothing else.
- Do NOT return a label as the value. Do NOT return null for yes/no if the user's intent is clear.
- Keep assistant_reply to 1 short sentence confirming what was selected.
- Only set wants_proceed/wants_back/wants_summary/wants_complete if the user explicitly asked to navigate.

Response schema:
{
  "value": <extracted exact option value string, array, object, or null>,
  "assistant_reply": "<1 short sentence>",
  "wants_proceed": false,
  "wants_back": false,
  "wants_summary": false,
  "wants_complete": false
}`;

    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            value: {},
            assistant_reply: { type: "string" },
            wants_proceed: { type: "boolean" },
            wants_back: { type: "boolean" },
            wants_summary: { type: "boolean" },
            wants_complete: { type: "boolean" },
          },
        },
      });

      const reply = result.assistant_reply || "Got it.";
      setMessage(reply);

      if (result.value !== null && result.value !== undefined) {
        // Client-side safety: snap value to a valid option for yes_no / single_choice
        let finalValue = result.value;
        const qt = currentStep?.question_type;
        const opts = currentStep?.options || [];
        if ((qt === "yes_no" || qt === "single_choice") && opts.length > 0) {
          const exactMatch = opts.find(o => o.value === finalValue);
          if (!exactMatch) {
            // Try label match (case-insensitive)
            const labelMatch = opts.find(o =>
              o.label?.toLowerCase() === String(finalValue).toLowerCase() ||
              o.value?.toLowerCase() === String(finalValue).toLowerCase()
            );
            // Fallback: YES/NO keyword snapping
            if (labelMatch) {
              finalValue = labelMatch.value;
            } else {
              const s = String(finalValue).toLowerCase();
              const yesOpt = opts.find(o => o.value === "YES" || o.label?.toLowerCase() === "yes");
              const noOpt = opts.find(o => o.value === "NO" || o.label?.toLowerCase() === "no");
              if (yesOpt && (s.includes("yes") || s.includes("true") || s.includes("correct") || s.includes("affirm"))) {
                finalValue = yesOpt.value;
              } else if (noOpt && (s.includes("no") || s.includes("false") || s.includes("negative"))) {
                finalValue = noOpt.value;
              } else {
                // Can't determine — don't apply
                finalValue = null;
              }
            }
          }
        }
        if (finalValue !== null && finalValue !== undefined) {
          onApplyAnswer?.(finalValue);
          setConfirmedValue(finalValue);
        }
      }

      statusRef.current = "speaking";
      setStatus("speaking");
      speak(reply, () => {
        statusRef.current = "idle";
        setStatus("idle");
        // Post-speak navigation
        if (result.wants_complete && onComplete) onComplete();
        else if (result.wants_summary && onSummary) onSummary();
        else if (result.wants_proceed && onProceed) onProceed();
        else if (result.wants_back && onGoBack) onGoBack();
      });
    } catch (err) {
      setError("Failed to process voice command. Please try again.");
      statusRef.current = "idle";
      setStatus("idle");
    }
  };

  if (!isSupported) return null;

  return (
    <div className="space-y-2">
      {/* Controls */}
      <div className="flex items-center gap-2 flex-wrap">
        {status === "idle" && (
          <Button
            type="button"
            variant="outline"
            onClick={startListening}
            className="gap-2 bg-gradient-to-r from-rose-50 to-pink-50 hover:from-rose-100 hover:to-pink-100 border-rose-200 text-rose-700 text-sm"
          >
            <Mic className="w-4 h-4" />
            Answer by Voice
          </Button>
        )}

        {status === "listening" && (
          <Button
            type="button"
            variant="outline"
            onClick={stopListening}
            className="gap-2 bg-rose-600 hover:bg-rose-700 text-white border-rose-600 animate-pulse text-sm"
          >
            <MicOff className="w-4 h-4" />
            Listening… (click to stop)
          </Button>
        )}

        {status === "processing" && (
          <Button type="button" variant="outline" disabled className="gap-2 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            Processing…
          </Button>
        )}

        {status === "speaking" && (
          <Button
            type="button"
            variant="outline"
            onClick={() => { window.speechSynthesis.cancel(); statusRef.current = "idle"; setStatus("idle"); }}
            className="gap-2 border-indigo-200 text-indigo-700 bg-indigo-50 text-sm"
          >
            <Volume2 className="w-4 h-4 animate-pulse" />
            Speaking… (click to stop)
          </Button>
        )}


      </div>

      {/* Transcript */}
      {transcript && (
        <p className="text-xs text-slate-500 italic truncate" style={{ maxWidth: "200px" }}>
          "{transcript}"
        </p>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          <span className="flex-1">{error}</span>
          <button type="button" onClick={() => setError("")}><X className="w-3 h-3" /></button>
        </div>
      )}

      {/* Assistant reply */}
      {message && (
        <Card className="border border-indigo-100 bg-gradient-to-br from-indigo-50/60 to-purple-50/40">
          <CardContent className="p-2.5 flex items-start gap-2">
            <div className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center flex-shrink-0 mt-0.5">
              <MessageCircle className="w-3 h-3 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-slate-800">{message}</p>
              {confirmedValue !== null && (
                <span className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-800 rounded-full px-2 py-0.5 mt-1">
                  <CheckCircle2 className="w-3 h-3" />
                  {Array.isArray(confirmedValue)
                    ? confirmedValue.join(", ")
                    : typeof confirmedValue === "object"
                    ? JSON.stringify(confirmedValue)
                    : String(confirmedValue)}
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}