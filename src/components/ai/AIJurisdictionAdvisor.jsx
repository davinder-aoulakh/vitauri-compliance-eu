import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Globe,
  Send,
  Loader2,
  BookOpen,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Calendar,
  Scale,
  MessageSquare,
  History
} from "lucide-react";

const COMMON_QUESTIONS = [
  "What are the reporting deadlines for this jurisdiction?",
  "What TIN format is required?",
  "Are NIL reports mandatory?",
  "What are the penalties for non-compliance?",
  "What is the threshold for high-value accounts?",
  "How should controlling persons be reported?",
  "What documentation is required for self-certification?",
  "How are pre-existing accounts handled differently?"
];

const JURISDICTIONS = [
  { code: 'AD', name: 'Andorra' },
  { code: 'AG', name: 'Antigua and Barbuda' },
  { code: 'AI', name: 'Anguilla' },
  { code: 'AL', name: 'Albania' },
  { code: 'AR', name: 'Argentina' },
  { code: 'AT', name: 'Austria' },
  { code: 'AU', name: 'Australia' },
  { code: 'AW', name: 'Aruba' },
  { code: 'AZ', name: 'Azerbaijan' },
  { code: 'BB', name: 'Barbados' },
  { code: 'BE', name: 'Belgium' },
  { code: 'BG', name: 'Bulgaria' },
  { code: 'BH', name: 'Bahrain' },
  { code: 'BM', name: 'Bermuda' },
  { code: 'BN', name: 'Brunei Darussalam' },
  { code: 'BR', name: 'Brazil' },
  { code: 'BS', name: 'Bahamas' },
  { code: 'BZ', name: 'Belize' },
  { code: 'CA', name: 'Canada' },
  { code: 'CH', name: 'Switzerland' },
  { code: 'CL', name: 'Chile' },
  { code: 'CN', name: 'China' },
  { code: 'CO', name: 'Colombia' },
  { code: 'CR', name: 'Costa Rica' },
  { code: 'CW', name: 'Curaçao' },
  { code: 'CY', name: 'Cyprus' },
  { code: 'CZ', name: 'Czech Republic' },
  { code: 'DE', name: 'Germany' },
  { code: 'DK', name: 'Denmark' },
  { code: 'DM', name: 'Dominica' },
  { code: 'EC', name: 'Ecuador' },
  { code: 'EE', name: 'Estonia' },
  { code: 'EG', name: 'Egypt' },
  { code: 'ES', name: 'Spain' },
  { code: 'FI', name: 'Finland' },
  { code: 'FO', name: 'Faroe Islands' },
  { code: 'FR', name: 'France' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'GD', name: 'Grenada' },
  { code: 'GG', name: 'Guernsey' },
  { code: 'GH', name: 'Ghana' },
  { code: 'GI', name: 'Gibraltar' },
  { code: 'GL', name: 'Greenland' },
  { code: 'GR', name: 'Greece' },
  { code: 'HK', name: 'Hong Kong' },
  { code: 'HR', name: 'Croatia' },
  { code: 'HU', name: 'Hungary' },
  { code: 'ID', name: 'Indonesia' },
  { code: 'IE', name: 'Ireland' },
  { code: 'IL', name: 'Israel' },
  { code: 'IM', name: 'Isle of Man' },
  { code: 'IN', name: 'India' },
  { code: 'IS', name: 'Iceland' },
  { code: 'IT', name: 'Italy' },
  { code: 'JE', name: 'Jersey' },
  { code: 'JM', name: 'Jamaica' },
  { code: 'JO', name: 'Jordan' },
  { code: 'JP', name: 'Japan' },
  { code: 'KE', name: 'Kenya' },
  { code: 'KN', name: 'Saint Kitts and Nevis' },
  { code: 'KR', name: 'Korea (South)' },
  { code: 'KW', name: 'Kuwait' },
  { code: 'KY', name: 'Cayman Islands' },
  { code: 'KZ', name: 'Kazakhstan' },
  { code: 'LB', name: 'Lebanon' },
  { code: 'LC', name: 'Saint Lucia' },
  { code: 'LI', name: 'Liechtenstein' },
  { code: 'LK', name: 'Sri Lanka' },
  { code: 'LT', name: 'Lithuania' },
  { code: 'LU', name: 'Luxembourg' },
  { code: 'LV', name: 'Latvia' },
  { code: 'MC', name: 'Monaco' },
  { code: 'MD', name: 'Moldova' },
  { code: 'ME', name: 'Montenegro' },
  { code: 'MK', name: 'North Macedonia' },
  { code: 'MO', name: 'Macao' },
  { code: 'MT', name: 'Malta' },
  { code: 'MU', name: 'Mauritius' },
  { code: 'MV', name: 'Maldives' },
  { code: 'MX', name: 'Mexico' },
  { code: 'MY', name: 'Malaysia' },
  { code: 'NG', name: 'Nigeria' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'NO', name: 'Norway' },
  { code: 'NR', name: 'Nauru' },
  { code: 'NZ', name: 'New Zealand' },
  { code: 'OM', name: 'Oman' },
  { code: 'PA', name: 'Panama' },
  { code: 'PE', name: 'Peru' },
  { code: 'PH', name: 'Philippines' },
  { code: 'PK', name: 'Pakistan' },
  { code: 'PL', name: 'Poland' },
  { code: 'PT', name: 'Portugal' },
  { code: 'QA', name: 'Qatar' },
  { code: 'RO', name: 'Romania' },
  { code: 'RS', name: 'Serbia' },
  { code: 'RU', name: 'Russia' },
  { code: 'RW', name: 'Rwanda' },
  { code: 'SA', name: 'Saudi Arabia' },
  { code: 'SC', name: 'Seychelles' },
  { code: 'SE', name: 'Sweden' },
  { code: 'SG', name: 'Singapore' },
  { code: 'SI', name: 'Slovenia' },
  { code: 'SK', name: 'Slovakia' },
  { code: 'SM', name: 'San Marino' },
  { code: 'TC', name: 'Turks and Caicos Islands' },
  { code: 'TH', name: 'Thailand' },
  { code: 'TR', name: 'Turkey' },
  { code: 'TT', name: 'Trinidad and Tobago' },
  { code: 'TW', name: 'Taiwan' },
  { code: 'UA', name: 'Ukraine' },
  { code: 'UG', name: 'Uganda' },
  { code: 'AE', name: 'United Arab Emirates' },
  { code: 'US', name: 'United States (FATCA)' },
  { code: 'UY', name: 'Uruguay' },
  { code: 'VC', name: 'Saint Vincent and the Grenadines' },
  { code: 'VG', name: 'British Virgin Islands' },
  { code: 'VN', name: 'Vietnam' },
  { code: 'VU', name: 'Vanuatu' },
  { code: 'WS', name: 'Samoa' },
  { code: 'ZA', name: 'South Africa' }
];

export default function AIJurisdictionAdvisor({ initialJurisdiction }) {
  const [jurisdiction, setJurisdiction] = useState(initialJurisdiction || 'AU');
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState(null);
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);

  const askQuestion = async (customQuestion) => {
    const q = customQuestion || question;
    if (!q.trim()) return;

    setLoading(true);
    setResponse(null);

    try {
      const jurisdictionName = JURISDICTIONS.find(j => j.code === jurisdiction)?.name || jurisdiction;

      const prompt = `You are an expert in CRS (Common Reporting Standard) and international tax reporting compliance. 
A user has a question about CRS rules specific to ${jurisdictionName} (${jurisdiction}).

USER QUESTION: ${q}

Please provide a comprehensive answer that includes:
1. Direct answer to the question
2. Relevant regulatory references (if applicable)
3. Practical implications for financial institutions
4. Any recent changes or updates to the rules
5. Common pitfalls to avoid
6. Best practices

Format your response clearly with sections. Be specific to ${jurisdictionName}'s implementation of CRS.`;

      const result = await base44.integrations.Core.InvokeLLM({
        prompt,
        add_context_from_internet: true,
        response_json_schema: {
          type: "object",
          properties: {
            answer: { type: "string" },
            regulatory_references: { 
              type: "array", 
              items: { type: "string" } 
            },
            practical_implications: { 
              type: "array", 
              items: { type: "string" } 
            },
            recent_updates: { type: "string" },
            common_pitfalls: { 
              type: "array", 
              items: { type: "string" } 
            },
            best_practices: { 
              type: "array", 
              items: { type: "string" } 
            },
            confidence_note: { type: "string" }
          }
        }
      });

      setResponse(result);
      
      // Add to history
      setHistory(prev => [{
        question: q,
        jurisdiction,
        jurisdictionName,
        response: result,
        timestamp: new Date().toISOString()
      }, ...prev.slice(0, 9)]);

      setQuestion('');
    } catch (err) {
      console.error("AI advisor error:", err);
      setResponse({ error: "Failed to get response. Please try again." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader className="border-b bg-gradient-to-r from-emerald-50 to-transparent">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-emerald-600" />
            AI Jurisdiction Advisor
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowHistory(!showHistory)}
            className="text-slate-600"
          >
            <History className="w-4 h-4 mr-1" />
            History ({history.length})
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-6 space-y-6">
        {/* Jurisdiction Selector */}
        <div className="flex gap-4">
          <div className="flex-1">
            <Select value={jurisdiction} onValueChange={setJurisdiction}>
              <SelectTrigger>
                <SelectValue placeholder="Select jurisdiction" />
              </SelectTrigger>
              <SelectContent>
                {JURISDICTIONS.map(j => (
                  <SelectItem key={j.code} value={j.code}>
                    {j.name} ({j.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Question Input */}
        <div className="space-y-2">
          <Textarea
            placeholder="Ask about CRS rules, reporting requirements, deadlines, or any compliance question..."
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            className="h-24"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.ctrlKey) {
                askQuestion();
              }
            }}
          />
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">Press Ctrl+Enter to send</p>
            <Button
              onClick={() => askQuestion()}
              disabled={loading || !question.trim()}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Researching...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Ask Question
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Common Questions */}
        <div>
          <p className="text-sm font-medium text-slate-700 mb-2">Common Questions:</p>
          <div className="flex flex-wrap gap-2">
            {COMMON_QUESTIONS.map((q, idx) => (
              <Button
                key={idx}
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => {
                  setQuestion(q);
                  askQuestion(q);
                }}
                disabled={loading}
              >
                {q}
              </Button>
            ))}
          </div>
        </div>

        {/* Response */}
        {response && !response.error && (
          <Card className="bg-slate-50 border-slate-200">
            <CardContent className="p-6 space-y-6">
              {/* Main Answer */}
              <div>
                <h4 className="font-semibold text-slate-900 mb-2 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-emerald-600" />
                  Answer
                </h4>
                <p className="text-sm text-slate-700 whitespace-pre-wrap">{response.answer}</p>
              </div>

              {/* Regulatory References */}
              {response.regulatory_references?.length > 0 && (
                <div>
                  <h4 className="font-semibold text-slate-900 mb-2 flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-blue-600" />
                    Regulatory References
                  </h4>
                  <ul className="space-y-1">
                    {response.regulatory_references.map((ref, idx) => (
                      <li key={idx} className="text-sm text-slate-600 flex items-start gap-2">
                        <span className="text-blue-500">•</span>
                        {ref}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Practical Implications */}
              {response.practical_implications?.length > 0 && (
                <div>
                  <h4 className="font-semibold text-slate-900 mb-2 flex items-center gap-2">
                    <Scale className="w-4 h-4 text-purple-600" />
                    Practical Implications
                  </h4>
                  <ul className="space-y-1">
                    {response.practical_implications.map((impl, idx) => (
                      <li key={idx} className="text-sm text-slate-600 flex items-start gap-2">
                        <span className="text-purple-500">•</span>
                        {impl}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Recent Updates */}
              {response.recent_updates && (
                <Alert className="bg-blue-50 border-blue-200">
                  <Calendar className="w-4 h-4 text-blue-600" />
                  <AlertDescription className="text-sm text-blue-900">
                    <strong>Recent Updates:</strong> {response.recent_updates}
                  </AlertDescription>
                </Alert>
              )}

              {/* Common Pitfalls */}
              {response.common_pitfalls?.length > 0 && (
                <div>
                  <h4 className="font-semibold text-slate-900 mb-2 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    Common Pitfalls to Avoid
                  </h4>
                  <div className="space-y-2">
                    {response.common_pitfalls.map((pitfall, idx) => (
                      <div key={idx} className="p-2 bg-amber-50 rounded text-sm text-amber-900 flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                        {pitfall}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Best Practices */}
              {response.best_practices?.length > 0 && (
                <div>
                  <h4 className="font-semibold text-slate-900 mb-2 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                    Best Practices
                  </h4>
                  <div className="space-y-2">
                    {response.best_practices.map((practice, idx) => (
                      <div key={idx} className="p-2 bg-green-50 rounded text-sm text-green-900 flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                        {practice}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Confidence Note */}
              {response.confidence_note && (
                <p className="text-xs text-slate-500 italic border-t pt-4">
                  Note: {response.confidence_note}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {response?.error && (
          <Alert className="bg-red-50 border-red-200">
            <AlertTriangle className="w-4 h-4 text-red-600" />
            <AlertDescription className="text-sm text-red-900">{response.error}</AlertDescription>
          </Alert>
        )}

        {/* History Panel */}
        {showHistory && history.length > 0 && (
          <Card className="border-slate-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <History className="w-4 h-4" />
                Recent Questions
              </CardTitle>
            </CardHeader>
            <CardContent className="max-h-64 overflow-auto">
              <div className="space-y-2">
                {history.map((item, idx) => (
                  <div 
                    key={idx}
                    className="p-3 bg-slate-50 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors"
                    onClick={() => {
                      setJurisdiction(item.jurisdiction);
                      setResponse(item.response);
                    }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <Badge variant="outline" className="text-xs">{item.jurisdictionName}</Badge>
                      <span className="text-xs text-slate-400">
                        {new Date(item.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-sm text-slate-700 truncate">{item.question}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </CardContent>
    </Card>
  );
}