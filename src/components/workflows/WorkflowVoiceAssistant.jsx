import React, { useState, useRef, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Mic, MicOff, Loader2, CheckCircle2, X, Volume2, MessageCircle, ArrowRight } from "lucide-react";

/**
 * WorkflowVoiceAssistant
 * Navigation-aware voice assistant for classification workflows.
 * Handles: answering questions, navigating next/back, going to summary, completing workflow.
 */
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
  const [assistantMessage, setAssistantMessage] = useState("");
  const [confirmedValue, setConfirmedValue] = useState(null);
  const [error, setError] = useState("");

  const recognitionRef = useRef(null);
  const statusRef = useRef("idle");
  const stepIdRef = useRef(null);

  const isSupported =
    typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);
  const isSpeechSynthSupported =
    typeof window !== "undefined" && "speechSynthesis" in window;

  // Reset state when step changes
  useEffect(() => {
    const newStepId = currentStep?.step_id;
    if (newStepId && newStepId !== stepIdRef.current) {
      stepIdRef.current = newStepId;
      setTranscript("");
      setAssistantMessage("");
      setConfirmedValue(null);
      setError("");
      if (isSpeechSynthSupported) window.speechSynthesis.cancel();
    }
  }, [currentStep?.step_id]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) recognitionRef.current.abort();
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
      setError("Voice input not supported in this browser. Please use Chrome or Edge.");
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
      if (statusRef.current === "listening") { statusRef.current = "idle"; setStatus("idle"); }
    };
    recognition.start();
  };

  const stopListening = () => {
    if (recognitionRef.current) recognitionRef.current.stop();
    statusRef.current = "idle";
    setStatus("idle");
  };

  const checkPhrasesBeforeLLM = (text) => {
    const lower = text.toLowerCase().trim();

    // Summary navigation
    if (["view summary", "show summary", "go to summary", "see summary", "open summary"].some(p => lower.includes(p))) {
      onSummary?.();
      return "summary";
    }
    // Complete
    if (["complete classification", "finish classification", "finalize", "complete workflow", "finish workflow"].some(p => lower.includes(p))) {
      onComplete?.();
      return "complete";
    }
    // Back
    if (["go back", "previous question", "previous step", "back"].some(p => lower === p || lower.startsWith(p + " ") || lower.endsWith(" " + p))) {
      onGoBack?.();
      return "back";
    }
    // Next / confirm
    if (["next", "proceed", "continue", "next question", "confirm", "move on"].some(p => lower === p || lower.startsWith(p + " "))) {
      onProceed?.();
      return "next";
    }

    return null;
  };

  const buildStepContext = () => {
    if (summaryMode) {
      return `The user is on the SUMMARY/REVIEW screen. They can complete the classification or go back to review answers. 
Navigation commands: go back (call onGoBack), complete classification (call onComplete).`;
    }
    if (!currentStep) return "";

    const qt = currentStep.question_type;
    let context = `Current step: "${currentStep.step_title}"\nQuestion: "${currentStep.question_text || currentStep.step_title}"\nType: ${qt}\n`;

    if (qt === "yes_no") {
      const opts = currentStep.options || [{ value: "YES", label: "Yes" }, { value: "NO", label: "No" }];
      context += `Options: ${opts.map(o => `"${o.value}" = ${o.label}`).join(", ")}\nReturn EXACT value string (YES or NO).`;
    } else if (qt === "single_choice") {
      const opts = currentStep.options || [];
      context += `Options: ${opts.map(o => `"${o.value}" = ${o.label}`).join(", ")}\nReturn EXACT value string from options.`;
    } else if (qt === "multiple_choice") {
      const opts = currentStep.options || [];
      context += `Options: ${opts.map(o => `"${o.value}" = ${o.label}`).join(", ")}\nReturn a JSON array of selected value strings.`;
    } else if (qt === "number_input") {
      context += `Return a numeric string value.`;
    } else if (qt === "date_input") {
      context += `Return date in YYYY-MM-DD format.`;
    } else if (qt === "text_input" || qt === "textarea") {
      context += `Return the text the user wants to enter.`;
    } else if (qt === "file_upload") {
      context += `This step requires a file upload — voice cannot upload files. Set value to null and tell the user to use the upload button.`;
    } else if (qt === "multi_field_input") {
      const fields = currentStep.multi_fields || [];
      const currentAnswers = answers[currentStep?.step_id] || {};
      const alreadyFilled = fields
        .filter(f => currentAnswers[f.field_id] !== undefined && currentAnswers[f.field_id] !== null && currentAnswers[f.field_id] !== '')
        .map(f => `"${f.field_id}" = ${JSON.stringify(currentAnswers[f.field_id])}`);
      context += `Multi-field step with sub-fields: ${fields.map(f => `"${f.field_id}" (${f.display_label}, type: ${f.field_type})`).join(", ")}.\n`;
      if (alreadyFilled.length > 0) {
        context += `IMPORTANT: These sub-fields are ALREADY filled — do NOT return them (to avoid overwriting): ${alreadyFilled.join(", ")}.\n`;
      }
      context += `Return a JSON object containing ONLY the sub-fields the user is providing a value for. Do NOT include already-filled fields unless the user is explicitly changing them.`;
    } else if (qt === "address_input") {
      context += `Return a JSON object with keys: street, city, state, postal_code, country, tax_residence_country, tin.`;
    } else if (qt === "info" || qt === "result") {
      context += `This is an informational/result node. No answer needed. The user can say "next" to proceed or "go back" to go back.`;
    }

    return context;
  };

  const processTranscript = async (text) => {
    // Pre-LLM phrase matching
    const phraseResult = checkPhrasesBeforeLLM(text);
    if (phraseResult) {
      const messages = {
        summary: "Going to summary.",
        complete: "Completing the classification.",
        back: "Going back to the previous step.",
        next: "Moving to the next question.",
      };
      setAssistantMessage(messages[phraseResult] || "Done.");
      statusRef.current = "idle";
      setStatus("idle");
      return;
    }

    // Info/result nodes — only navigation allowed
    if (currentStep?.question_type === "info" || currentStep?.question_type === "result") {
      setAssistantMessage("This is an information step. Say 'next' to proceed or 'back' to go back.");
      statusRef.current = "idle";
      setStatus("idle");
      return;
    }

    // File upload nodes
    if (currentStep?.question_type === "file_upload") {
      setAssistantMessage("This step requires a file upload. Please use the upload button to attach a file.");
      statusRef.current = "speaking";
      setStatus("speaking");
      speak("This step requires a file upload. Please use the upload button.", () => {
        statusRef.current = "idle";
        setStatus("idle");
      });
      return;
    }

    const stepContext = buildStepContext();

    const prompt = `You are a friendly compliance workflow assistant helping a user answer a classification question by voice.

${stepContext}

User said: "${text}"

Instructions:
1. Extract the answer value from what the user said.
2. Match it to the exact option value if applicable (yes_no, single_choice, multiple_choice).
3. Write a short, warm 1-2 sentence reply confirming what you understood.
4. Detect if the user wants to proceed after answering (e.g., said "yes and next", "confirm and proceed").
5. Detect if the user wants to go back.

Respond with JSON:
- value: the extracted answer value (exact string, array for multiple_choice, object for multi_field/address, or null if unclear)
- assistant_reply: short friendly reply
- wants_proceed: boolean (true if user wants to move to next step)
- wants_back: boolean (true if user wants to go back)
- wants_summary: boolean (true if user wants to see summary)
- wants_complete: boolean (true if user wants to complete the workflow)`;

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

      const reply = result.assistant_reply || "Got it! Anything else?";
      setAssistantMessage(reply);

      if (result.value !== null && result.value !== undefined) {
        onApplyAnswer?.(result.value);
        setConfirmedValue(result.value);
      }

      statusRef.current = "speaking";
      setStatus("speaking");
      speak(reply, () => {
        statusRef.current = "idle";
        setStatus("idle");

        // Post-speak navigation
        if (result.wants_complete) onComplete?.();
        else if (result.wants_summary) onSummary?.();
        else if (result.wants_back) onGoBack?.();
        else if (result.wants_proceed) setTimeout(() => onProceed?.(), 300);
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
            className="gap-2 bg-gradient-to-r from-violet-50 to-purple-50 hover:from-violet-100 hover:to-purple-100 border-violet-200 text-violet-700"
          >
            <Mic className="w-4 h-4" />
            {summaryMode ? "Voice Command" : "Answer by Voice"}
          </Button>
        )}

        {status === "listening" && (
          <Button
            type="button"
            variant="outline"
            onClick={stopListening}
            className="gap-2 bg-violet-600 hover:bg-violet-700 text-white border-violet-600 animate-pulse"
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
            className="gap-2 border-violet-200 text-violet-700 bg-violet-50"
          >
            <Volume2 className="w-4 h-4 animate-pulse" />
            Speaking… (click to stop)
          </Button>
        )}

        {transcript && (
          <div className="flex items-center gap-1 text-xs text-slate-500 italic">
            <Volume2 className="w-3 h-3" />
            <span className="truncate max-w-xs">"{transcript}"</span>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          <span className="flex-1">{error}</span>
          <button type="button" onClick={() => setError("")}><X className="w-3 h-3" /></button>
        </div>
      )}

      {/* Assistant reply */}
      {assistantMessage && (
        <Card className="border border-violet-100 bg-gradient-to-br from-violet-50/60 to-purple-50/40">
          <CardContent className="p-3 flex items-start gap-2">
            <div className="w-6 h-6 rounded-full bg-violet-600 flex items-center justify-center flex-shrink-0 mt-0.5">
              <MessageCircle className="w-3 h-3 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-slate-800">{assistantMessage}</p>
              {confirmedValue !== null && (
                <div className="mt-1.5 flex items-center gap-1 text-xs text-green-700 bg-green-50 rounded-full px-2 py-0.5 w-fit">
                  <CheckCircle2 className="w-3 h-3" />
                  Answer applied
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick "Next" shortcut after confirmed answer */}
      {confirmedValue !== null && status === "idle" && onProceed && !summaryMode && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => { setConfirmedValue(null); onProceed(); }}
          className="text-xs gap-1 border-violet-200 text-violet-700 hover:bg-violet-50"
        >
          Next Question
          <ArrowRight className="w-3 h-3" />
        </Button>
      )}
    </div>
  );
}