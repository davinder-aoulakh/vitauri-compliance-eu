import React, { useState, useRef, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import ReactMarkdown from "react-markdown";
import {
  HelpCircle,
  X,
  Send,
  Loader2,
  MessageCircle,
  Sparkles,
  ChevronDown,
  RotateCcw
} from "lucide-react";

// Comprehensive app documentation for the LLM
const APP_DOCUMENTATION = `
# CRS Compliance Platform - Help Documentation

## Overview
This is a CRS (Common Reporting Standard) Compliance Platform designed to help financial institutions manage their tax reporting obligations. The platform enables you to manage entities, accounts, beneficiaries, controlling persons, and generate CRS XML reports.

## Main Sections

### Dashboard
The Dashboard is your central hub showing:
- Key statistics: total entities, accounts, reportable accounts, and pending reviews
- Compliance status overview
- Recent activity and pending tasks
- Quick access to common actions

### RFI Entities
RFI (Reporting Financial Institution) Entities are the legal entities that hold financial accounts:
- **Creating an Entity**: Click "Add Entity" button, fill in entity name, type (corporation, trust, partnership, fund, branch), country of incorporation, and tax ID
- **Entity Classification**: Each entity needs to be classified as Reporting FI, Non-Reporting FI, Active NFE, or Passive NFE
- **Classification Workflow**: Use the "Classify" button to run through the classification questionnaire

### Accounts
Accounts are financial accounts held by RFI entities:
- **Creating an Account**: Click "Add Account", select the related entity, enter account number, account type, and account holder details
- **Account Types**: Depository, Custodial, Equity/Debt Interest, Cash Value Insurance, Annuity
- **Account Holder Types**: Individual or Entity
- **Pre-existing vs New Accounts**: Accounts opened before Jan 1, 2018 are pre-existing and have different due diligence requirements
- **Account Classification**: Run the reportability workflow to determine if an account is reportable, non-reportable, or excluded

### Beneficiaries
Beneficiaries are individuals who will inherit an account (typically for deceased account holders):
- **Adding Beneficiaries**: Go to account details > CRS Classification tab > Add Beneficiary
- **Beneficiary Classification**: Each beneficiary must be classified separately for CRS reporting
- **Required Information**: Full name, date of birth, address, tax residencies

### Controlling Persons
Controlling Persons are individuals who control entity account holders (for Passive NFE accounts):
- **When Required**: Only for accounts where the account holder is a Passive NFE entity
- **Adding Controlling Persons**: Go to account details > CRS Classification tab > Add Controlling Person
- **Required Information**: Full name, date of birth, address, tax residencies, control type, ownership percentage

### Tax Residencies
Tax residency information is crucial for CRS reporting:
- **Adding Tax Residencies**: In the account form under "Tax Information" tab
- **Required Fields**: Country, TIN (Tax Identification Number)
- **TIN Unavailable**: If TIN is not available, you must provide a reason

### CRS Reports
Generate and submit CRS XML reports:
- **Report Wizard**: Step-by-step guide to generate reports
- **Report Types**: CRS XML or NIL Report (when no reportable accounts)
- **Validation**: Reports are validated before submission
- **Submission Tracking**: Track submission status and responses

### Documents
Upload and manage compliance documents:
- **Self-Certification**: Upload self-certification forms for account holders
- **Supporting Documents**: Upload any supporting documentation
- **Document Types**: PDF, JPG, PNG supported

### AI Features
The platform includes several AI-powered features:
- **AI Classification Assistant**: Get AI suggestions for entity/account classification
- **Smart Document Parser**: Upload documents and automatically extract data
- **AI Form Assistant**: Get suggestions while filling forms
- **AI Data Validator**: Validate data quality and detect anomalies
- **Jurisdiction Advisor**: Get jurisdiction-specific compliance advice

## Common Tasks

### How to Create an Account
1. Go to "Accounts" page from the sidebar
2. Click "Add Account" button
3. Select the related RFI Entity
4. Enter account number and select account type
5. Choose account holder type (Individual or Entity)
6. Fill in account holder details (name, date of birth for individuals)
7. Add address information
8. Enter year-end values and reporting year
9. Click "Create Account"

### How to Classify an Account
1. Go to "Accounts" page
2. Find the account you want to classify
3. Click the "Classify" button (or use the dropdown menu)
4. Answer the workflow questions
5. Review the classification result
6. Click "Complete Classification"

### How to Add Beneficiaries
1. Go to "Accounts" page
2. Click on the account to open details
3. Go to "CRS Classification" tab
4. In the Beneficiaries section, click "Add Beneficiary"
5. Fill in beneficiary details
6. Save and classify each beneficiary

### How to Generate a CRS Report
1. Go to "CRS Reports" page
2. Click "Generate Report"
3. Select reporting entity and year
4. Choose jurisdictions to report
5. Review included accounts
6. Validate the report
7. Download or submit the XML file

## User Roles

### Super Admin
- Full access to all features
- Manage tenants and workflows
- Configure forms and referenced data
- Access to all system settings

### Tenant Admin
- Manage entities, accounts, and reports for their organization
- Invite and manage users
- Configure organization settings
- Build custom dashboards

### Tenant User
- View and manage entities and accounts
- Run classification workflows
- Generate reports
- Limited settings access

## Tips & Best Practices
- Always complete account classification before generating reports
- Ensure all tax residencies have valid TINs or documented reasons for unavailability
- Upload self-certification documents for all reportable accounts
- Review the AI validation results before submitting reports
- Use the bulk import feature for large datasets
- Regularly check the compliance flags for pending issues
`;

const QUICK_QUESTIONS = [
  "How do I create a new account?",
  "What is the purpose of the Dashboard?",
  "How do I classify an account?",
  "How do I add beneficiaries?",
  "What are controlling persons?",
  "How do I generate a CRS report?",
  "What is the difference between pre-existing and new accounts?",
  "How do I upload documents?"
];

export default function AIHelpAssistant({ currentPage }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "Hi! I'm your CRS Platform assistant. I can help you understand features, guide you through tasks, and answer questions about the application. What would you like to know?"
    }
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showQuickQuestions, setShowQuickQuestions] = useState(true);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSendMessage = async (question) => {
    const userMessage = question || inputValue.trim();
    if (!userMessage) return;

    setShowQuickQuestions(false);
    setInputValue("");
    
    const newMessages = [
      ...messages,
      { role: "user", content: userMessage }
    ];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      const contextInfo = currentPage 
        ? `The user is currently viewing the "${currentPage}" page.`
        : "The user is using the CRS Compliance Platform.";

      const prompt = `You are a helpful assistant for a CRS (Common Reporting Standard) Compliance Platform. Your role is to help users understand features, navigate the application, and complete tasks.

${APP_DOCUMENTATION}

CONTEXT:
${contextInfo}

CONVERSATION HISTORY:
${newMessages.slice(-6).map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n')}

USER QUESTION: ${userMessage}

INSTRUCTIONS:
- Provide clear, concise, and helpful answers
- Use step-by-step instructions when explaining how to do something
- Reference specific UI elements (buttons, tabs, pages) when applicable
- If the question is about a feature that doesn't exist, politely say so
- Keep responses focused and practical
- Use markdown formatting for better readability (headers, lists, bold)
- Be friendly and professional

Please provide a helpful response:`;

      const response = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            answer: { type: "string" }
          },
          required: ["answer"]
        }
      });

      setMessages([
        ...newMessages,
        { role: "assistant", content: response.answer }
      ]);
    } catch (error) {
      console.error("Error getting AI response:", error);
      setMessages([
        ...newMessages,
        { 
          role: "assistant", 
          content: "I apologize, but I encountered an error processing your request. Please try again or rephrase your question." 
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setMessages([
      {
        role: "assistant",
        content: "Hi! I'm your CRS Platform assistant. I can help you understand features, guide you through tasks, and answer questions about the application. What would you like to know?"
      }
    ]);
    setShowQuickQuestions(true);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <>
      {/* Floating Help Button */}
      <Button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-6 right-6 z-50 rounded-full w-14 h-14 shadow-lg transition-all duration-300 ${
          isOpen 
            ? "bg-slate-700 hover:bg-slate-800" 
            : "bg-indigo-600 hover:bg-indigo-700"
        }`}
      >
        {isOpen ? (
          <ChevronDown className="w-6 h-6 text-white" />
        ) : (
          <HelpCircle className="w-6 h-6 text-white" />
        )}
      </Button>

      {/* Chat Window */}
      {isOpen && (
        <Card className="fixed bottom-24 right-6 z-50 w-96 h-[500px] shadow-2xl border-2 border-indigo-100 flex flex-col overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-indigo-600 to-indigo-700 text-white p-4 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5" />
                <CardTitle className="text-lg font-semibold">Help Assistant</CardTitle>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleReset}
                  className="h-8 w-8 text-white hover:bg-indigo-500"
                  title="Reset conversation"
                >
                  <RotateCcw className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsOpen(false)}
                  className="h-8 w-8 text-white hover:bg-indigo-500"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
            {currentPage && (
              <Badge variant="secondary" className="mt-2 bg-indigo-500/30 text-white border-0 text-xs">
                Currently on: {currentPage}
              </Badge>
            )}
          </CardHeader>

          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                      message.role === "user"
                        ? "bg-indigo-600 text-white"
                        : "bg-slate-100 text-slate-900"
                    }`}
                  >
                    {message.role === "user" ? (
                      <p className="text-sm">{message.content}</p>
                    ) : (
                      <div className="text-sm prose prose-sm prose-slate max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                        <ReactMarkdown
                          components={{
                            p: ({ children }) => <p className="my-1">{children}</p>,
                            ul: ({ children }) => <ul className="my-1 ml-4 list-disc">{children}</ul>,
                            ol: ({ children }) => <ol className="my-1 ml-4 list-decimal">{children}</ol>,
                            li: ({ children }) => <li className="my-0.5">{children}</li>,
                            strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                            h1: ({ children }) => <h1 className="text-base font-bold my-2">{children}</h1>,
                            h2: ({ children }) => <h2 className="text-sm font-bold my-2">{children}</h2>,
                            h3: ({ children }) => <h3 className="text-sm font-semibold my-1">{children}</h3>,
                          }}
                        >
                          {message.content}
                        </ReactMarkdown>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-slate-100 rounded-2xl px-4 py-3">
                    <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
                  </div>
                </div>
              )}

              {/* Quick Questions */}
              {showQuickQuestions && messages.length === 1 && (
                <div className="pt-2">
                  <p className="text-xs text-slate-500 mb-2 font-medium">Quick Questions:</p>
                  <div className="flex flex-wrap gap-2">
                    {QUICK_QUESTIONS.slice(0, 4).map((q, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSendMessage(q)}
                        className="text-xs bg-white border border-slate-200 rounded-full px-3 py-1.5 hover:bg-indigo-50 hover:border-indigo-200 transition-colors text-slate-700"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          <CardContent className="p-3 border-t bg-white flex-shrink-0">
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask a question..."
                disabled={isLoading}
                className="flex-1"
              />
              <Button
                onClick={() => handleSendMessage()}
                disabled={isLoading || !inputValue.trim()}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}