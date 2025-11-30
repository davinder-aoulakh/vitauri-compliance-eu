import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Send,
  Bot,
  Loader2,
  MessageSquare,
  Plus,
  Trash2,
  Sparkles,
  HelpCircle
} from "lucide-react";
import ChatMessageBubble from "../components/chat/ChatMessageBubble";

const AGENT_NAME = "compliance_assistant";

const SUGGESTED_QUESTIONS = [
  "What is the difference between Active NFE and Passive NFE?",
  "How does the account reportability workflow work?",
  "When is an account considered non-reportable?",
  "What are the different types of Financial Institutions?",
  "Explain the CRS self-certification requirements",
  "What triggers a workflow to run automatically?"
];

export default function ComplianceAssistant() {
  const [user, setUser] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [currentConversation, setCurrentConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    loadUser();
  }, []);

  useEffect(() => {
    if (user) {
      loadConversations();
    }
  }, [user]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    let unsubscribe;
    if (currentConversation?.id) {
      unsubscribe = base44.agents.subscribeToConversation(currentConversation.id, (data) => {
        setMessages(data.messages || []);
      });
    }
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [currentConversation?.id]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const loadUser = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
    } catch (error) {
      console.error("Error loading user:", error);
    }
  };

  const loadConversations = async () => {
    setIsLoading(true);
    try {
      const convos = await base44.agents.listConversations({ agent_name: AGENT_NAME });
      setConversations(convos || []);
      
      if (convos && convos.length > 0) {
        const latest = convos[0];
        setCurrentConversation(latest);
        setMessages(latest.messages || []);
      }
    } catch (error) {
      console.error("Error loading conversations:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const startNewConversation = async () => {
    setIsLoading(true);
    try {
      const conversation = await base44.agents.createConversation({
        agent_name: AGENT_NAME,
        metadata: {
          name: `Chat ${new Date().toLocaleDateString()}`,
          description: "Compliance assistance conversation"
        }
      });
      setCurrentConversation(conversation);
      setMessages([]);
      setConversations(prev => [conversation, ...prev]);
    } catch (error) {
      console.error("Error creating conversation:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const selectConversation = async (convo) => {
    try {
      const fullConvo = await base44.agents.getConversation(convo.id);
      setCurrentConversation(fullConvo);
      setMessages(fullConvo.messages || []);
    } catch (error) {
      console.error("Error loading conversation:", error);
    }
  };

  const sendMessage = async (messageText) => {
    const text = messageText || inputValue.trim();
    if (!text || isSending) return;

    let convo = currentConversation;

    if (!convo) {
      try {
        convo = await base44.agents.createConversation({
          agent_name: AGENT_NAME,
          metadata: {
            name: `Chat ${new Date().toLocaleDateString()}`,
            description: "Compliance assistance conversation"
          }
        });
        setCurrentConversation(convo);
        setConversations(prev => [convo, ...prev]);
      } catch (error) {
        console.error("Error creating conversation:", error);
        return;
      }
    }

    setInputValue("");
    setIsSending(true);

    try {
      await base44.agents.addMessage(convo, {
        role: "user",
        content: text
      });
    } catch (error) {
      console.error("Error sending message:", error);
    } finally {
      setIsSending(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleSuggestedQuestion = (question) => {
    sendMessage(question);
  };

  return (
    <div className="h-[calc(100vh-4rem)] flex bg-gradient-to-br from-slate-50 via-indigo-50/20 to-slate-50">
      {/* Sidebar - Conversation History */}
      <div className="w-72 border-r bg-white flex flex-col">
        <div className="p-4 border-b">
          <Button
            onClick={startNewConversation}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white gap-2"
            disabled={isLoading}
          >
            <Plus className="w-4 h-4" />
            New Chat
          </Button>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {conversations.map((convo) => (
              <button
                key={convo.id}
                onClick={() => selectConversation(convo)}
                className={`w-full text-left p-3 rounded-lg transition-colors ${
                  currentConversation?.id === convo.id
                    ? "bg-indigo-50 border border-indigo-200"
                    : "hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-slate-400" />
                  <span className="text-sm font-medium text-slate-700 truncate">
                    {convo.metadata?.name || "Conversation"}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1 truncate">
                  {new Date(convo.created_date).toLocaleDateString()}
                </p>
              </button>
            ))}

            {conversations.length === 0 && !isLoading && (
              <div className="text-center py-8 text-slate-500 text-sm">
                <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                No conversations yet
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-white border-b px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-semibold text-slate-900">CRS Compliance Assistant</h1>
              <p className="text-xs text-slate-500">
                Ask me about workflows, reportability rules, and entity classifications
              </p>
            </div>
          </div>
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
            <span className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></span>
            Online
          </Badge>
        </div>

        {/* Messages Area */}
        <ScrollArea className="flex-1 p-6">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mb-4">
                <Sparkles className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-xl font-semibold text-slate-900 mb-2">
                How can I help you today?
              </h2>
              <p className="text-slate-500 mb-6 max-w-md">
                I can answer questions about CRS compliance workflows, entity classifications,
                reportability rules, and help you navigate the platform.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl">
                {SUGGESTED_QUESTIONS.map((question, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSuggestedQuestion(question)}
                    className="text-left p-3 rounded-lg border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50 transition-colors group"
                  >
                    <div className="flex items-start gap-2">
                      <HelpCircle className="w-4 h-4 text-indigo-500 mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-slate-700 group-hover:text-indigo-700">
                        {question}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4 max-w-4xl mx-auto">
              {messages.map((msg, idx) => (
                <ChatMessageBubble key={idx} message={msg} />
              ))}

              {isSending && (
                <div className="flex gap-3">
                  <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                    <Loader2 className="h-4 w-4 text-white animate-spin" />
                  </div>
                  <div className="bg-white border border-slate-200 rounded-2xl px-4 py-2.5 shadow-sm">
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                      <span>Thinking</span>
                      <span className="flex gap-1">
                        <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></span>
                        <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></span>
                        <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></span>
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </ScrollArea>

        {/* Input Area */}
        <div className="bg-white border-t p-4">
          <div className="max-w-4xl mx-auto">
            <div className="flex gap-3">
              <Input
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask a question about CRS compliance..."
                className="flex-1 rounded-xl border-slate-200 focus:border-indigo-300 focus:ring-indigo-200"
                disabled={isSending}
              />
              <Button
                onClick={() => sendMessage()}
                disabled={!inputValue.trim() || isSending}
                className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-6"
              >
                {isSending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-slate-400 text-center mt-2">
              The assistant has access to your workflows, accounts, and entities to provide accurate answers.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}