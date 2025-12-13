import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Send,
  Bot,
  Loader2,
  MessageSquare,
  Plus,
  Trash2,
  Sparkles,
  HelpCircle,
  Brain,
  FileCheck,
  Wand2
} from "lucide-react";
import ChatMessageBubble from "../components/chat/ChatMessageBubble";
import AIDataValidator from "../components/ai/AIDataValidator";
import AIClassificationAssistant from "../components/ai/AIClassificationAssistant";

const AGENT_NAME = "compliance_assistant";

const SUGGESTED_QUESTIONS = [
  "What is the difference between Active NFE and Passive NFE?",
  "How does the account reportability workflow work?",
  "When is an account considered non-reportable?",
  "What are the different types of Financial Institutions?",
  "Explain the CRS self-certification requirements",
  "What are the CRS reporting deadlines for Switzerland?",
  "What TIN format is required for UK reporting?",
  "What are common compliance pitfalls for Luxembourg?"
];

export default function ComplianceAssistant() {
  const [user, setUser] = useState(null);
  const [tenant, setTenant] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [currentConversation, setCurrentConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [activeTab, setActiveTab] = useState("chat");
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [classificationRecordType, setClassificationRecordType] = useState("entity");
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Fetch accounts and entities for AI tools
  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts-for-ai', user?.tenant_id],
    queryFn: () => user?.tenant_id 
      ? base44.entities.Account.filter({ tenant_id: user.tenant_id })
      : [],
    enabled: !!user?.tenant_id
  });

  const { data: entities = [] } = useQuery({
    queryKey: ['entities-for-ai', user?.tenant_id],
    queryFn: () => user?.tenant_id 
      ? base44.entities.Entity.filter({ tenant_id: user.tenant_id })
      : [],
    enabled: !!user?.tenant_id
  });

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
      
      if (currentUser.tenant_id) {
        const tenants = await base44.entities.Tenant.list();
        const userTenant = tenants.find(t => t.id === currentUser.tenant_id);
        setTenant(userTenant);
      }
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
      {/* Sidebar - Tool Navigation */}
      <div className="w-72 border-r bg-white flex flex-col">
        <div className="p-4 border-b">
          <h2 className="font-semibold text-slate-900 mb-3">AI Compliance Tools</h2>
          <div className="space-y-1">
            <button
              onClick={() => setActiveTab("chat")}
              className={`w-full text-left p-3 rounded-lg transition-colors flex items-center gap-3 ${
                activeTab === "chat" ? "bg-indigo-50 border border-indigo-200" : "hover:bg-slate-50"
              }`}
            >
              <MessageSquare className={`w-5 h-5 ${activeTab === "chat" ? "text-indigo-600" : "text-slate-400"}`} />
              <div>
                <p className={`text-sm font-medium ${activeTab === "chat" ? "text-indigo-700" : "text-slate-700"}`}>Chat Assistant</p>
                <p className="text-xs text-slate-500">General Q&A</p>
              </div>
            </button>

            {(tenant?.enabled_features?.ai_data_validator !== false) && (
              <button
                onClick={() => setActiveTab("validator")}
                className={`w-full text-left p-3 rounded-lg transition-colors flex items-center gap-3 ${
                  activeTab === "validator" ? "bg-blue-50 border border-blue-200" : "hover:bg-slate-50"
                }`}
              >
                <Brain className={`w-5 h-5 ${activeTab === "validator" ? "text-blue-600" : "text-slate-400"}`} />
                <div>
                  <p className={`text-sm font-medium ${activeTab === "validator" ? "text-blue-700" : "text-slate-700"}`}>Data Validator</p>
                  <p className="text-xs text-slate-500">Find anomalies</p>
                </div>
              </button>
            )}
            {(tenant?.enabled_features?.ai_classification_assistant !== false) && (
              <button
                onClick={() => setActiveTab("classifier")}
                className={`w-full text-left p-3 rounded-lg transition-colors flex items-center gap-3 ${
                  activeTab === "classifier" ? "bg-purple-50 border border-purple-200" : "hover:bg-slate-50"
                }`}
              >
                <Wand2 className={`w-5 h-5 ${activeTab === "classifier" ? "text-purple-600" : "text-slate-400"}`} />
                <div>
                  <p className={`text-sm font-medium ${activeTab === "classifier" ? "text-purple-700" : "text-slate-700"}`}>AI Classifier</p>
                  <p className="text-xs text-slate-500">Suggest classifications</p>
                </div>
              </button>
            )}
          </div>
        </div>

        {/* Chat History - Only show when on chat tab */}
        {activeTab === "chat" && (
          <>
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
          </>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-white border-b px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              activeTab === "chat" ? "bg-gradient-to-br from-indigo-500 to-purple-600" :
              activeTab === "validator" ? "bg-gradient-to-br from-blue-500 to-cyan-600" :
              "bg-gradient-to-br from-purple-500 to-pink-600"
            }`}>
              {activeTab === "chat" && <Bot className="w-5 h-5 text-white" />}
              {activeTab === "validator" && <Brain className="w-5 h-5 text-white" />}
              {activeTab === "classifier" && <Wand2 className="w-5 h-5 text-white" />}
            </div>
            <div>
              <h1 className="font-semibold text-slate-900">
                {activeTab === "chat" && "CRS Compliance Assistant"}
                {activeTab === "validator" && "AI Data Validator"}
                {activeTab === "classifier" && "AI Classification Assistant"}
              </h1>
              <p className="text-xs text-slate-500">
                {activeTab === "chat" && "Ask about workflows, reportability, classifications & jurisdiction rules"}
                {activeTab === "validator" && "Analyze your data for anomalies and compliance issues"}
                {activeTab === "classifier" && "Get AI-powered classification suggestions for entities and accounts"}
              </p>
            </div>
          </div>
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
            <span className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></span>
            Online
          </Badge>
        </div>

        {/* Content based on active tab */}
        {activeTab === "chat" && (
          <>
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
          </>
        )}

        {activeTab === "validator" && (tenant?.enabled_features?.ai_data_validator !== false) && (
          <ScrollArea className="flex-1 p-6">
            <div className="max-w-4xl mx-auto">
              <AIDataValidator
                accounts={accounts}
                entities={entities}
                onIssueSelect={(issue) => {
                  console.log("Issue selected:", issue);
                }}
              />
            </div>
          </ScrollArea>
        )}

        {activeTab === "classifier" && (tenant?.enabled_features?.ai_classification_assistant !== false) && (
          <ScrollArea className="flex-1 p-6">
            <div className="max-w-4xl mx-auto space-y-6">
              {/* Record Type Selection */}
              <Card className="border-0 shadow-lg">
                <CardHeader className="border-b bg-gradient-to-r from-purple-50 to-transparent">
                  <CardTitle className="flex items-center gap-2">
                    <FileCheck className="w-5 h-5 text-purple-600" />
                    Select Record to Classify
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  <div className="flex gap-4">
                    <Button
                      variant={classificationRecordType === "entity" ? "default" : "outline"}
                      onClick={() => {
                        setClassificationRecordType("entity");
                        setSelectedRecord(null);
                      }}
                      className={classificationRecordType === "entity" ? "bg-purple-600 hover:bg-purple-700" : ""}
                    >
                      Entities ({entities.length})
                    </Button>
                    <Button
                      variant={classificationRecordType === "account" ? "default" : "outline"}
                      onClick={() => {
                        setClassificationRecordType("account");
                        setSelectedRecord(null);
                      }}
                      className={classificationRecordType === "account" ? "bg-purple-600 hover:bg-purple-700" : ""}
                    >
                      Accounts ({accounts.length})
                    </Button>
                  </div>

                  {/* Record Selector */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-64 overflow-y-auto">
                    {classificationRecordType === "entity" ? (
                      entities.map(entity => (
                        <button
                          key={entity.id}
                          onClick={() => setSelectedRecord(entity)}
                          className={`text-left p-3 rounded-lg border transition-colors ${
                            selectedRecord?.id === entity.id
                              ? "border-purple-400 bg-purple-50"
                              : "border-slate-200 hover:border-purple-300 hover:bg-purple-50/50"
                          }`}
                        >
                          <p className="font-medium text-sm text-slate-900 truncate">{entity.entity_name}</p>
                          <p className="text-xs text-slate-500">{entity.entity_type} • {entity.rfi_status || "Unclassified"}</p>
                        </button>
                      ))
                    ) : (
                      accounts.map(account => (
                        <button
                          key={account.id}
                          onClick={() => setSelectedRecord(account)}
                          className={`text-left p-3 rounded-lg border transition-colors ${
                            selectedRecord?.id === account.id
                              ? "border-purple-400 bg-purple-50"
                              : "border-slate-200 hover:border-purple-300 hover:bg-purple-50/50"
                          }`}
                        >
                          <p className="font-medium text-sm text-slate-900 truncate">{account.account_holder_name}</p>
                          <p className="text-xs text-slate-500">{account.account_number} • {account.reportability_status || "Pending"}</p>
                        </button>
                      ))
                    )}
                  </div>

                  {((classificationRecordType === "entity" && entities.length === 0) ||
                    (classificationRecordType === "account" && accounts.length === 0)) && (
                    <p className="text-center text-slate-500 py-4">
                      No {classificationRecordType === "entity" ? "entities" : "accounts"} found
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Classification Assistant */}
              {selectedRecord && (
                <AIClassificationAssistant
                  record={selectedRecord}
                  recordType={classificationRecordType}
                  existingClassification={
                    classificationRecordType === "entity" 
                      ? selectedRecord.rfi_status 
                      : selectedRecord.reportability_status
                  }
                  onApplySuggestion={(suggestion) => {
                    console.log("Apply suggestion:", suggestion);
                    // Could integrate with mutation to update the record
                  }}
                />
              )}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}