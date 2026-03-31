import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileCheck,
  Loader2,
  ChevronDown,
  ChevronRight
} from "lucide-react";
import { JURISDICTION_CONFIGS, validateTIN } from "./JurisdictionConfig";

// Validation rule categories
const VALIDATION_CATEGORIES = {
  STRUCTURE: "XML Structure",
  SCHEMA: "Schema Compliance",
  DATA: "Data Validation",
  JURISDICTION: "Jurisdiction Rules",
  BUSINESS: "Business Rules"
};

export default function XMLValidator({ 
  xmlContent, 
  report, 
  accounts, 
  controllingPersons,
  entity,
  onValidationComplete 
}) {
  const [validating, setValidating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState(null);
  const [expandedCategories, setExpandedCategories] = useState([]);

  const runValidation = async () => {
    setValidating(true);
    setProgress(0);
    
    const validationResults = {
      is_valid: true,
      errors: [],
      warnings: [],
      info: [],
      categories: {},
      validated_date: new Date().toISOString(),
      total_checks: 0,
      passed_checks: 0
    };

    try {
      // Step 1: XML Structure Validation (20%)
      setProgress(10);
      await validateXMLStructure(xmlContent, validationResults);
      setProgress(20);

      // Step 2: Schema Element Validation (40%)
      await validateSchemaElements(xmlContent, validationResults);
      setProgress(40);

      // Step 3: Data Validation (60%)
      await validateAccountData(accounts, controllingPersons, report, validationResults);
      setProgress(60);

      // Step 4: Jurisdiction-Specific Rules (80%)
      await validateJurisdictionRules(xmlContent, report, entity, accounts, validationResults);
      setProgress(80);

      // Step 5: Business Rules (100%)
      await validateBusinessRules(report, accounts, controllingPersons, validationResults);
      setProgress(100);

      // Calculate final validity
      validationResults.is_valid = validationResults.errors.length === 0;
      validationResults.passed_checks = validationResults.total_checks - validationResults.errors.length;

      // Convert error/warning objects to strings for storage
      const resultsForStorage = {
        ...validationResults,
        errors: validationResults.errors.map(e => typeof e === 'string' ? e : e.message || JSON.stringify(e)),
        warnings: validationResults.warnings.map(w => typeof w === 'string' ? w : w.message || JSON.stringify(w))
      };
      
      setResults(validationResults);
      onValidationComplete?.(resultsForStorage);

    } catch (error) {
      validationResults.errors.push({
        category: VALIDATION_CATEGORIES.STRUCTURE,
        code: "VAL001",
        message: `Validation error: ${error.message}`,
        severity: "error"
      });
      setResults(validationResults);
    } finally {
      setValidating(false);
    }
  };

  // Helper: get element by tag name, supporting both namespaced and non-namespaced variants
  const getElem = (doc, tag) =>
    doc.getElementsByTagName(tag)[0] ||
    doc.getElementsByTagName(`crs:${tag}`)[0] ||
    null;

  const validateXMLStructure = async (xml, results) => {
    results.categories[VALIDATION_CATEGORIES.STRUCTURE] = { passed: 0, failed: 0, warnings: 0 };
    const cat = results.categories[VALIDATION_CATEGORIES.STRUCTURE];

    // Check if XML is valid
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xml, "text/xml");
    const parseErrors = xmlDoc.getElementsByTagName("parsererror");
    
    results.total_checks++;
    if (parseErrors.length > 0) {
      results.errors.push({
        category: VALIDATION_CATEGORIES.STRUCTURE,
        code: "XML001",
        message: "Invalid XML structure - parsing error detected",
        severity: "error"
      });
      cat.failed++;
    } else {
      cat.passed++;
    }

    // Check for required root element — supports FATCA_CRS (our format) or crs:CRS_OECD
    results.total_checks++;
    const root = xmlDoc.getElementsByTagName("FATCA_CRS")[0] ||
                 xmlDoc.getElementsByTagName("crs:CRS_OECD")[0] ||
                 xmlDoc.documentElement;
    if (!root || root.tagName === 'parsererror') {
      results.errors.push({
        category: VALIDATION_CATEGORIES.STRUCTURE,
        code: "XML002",
        message: "Missing required root element (FATCA_CRS)",
        severity: "error"
      });
      cat.failed++;
    } else {
      cat.passed++;
    }

    // Check for MessageHeader
    results.total_checks++;
    const messageHeader = getElem(xmlDoc, "MessageHeader");
    if (!messageHeader) {
      results.errors.push({
        category: VALIDATION_CATEGORIES.STRUCTURE,
        code: "XML003",
        message: "Missing required element: MessageHeader",
        severity: "error"
      });
      cat.failed++;
    } else {
      cat.passed++;
    }

    // Check for MessageBody
    results.total_checks++;
    const messageBody = getElem(xmlDoc, "MessageBody");
    if (!messageBody) {
      results.errors.push({
        category: VALIDATION_CATEGORIES.STRUCTURE,
        code: "XML004",
        message: "Missing required element: MessageBody",
        severity: "error"
      });
      cat.failed++;
    } else {
      cat.passed++;
    }
  };

  const validateSchemaElements = async (xml, results) => {
    results.categories[VALIDATION_CATEGORIES.SCHEMA] = { passed: 0, failed: 0, warnings: 0 };
    const cat = results.categories[VALIDATION_CATEGORIES.SCHEMA];
    
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xml, "text/xml");

    // Check MessageSpec required elements (non-namespaced to match our generator output)
    const requiredMessageElements = [
      "SendingCompanyIN",
      "TransmittingCountry",
      "ReceivingCountry",
      "MessageType",
      "MessageRefId",
      "ReportingPeriod",
      "Timestamp"
    ];

    requiredMessageElements.forEach((elem, i) => {
      results.total_checks++;
      const element = getElem(xmlDoc, elem);
      if (!element || !element.textContent?.trim()) {
        results.errors.push({
          category: VALIDATION_CATEGORIES.SCHEMA,
          code: `SCH${i + 1}`,
          message: `Missing or empty required element: ${elem}`,
          severity: "error"
        });
        cat.failed++;
      } else {
        cat.passed++;
      }
    });

    // Check ReportingFI
    results.total_checks++;
    const reportingFI = getElem(xmlDoc, "ReportingFI");
    if (!reportingFI) {
      results.errors.push({
        category: VALIDATION_CATEGORIES.SCHEMA,
        code: "SCH010",
        message: "Missing required element: ReportingFI",
        severity: "error"
      });
      cat.failed++;
    } else {
      cat.passed++;

      // Check ReportingFI sub-elements
      const fiRequiredElements = ["ResCountryCode", "Name"];
      fiRequiredElements.forEach((elem, i) => {
        results.total_checks++;
        const element = reportingFI.getElementsByTagName(elem)[0];
        if (!element || !element.textContent?.trim()) {
          results.errors.push({
            category: VALIDATION_CATEGORIES.SCHEMA,
            code: `SCH${i + 11}`,
            message: `Missing ReportingFI element: ${elem}`,
            severity: "error"
          });
          cat.failed++;
        } else {
          cat.passed++;
        }
      });
    }

    // Check AccountReport elements (non-namespaced)
    const accountReports = [
      ...Array.from(xmlDoc.getElementsByTagName("AccountReport")),
      ...Array.from(xmlDoc.getElementsByTagName("crs:AccountReport"))
    ];
    results.total_checks++;
    if (accountReports.length === 0) {
      // Check if it's a NIL report (has NilReport element)
      const nilReport = getElem(xmlDoc, "NilReport");
      if (nilReport) {
        results.info.push({
          category: VALIDATION_CATEGORIES.SCHEMA,
          code: "SCH020",
          message: "NIL report detected — NilReport block present with no AccountReport elements",
          severity: "info"
        });
      } else {
        results.warnings.push({
          category: VALIDATION_CATEGORIES.SCHEMA,
          code: "SCH020",
          message: "No AccountReport elements found - consider NIL report if no accounts",
          severity: "warning"
        });
        cat.warnings++;
      }
      cat.passed++;
    } else {
      cat.passed++;

      // Validate each AccountReport
      accountReports.forEach((accReport, idx) => {
        // DocSpec validation
        results.total_checks++;
        const docSpec = accReport.getElementsByTagName("DocSpec")[0];
        if (!docSpec) {
          results.errors.push({
            category: VALIDATION_CATEGORIES.SCHEMA,
            code: `SCH${21 + idx}`,
            message: `AccountReport #${idx + 1}: Missing DocSpec element`,
            severity: "error"
          });
          cat.failed++;
        } else {
          cat.passed++;
        }

        // AccountNumber validation
        results.total_checks++;
        const accNum = accReport.getElementsByTagName("AccountNumber")[0];
        if (!accNum || !accNum.textContent?.trim()) {
          results.errors.push({
            category: VALIDATION_CATEGORIES.SCHEMA,
            code: `SCH${30 + idx}`,
            message: `AccountReport #${idx + 1}: Missing AccountNumber`,
            severity: "error"
          });
          cat.failed++;
        } else {
          cat.passed++;
        }

        // AccountHolder validation
        results.total_checks++;
        const accHolder = accReport.getElementsByTagName("AccountHolder")[0];
        if (!accHolder) {
          results.errors.push({
            category: VALIDATION_CATEGORIES.SCHEMA,
            code: `SCH${40 + idx}`,
            message: `AccountReport #${idx + 1}: Missing AccountHolder`,
            severity: "error"
          });
          cat.failed++;
        } else {
          cat.passed++;
        }
      });
    }
  };

  const validateAccountData = async (accounts, controllingPersons, report, results) => {
    results.categories[VALIDATION_CATEGORIES.DATA] = { passed: 0, failed: 0, warnings: 0 };
    const cat = results.categories[VALIDATION_CATEGORIES.DATA];
    const jurisdiction = report.reporting_jurisdiction;

    accounts.forEach((account, idx) => {
      // Validate account holder name
      results.total_checks++;
      if (!account.account_holder_name?.trim()) {
        results.errors.push({
          category: VALIDATION_CATEGORIES.DATA,
          code: `DAT${idx}01`,
          message: `Account ${account.account_number}: Missing account holder name`,
          severity: "error",
          accountId: account.id
        });
        cat.failed++;
      } else {
        cat.passed++;
      }

      // Validate tax residencies
      results.total_checks++;
      if (!account.tax_residencies || account.tax_residencies.length === 0) {
        results.errors.push({
          category: VALIDATION_CATEGORIES.DATA,
          code: `DAT${idx}02`,
          message: `Account ${account.account_number}: No tax residencies defined`,
          severity: "error",
          accountId: account.id
        });
        cat.failed++;
      } else {
        cat.passed++;

        // Validate each TIN
        account.tax_residencies.forEach((res, resIdx) => {
          results.total_checks++;
          if (!res.tin && !res.tin_unavailable_reason) {
            results.warnings.push({
              category: VALIDATION_CATEGORIES.DATA,
              code: `DAT${idx}${resIdx}3`,
              message: `Account ${account.account_number}: Missing TIN for ${res.country}`,
              severity: "warning",
              accountId: account.id
            });
            cat.warnings++;
          } else if (res.tin) {
            // Validate TIN format if available
            const tinValidation = validateTIN(res.tin, res.country);
            if (!tinValidation.valid) {
              results.warnings.push({
                category: VALIDATION_CATEGORIES.DATA,
                code: `DAT${idx}${resIdx}4`,
                message: `Account ${account.account_number}: ${tinValidation.message} for ${res.country}`,
                severity: "warning",
                accountId: account.id
              });
              cat.warnings++;
            } else {
              cat.passed++;
            }
          } else {
            cat.passed++;
          }
        });
      }

      // Validate address
      results.total_checks++;
      if (!account.account_holder_address?.country) {
        results.warnings.push({
          category: VALIDATION_CATEGORIES.DATA,
          code: `DAT${idx}05`,
          message: `Account ${account.account_number}: Missing address country`,
          severity: "warning",
          accountId: account.id
        });
        cat.warnings++;
      } else {
        cat.passed++;
      }

      // Validate balance for individuals
      results.total_checks++;
      if (account.account_holder_type === 'individual' && !account.date_of_birth) {
        results.warnings.push({
          category: VALIDATION_CATEGORIES.DATA,
          code: `DAT${idx}06`,
          message: `Account ${account.account_number}: Missing date of birth for individual`,
          severity: "warning",
          accountId: account.id
        });
        cat.warnings++;
      } else {
        cat.passed++;
      }
    });

    // Validate controlling persons
    controllingPersons.forEach((cp, idx) => {
      results.total_checks++;
      if (!cp.tax_residencies || cp.tax_residencies.length === 0) {
        results.warnings.push({
          category: VALIDATION_CATEGORIES.DATA,
          code: `DCP${idx}01`,
          message: `Controlling Person ${cp.full_name}: No tax residencies defined`,
          severity: "warning"
        });
        cat.warnings++;
      } else {
        cat.passed++;
      }

      results.total_checks++;
      if (!cp.date_of_birth) {
        results.warnings.push({
          category: VALIDATION_CATEGORIES.DATA,
          code: `DCP${idx}02`,
          message: `Controlling Person ${cp.full_name}: Missing date of birth`,
          severity: "warning"
        });
        cat.warnings++;
      } else {
        cat.passed++;
      }
    });
  };

  const validateJurisdictionRules = async (xml, report, entity, accounts, results) => {
    results.categories[VALIDATION_CATEGORIES.JURISDICTION] = { passed: 0, failed: 0, warnings: 0 };
    const cat = results.categories[VALIDATION_CATEGORIES.JURISDICTION];
    const jurisdiction = report.reporting_jurisdiction;
    const config = JURISDICTION_CONFIGS[jurisdiction] || JURISDICTION_CONFIGS["DEFAULT"];

    // Rule 95/96: Validate DocTypeIndic consistency — no mixing test and production codes
    results.total_checks++;
    if (xml) {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xml, "text/xml");
      // Match both namespaced (crs:DocTypeIndic) and non-namespaced (DocTypeIndic)
      const allDocTypeElems = [
        ...Array.from(xmlDoc.getElementsByTagName("crs:DocTypeIndic")),
        ...Array.from(xmlDoc.getElementsByTagName("DocTypeIndic"))
      ];
      const docTypeValues = allDocTypeElems.map(el => el.textContent.trim()).filter(Boolean);
      const TEST_CODES = new Set(['OECD11', 'OECD12', 'OECD13']);
      const PROD_CODES = new Set(['OECD1', 'OECD2', 'OECD3']);
      const hasTestCodes = docTypeValues.some(v => TEST_CODES.has(v));
      const hasProdCodes = docTypeValues.some(v => PROD_CODES.has(v));

      if (hasTestCodes && hasProdCodes) {
        results.errors.push({
          category: VALIDATION_CATEGORIES.JURISDICTION,
          code: "JUR095",
          message: "Mixing test (OECD11/12/13) and production (OECD1/2/3) DocTypeIndic codes in the same report is not allowed.",
          severity: "error"
        });
        cat.failed++;
      } else if (report.is_test_supply && hasProdCodes && !hasTestCodes) {
        results.errors.push({
          category: VALIDATION_CATEGORIES.JURISDICTION,
          code: "JUR096",
          message: "Test supply report contains production DocTypeIndic codes (OECD1/2/3). Expected OECD11/12/13.",
          severity: "error"
        });
        cat.failed++;
      } else if (!report.is_test_supply && hasTestCodes && !hasProdCodes) {
        results.errors.push({
          category: VALIDATION_CATEGORIES.JURISDICTION,
          code: "JUR097",
          message: "Production report contains test DocTypeIndic codes (OECD11/12/13). Expected OECD1/2/3.",
          severity: "error"
        });
        cat.failed++;
      } else {
        cat.passed++;
      }
    } else {
      cat.passed++;
    }

    // Check GIIN requirement
    results.total_checks++;
    if (config.requiresGIIN && !entity?.giin) {
      results.errors.push({
        category: VALIDATION_CATEGORIES.JURISDICTION,
        code: "JUR001",
        message: `${config.name} requires GIIN for reporting FI`,
        severity: "error"
      });
      cat.failed++;
    } else {
      cat.passed++;
    }

    // Check TIN requirement for entity
    results.total_checks++;
    if (!entity?.tax_id) {
      results.errors.push({
        category: VALIDATION_CATEGORIES.JURISDICTION,
        code: "JUR002",
        message: "Reporting FI Tax ID (TIN) is required",
        severity: "error"
      });
      cat.failed++;
    } else {
      cat.passed++;
    }

    // Check encryption requirement
    results.total_checks++;
    if (config.requiresEncryption) {
      results.info.push({
        category: VALIDATION_CATEGORIES.JURISDICTION,
        code: "JUR003",
        message: `${config.name} requires XML encryption before submission`,
        severity: "info"
      });
    }
    cat.passed++;

    // Add jurisdiction-specific rule reminders
    config.specificRules?.forEach((rule, idx) => {
      results.info.push({
        category: VALIDATION_CATEGORIES.JURISDICTION,
        code: `JUR${100 + idx}`,
        message: rule,
        severity: "info"
      });
    });
  };

  const validateBusinessRules = async (report, accounts, controllingPersons, results) => {
    results.categories[VALIDATION_CATEGORIES.BUSINESS] = { passed: 0, failed: 0, warnings: 0 };
    const cat = results.categories[VALIDATION_CATEGORIES.BUSINESS];

    // Check for duplicate accounts
    results.total_checks++;
    const accountNumbers = accounts.map(a => a.account_number);
    const duplicates = accountNumbers.filter((num, idx) => accountNumbers.indexOf(num) !== idx);
    if (duplicates.length > 0) {
      results.errors.push({
        category: VALIDATION_CATEGORIES.BUSINESS,
        code: "BUS001",
        message: `Duplicate account numbers found: ${[...new Set(duplicates)].join(', ')}`,
        severity: "error"
      });
      cat.failed++;
    } else {
      cat.passed++;
    }

    // Check reporting year consistency
    results.total_checks++;
    const reportYear = report.reporting_year;
    const inconsistentYears = accounts.filter(a => 
      a.reporting_year && a.reporting_year !== reportYear.toString()
    );
    if (inconsistentYears.length > 0) {
      results.warnings.push({
        category: VALIDATION_CATEGORIES.BUSINESS,
        code: "BUS002",
        message: `${inconsistentYears.length} accounts have different reporting year than report (${reportYear})`,
        severity: "warning"
      });
      cat.warnings++;
    } else {
      cat.passed++;
    }

    // Check for closed accounts without closure info
    results.total_checks++;
    const closedWithoutDate = accounts.filter(a => 
      a.account_closed_during_period && a.status === 'closed'
    );
    if (closedWithoutDate.length > 0) {
      results.info.push({
        category: VALIDATION_CATEGORIES.BUSINESS,
        code: "BUS003",
        message: `${closedWithoutDate.length} closed accounts will be reported with closure flag`,
        severity: "info"
      });
    }
    cat.passed++;

    // Check controlling persons for passive NFE accounts
    results.total_checks++;
    const passiveNFEAccounts = accounts.filter(a => a.entity_classification === 'passive_nfe');
    const passiveWithoutCP = passiveNFEAccounts.filter(a => 
      !controllingPersons.some(cp => cp.account_id === a.id)
    );
    if (passiveWithoutCP.length > 0) {
      results.warnings.push({
        category: VALIDATION_CATEGORIES.BUSINESS,
        code: "BUS004",
        message: `${passiveWithoutCP.length} passive NFE accounts have no controlling persons`,
        severity: "warning"
      });
      cat.warnings++;
    } else {
      cat.passed++;
    }

    // Minor issue 5: Duplicate birthdate check across CPs on the same account
    accounts.forEach(account => {
      const accountCPs = controllingPersons.filter(cp => cp.account_id === account.id);
      const birthDates = accountCPs.map(cp => cp.date_of_birth).filter(Boolean);
      const dupDates = [...new Set(birthDates.filter((d, i) => birthDates.indexOf(d) !== i))];
      if (dupDates.length > 0) {
        results.total_checks++;
        results.warnings.push({
          category: VALIDATION_CATEGORIES.BUSINESS,
          code: "BUS005",
          message: `Account ${account.account_number}: Multiple controlling persons share birth date(s) ${dupDates.join(', ')} — please verify data accuracy as this may trigger a notification from the receiving tax authority.`,
          severity: "warning"
        });
        cat.warnings++;
      }
    });

    // Minor issue 6: TIN label prefix check
    accounts.forEach(account => {
      (account.tax_residencies || []).forEach(res => {
        if (res.tin && /^[A-Z]{1,3}\s+\d/.test(res.tin)) {
          results.total_checks++;
          results.warnings.push({
            category: VALIDATION_CATEGORIES.BUSINESS,
            code: "BUS006",
            message: `Account ${account.account_number}: TIN "${res.tin}" for ${res.country} appears to contain a label prefix. TIN values should contain only the identifier number (e.g. strip "CI " prefix).`,
            severity: "warning"
          });
          cat.warnings++;
        }
      });
    });
    controllingPersons.forEach(cp => {
      const cpName = cp.first_name ? `${cp.first_name} ${cp.last_name || ''}`.trim() : (cp.full_name || cp.id);
      (cp.tax_residencies || []).forEach(res => {
        if (res.tin && /^[A-Z]{1,3}\s+\d/.test(res.tin)) {
          results.total_checks++;
          results.warnings.push({
            category: VALIDATION_CATEGORIES.BUSINESS,
            code: "BUS006",
            message: `Controlling person "${cpName}": TIN "${res.tin}" for ${res.country} appears to contain a label prefix. TIN values should contain only the identifier number.`,
            severity: "warning"
          });
          cat.warnings++;
        }
      });
    });
  };

  const toggleCategory = (category) => {
    setExpandedCategories(prev => 
      prev.includes(category) 
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  const getSeverityIcon = (severity) => {
    switch (severity) {
      case 'error': return <XCircle className="w-4 h-4 text-red-600" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-amber-600" />;
      case 'info': return <CheckCircle2 className="w-4 h-4 text-blue-600" />;
      default: return <CheckCircle2 className="w-4 h-4 text-green-600" />;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">XML Validation</h3>
          <p className="text-sm text-slate-600">Comprehensive schema and data validation</p>
        </div>
        <Button 
          onClick={runValidation}
          disabled={validating || !xmlContent}
          className="bg-indigo-600 hover:bg-indigo-700"
        >
          {validating ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Validating...
            </>
          ) : (
            <>
              <FileCheck className="w-4 h-4 mr-2" />
              Run Validation
            </>
          )}
        </Button>
      </div>

      {validating && (
        <div className="space-y-2">
          <Progress value={progress} className="h-2" />
          <p className="text-sm text-slate-600 text-center">
            {progress < 20 ? "Checking XML structure..." :
             progress < 40 ? "Validating schema elements..." :
             progress < 60 ? "Validating account data..." :
             progress < 80 ? "Checking jurisdiction rules..." :
             "Applying business rules..."}
          </p>
        </div>
      )}

      {results && (
        <Card className={`border-2 ${
          results.is_valid ? 'border-green-200 bg-green-50/30' : 'border-red-200 bg-red-50/30'
        }`}>
          <CardHeader className={`border-b ${results.is_valid ? 'border-green-200' : 'border-red-200'}`}>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {results.is_valid ? (
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-600" />
                )}
                <span className={results.is_valid ? "text-green-900" : "text-red-900"}>
                  {results.is_valid ? "Validation Passed" : "Validation Failed"}
                </span>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <Badge variant="outline" className="bg-green-100 text-green-800">
                  {results.passed_checks} passed
                </Badge>
                <Badge variant="outline" className="bg-red-100 text-red-800">
                  {results.errors.length} errors
                </Badge>
                <Badge variant="outline" className="bg-amber-100 text-amber-800">
                  {results.warnings.length} warnings
                </Badge>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            {/* Category breakdown */}
            {Object.entries(results.categories).map(([category, stats]) => (
              <div key={category} className="border rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleCategory(category)}
                  className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    {expandedCategories.includes(category) 
                      ? <ChevronDown className="w-4 h-4" />
                      : <ChevronRight className="w-4 h-4" />
                    }
                    <span className="font-medium">{category}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {stats.passed > 0 && (
                      <Badge variant="outline" className="bg-green-50 text-green-700 text-xs">
                        {stats.passed} ✓
                      </Badge>
                    )}
                    {stats.failed > 0 && (
                      <Badge variant="outline" className="bg-red-50 text-red-700 text-xs">
                        {stats.failed} ✗
                      </Badge>
                    )}
                    {stats.warnings > 0 && (
                      <Badge variant="outline" className="bg-amber-50 text-amber-700 text-xs">
                        {stats.warnings} ⚠
                      </Badge>
                    )}
                  </div>
                </button>
                
                {expandedCategories.includes(category) && (
                  <div className="p-3 space-y-2 border-t">
                    {[...results.errors, ...results.warnings, ...results.info]
                      .filter(item => item.category === category)
                      .map((item, idx) => (
                        <div 
                          key={idx}
                          className={`flex items-start gap-2 p-2 rounded text-sm ${
                            item.severity === 'error' ? 'bg-red-50' :
                            item.severity === 'warning' ? 'bg-amber-50' :
                            'bg-blue-50'
                          }`}
                        >
                          {getSeverityIcon(item.severity)}
                          <div>
                            <span className="font-mono text-xs text-slate-500 mr-2">[{item.code}]</span>
                            <span>{item.message}</span>
                          </div>
                        </div>
                      ))
                    }
                    {[...results.errors, ...results.warnings, ...results.info]
                      .filter(item => item.category === category).length === 0 && (
                      <p className="text-sm text-green-700 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4" />
                        All checks passed for this category
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}