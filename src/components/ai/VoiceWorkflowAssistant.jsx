import React, { useState, useRef, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Mic, MicOff, Loader2, CheckCircle2, X, Volume2, MessageCircle } from "lucide-react";

/**
 * VoiceWorkflowAssistant
 * Voice assistant for stepping through CRS classification workflows.
 * Understands current step type, question text, and available options.
 * Lets user answer questions by voice and navigate with "next", "back", "skip".
 */
export default function VoiceWorkflowAssistant({ currentStep, answers, onAnswer, onNext, onBack }) {
  const [status, setStatus] = useState("idle");
  const [transcript, setTranscript] = useState("");
  const [assistantMessage, setAssistantMessage] = useState("");
  const [error, setError] = useState("");
  const [conversationHistory, setConversationHistory] = useState([]);

  const recognitionRef = useRef(null);
  const statusRef = useRef("idle");

  const isSupported = typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);
  const isSpeechSynthSupported = typeof window !== "undefined" && "speechSynthesis" in window;

  useEffect(() => {
    return () => {
      if (recognitionRef.current) recognitionRef.current.abort();
      if (isSpeechSynthSupported) window.speechSynthesis.cancel();
    };
  }, []);

  // Reset conversation when step changes
  useEffect(() => {
    setTranscript("");
    setAssistantMessage("");
    setConversationHistory([]);
  }, [currentStep?.step_id]);

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
    if (recognitionRef.current) recognitionRef.current.stop();
    statusRef.current = "idle";
    setStatus("idle");
  };

  const buildStepContext = () => {
    if (!currentStep) return "No active step.";

    const stepType = currentStep.question_type;
    const stepTitle = currentStep.step_title || "";
    const questionText = currentStep.question_text || "";
    const helpText = currentStep.help_text || "";
    const currentAnswer = answers?.[currentStep.step_id];

    let optionsList = "";
    if (currentStep.options && currentStep.options.length > 0) {
      optionsList = "\nAvailable options:\n" + currentStep.options
        .map(o => `  - "${o.label}" (value: "${o.value}")`)
        .join("\n");
    }

    let typeGuidance = "";
    switch (stepType) {
      case "yes_no":
        typeGuidance = 'This is a YES/NO question. User can say "yes" or "no".';
        break;
      case "single_choice":
        typeGuidance = "This is a single-choice dropdown. User should pick one option.";
        break;
      case "multiple_choice":
        typeGuidance = "This is a multiple-choice question. User can select multiple options.";
        break;
      case "text_input":
        typeGuidance = "This requires a text answer. Capture the text the user speaks.";
        break;
      case "number_input":
        typeGuidance = "This requires a numeric value. Extract the number from what the user says.";
        break;
      case "date_input":
        typeGuidance = "This requires a date. Convert what the user says to YYYY-MM-DD format.";
        break;
      case "address_input":
        typeGuidance = "This requires an address. Extract street, city, state, postal_code, country, tax_residence_country, and tin from what the user says.";
        break;
      case "result":
      case "info":
        typeGuidance = "This is an informational step with no input required. User can say 'next' to proceed.";
        break;
      default:
        typeGuidance = `Step type is "${stepType}". Capture the user's intent.`;
    }

    return `Step title: "${stepTitle}"
Question: "${questionText}"
${helpText ? `Help: "${helpText}"` : ""}
Step type: ${stepType}
${typeGuidance}
${optionsList}
Current answer: ${currentAnswer !== undefined ? JSON.stringify(currentAnswer) : "not answered yet"}`;
  };

  const processTranscript = async (text) => {
    const recentHistory = conversationHistory.slice(-4).map(h =>
      `${h.role === "user" ? "User" : "Assistant"}: ${h.text}`
    ).join("\n");

    const stepType = currentStep?.question_type || "unknown";

    const prompt = `You are a helpful compliance workflow assistant guiding a user through a CRS (Common Reporting Standard) classification workflow by voice.

${recentHistory ? `Recent conversation:\n${recentHistory}\n` : ""}
User just said: "${text}"

Current workflow step:
${buildStepContext()}

Your job:
1. Understand what the user is saying in the context of this workflow step.
2. Extract the answer they want to give for this step:
   - For yes_no: set answer to "YES" or "NO"
   - For single_choice or multiple_choice: match the option value(s) from the available options list
   - For text_input: set answer to the text spoken
   - For number_input: set answer to the number as a string
   - For date_input: set answer to YYYY-MM-DD format
   - For address_input: set answer as an object with street, city, state, postal_code, country, tax_residence_country, tin
   - For info/result: answer should be null
3. If the user says "next", "proceed", "continue", "move on" — set should_next to true.
4. If the user says "back", "previous", "go back" — set should_back to true.
5. Write a SHORT, warm confirmation (1-2 sentences) of what you understood.
6. If you couldn't understand the answer, ask for clarification in your reply and set answer to null.

For multiple_choice, answer should be an array of matched option values.
Only set should_next or should_back if user explicitly asked to navigate. Do not auto-advance after answering.`;

    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            answer: {},
            assistant_reply: { type: "string" },
            should_next: { type: "boolean" },
            should_back: { type: "boolean" }
          }
        }
      });

      const reply = result.assistant_reply || "Got it! Anything else?";
      const shouldNext = result.should_next === true;
      const shouldBack = result.should_back === true;
      const extractedAnswer = result.answer;

      setConversationHistory(prev => [
        ...prev,
        { role: "user", text },
        { role: "assistant", text: reply }
      ]);
      setAssistantMessage(reply);

      // Apply the answer if we got one and it's not null/undefined
      if (extractedAnswer !== null && extractedAnswer !== undefined && onAnswer && currentStep) {
        onAnswer(currentStep.step_id, extractedAnswer);
      }

      // Navigate if requested
      if (shouldNext && onNext) {
        setTimeout(() => onNext(), 800);
      } else if (shouldBack && onBack) {
        setTimeout(() => onBack(), 800);
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
    setAssistantMessage("");
    setError("");
    setConversationHistory([]);
  };

  if (!isSupported) return null;

  // Don't show for step types that don't have user input
  const noInputTypes = ["controlling_person_input", "beneficiary_input", "file_upload", "address_input", "multi_field_input"];
  if (currentStep && noInputTypes.includes(currentStep.question_type)) return null;

  return (
    <div className="space-y-2">
      {/* Controls row */}
      <div className="flex items-center gap-3 flex-wrap">
        {status === "idle" && (
          <Button
            type="button"
            variant="outline"
            onClick={startListening}
            className="gap-2 bg-gradient-to-r from-rose-50 to-pink-50 hover:from-rose-100 hover:to-pink-100 border-rose-200 text-rose-700 text-xs h-8 px-3"
          >
            <Mic className="w-3.5 h-3.5" />
            {conversationHistory.length > 0 ? "Continue Speaking" : "Answer by Voice"}
          </Button>
        )}

        {status === "listening" && (
          <Button
            type="button"
            variant="outline"
            onClick={stopListening}
            className="gap-2 bg-rose-600 hover:bg-rose-700 text-white border-rose-600 animate-pulse text-xs h-8 px-3"
          >
            <MicOff className="w-3.5 h-3.5" />
            Listening… (click to stop)
          </Button>
        )}

        {status === "processing" && (
          <Button type="button" variant="outline" disabled className="gap-2 text-xs h-8 px-3">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Processing…
          </Button>
        )}

        {status === "speaking" && (
          <Button
            type="button"
            variant="outline"
            onClick={() => { window.speechSynthesis.cancel(); statusRef.current = "idle"; setStatus("idle"); }}
            className="gap-2 border-indigo-200 text-indigo-700 bg-indigo-50 text-xs h-8 px-3"
          >
            <Volume2 className="w-3.5 h-3.5 animate-pulse" />
            Speaking… (click to stop)
          </Button>
        )}

        {transcript && (
          <div className="flex items-center gap-1.5 text-xs text-slate-500 italic">
            <Volume2 className="w-3 h-3 flex-shrink-0" />
            <span className="truncate max-w-xs">"{transcript}"</span>
          </div>
        )}

        {conversationHistory.length > 0 && status === "idle" && (
          <button type="button" onClick={reset} className="text-xs text-slate-400 hover:text-slate-600 ml-auto underline">
            Reset
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          <span className="flex-1">{error}</span>
          <button type="button" onClick={() => setError("")}><X className="w-3 h-3" /></button>
        </div>
      )}

      {/* Assistant message */}
      {assistantMessage && (
        <Card className="border border-indigo-100 bg-gradient-to-br from-indigo-50/60 to-purple-50/40">
          <CardContent className="p-2.5 flex items-start gap-2.5">
            <div className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center flex-shrink-0 mt-0.5">
              <MessageCircle className="w-3 h-3 text-white" />
            </div>
            <p className="text-xs text-slate-800 flex-1">{assistantMessage}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}