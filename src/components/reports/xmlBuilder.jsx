/**
 * xmlBuilder.js — Pure JavaScript module (NO JSX).
 * All XML generation lives here so the JSX/Babel compiler never touches
 * the template literals. This prevents capitalized XML tag names like
 * <Name>, <Individual>, <Organisation> from being mangled to <n>, <i>, <o>.
 */

import { normalizeCountryCode, sanitizeTIN, sanitizeText, sanitizePostalCode } from './xmlUtils';
import { generateMessageRefId, generateDocRefId, validateIdFormat } from './idGenerator';

// Strip prohibited character combinations (Annex 4 rule 17)
function sanitizeProhibited(str) {
  return str
    .replace(/--/g, '-')
    .replace(/\/\*/g, '/ ')
    .replace(/&#/g, '&');
}

export function escapeXML(str) {
  if (!str) return '';
  const sanitized = sanitizeProhibited(String(str));
  return sanitized
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function scanForProhibitedChars(accounts, controllingPersons, entity) {
  const PROHIBITED = [/--/, /\/\*/, /&#/];
  const issues = [];

  const checkField = (value, context) => {
    if (!value || typeof value !== 'string') return;
    for (const pattern of PROHIBITED) {
      if (pattern.test(value)) {
        issues.push(`${context}: contains prohibited sequence "${value.match(pattern)[0]}"`);
        break;
      }
    }
  };

  checkField(entity?.entity_name, 'Entity name');
  checkField(entity?.address?.street, 'Entity street address');
  checkField(entity?.address?.city, 'Entity city');

  accounts.forEach(a => {
    const label = a.account_holder_name || a.account_number || a.id;
    checkField(a.account_number, `Account "${label}" — account number`);
    checkField(a.account_holder_name, `Account "${label}" — holder name`);
    checkField(a.first_name, `Account "${label}" — first name`);
    checkField(a.last_name, `Account "${label}" — last name`);
    checkField(a.middle_name, `Account "${label}" — middle name`);
    checkField(a.account_holder_address?.street, `Account "${label}" — street`);
    checkField(a.account_holder_address?.city, `Account "${label}" — city`);
    (a.tax_residencies || []).forEach(r => checkField(r.tin, `Account "${label}" — TIN`));
  });

  controllingPersons.forEach(cp => {
    const label = cp.first_name ? `${cp.first_name} ${cp.last_name || ''}`.trim() : (cp.full_name || cp.id);
    checkField(cp.first_name, `Controlling person "${label}" — first name`);
    checkField(cp.last_name, `Controlling person "${label}" — last name`);
    checkField(cp.address?.street, `Controlling person "${label}" — street`);
    checkField(cp.address?.city, `Controlling person "${label}" — city`);
    (cp.tax_residencies || []).forEach(r => checkField(r.tin, `Controlling person "${label}" — TIN`));
  });

  return issues;
}

function buildAddressBlock(address, fallbackCountry, ns = '') {
  if (!address) return '';
  const countryCode = normalizeCountryCode(address.country || fallbackCountry);
  const hasCity = address.city && String(address.city).trim() !== '';

  if (!hasCity) {
    const countryDisplay = (() => {
      const c = String(address.country || '').trim();
      const lower = c.toLowerCase();
      if (lower.includes('united kingdom') || lower.includes('great britain') || lower === 'gb') return 'United Kingdom';
      if (lower.includes('united states') || lower === 'us' || lower === 'usa') return 'United States';
      return c;
    })();
    const parts = [address.street, address.state, address.postal_code, countryDisplay]
      .filter(Boolean).map(p => String(p).trim()).filter(Boolean);
    return `
          <${ns}Address AddressType="OECD303">
            <${ns}CountryCode>${countryCode}</${ns}CountryCode>
            <${ns}AddressFree>${escapeXML(sanitizeText(parts.join(', ')))}</${ns}AddressFree>
          </${ns}Address>`;
  }

  const postCode = sanitizePostalCode(address.postal_code, countryCode);
  return `
          <${ns}Address AddressType="OECD303">
            <${ns}CountryCode>${countryCode}</${ns}CountryCode>
            <${ns}AddressFix>
              ${address.street ? `<${ns}Street>${escapeXML(sanitizeText(address.street))}</${ns}Street>` : ''}
              <${ns}City>${escapeXML(sanitizeText(address.city))}</${ns}City>
              ${postCode ? `<${ns}PostCode>${escapeXML(postCode)}</${ns}PostCode>` : ''}
            </${ns}AddressFix>
          </${ns}Address>`;
}

export function buildCRSXML({ report, entity, tenant, accounts, controllingPersons, jurisdictionConfig, isNilReport }) {
  // GAP 6: British spelling — use Organisation not Organization throughout
  // The FATCA-CRS schema v2.2 uses British spelling per the official spec
  
  // GAP 7: Timestamp format — milliseconds optional per spec (YYYY-MM-DDTHH:mm:ss.nnn or YYYY-MM-DDTHH:mm:ss)
  // Current implementation generates YYYY-MM-DDTHH:mm:ss (without milliseconds), which is valid
  const timestamp = new Date().toISOString().substring(0, 19);
  const cribNumber = entity?.tax_id || '';

  const messageRefId = generateMessageRefId({
    fiscalYear: report.reporting_year,
    cribNumber,
    serialNumber: '001'
  });

  const validation = validateIdFormat(messageRefId, 'MessageRefId');
  if (!validation.isValid) {
    console.warn('MessageRefId validation warnings:', validation.errors);
  }

  let messageTypeIndic;
  if (report.is_test_supply) {
    messageTypeIndic = 'CRS704';
  } else if (isNilReport) {
    messageTypeIndic = 'CRS703';
  } else {
    messageTypeIndic = report.message_type_indic || 'CRS701';
  }

  // Helper function for namespace handling (empty prefix — elements use default namespace)
  const ns = '';

  const sendingCompanyIN = cribNumber;
  if (!sendingCompanyIN) {
    throw new Error('Cannot generate XML: CRIB number (tax_id) is missing for the Reporting FI.');
  }

  const isFfi = entity?.is_ffi === true;
  const tinValue = isFfi ? entity?.giin : cribNumber;
  const tinIssuedBy = isFfi ? 'US' : 'CW';
  if (!tinValue) {
    throw new Error(
      isFfi
        ? 'Cannot generate XML: GIIN is missing for this FFI ReportingFI.'
        : 'Cannot generate XML: CRIB number (tax_id) is missing for this ReportingFI.'
    );
  }

  const FATCA_FILER_CATEGORY_MAP = {
    "Participating FFI (standard FATCA-registered institution)": "FATCA601",
    "Registered Deemed-Compliant FFI": "FATCA602",
    "Limited FFI or Limited Branch": "FATCA603",
    "Qualified Intermediary / Withholding Foreign Partnership or Trust": "FATCA605",
    "Direct Reporting NFFE": "FATCA606",
    "Reporting Model 1 FFI / Withholding Agent": "FATCA610"
  };
  let filerCategoryXml = '';
  if (isFfi && !entity?.is_sponsored_ffi) {
    if (!entity?.fi_registration_type) {
      throw new Error(`Please select the institution registration type for "${entity?.entity_name}" before generating the report.`);
    }
    const fatcaCode = FATCA_FILER_CATEGORY_MAP[entity.fi_registration_type];
    if (fatcaCode) {
      // Will be prefixed with ns when inserted into root element
      filerCategoryXml = `\n    <FilerCategory>${fatcaCode}</FilerCategory>`;
    }
  }

  const fiDocRefId = generateDocRefId({
    fiscalYear: report.reporting_year,
    cribNumber,
    serialNumber: '001',
    type: 'FI'
  });

  let fiDocTypeIndic;
  if (report.is_test_supply) {
    if (report.message_type_indic === 'CRS702') fiDocTypeIndic = 'OECD12';
    else if (isNilReport && report.message_type_indic === 'CRS703') fiDocTypeIndic = 'OECD13';
    else fiDocTypeIndic = 'OECD11';
  } else {
    // GAP 4: Use OECD0 for corrections, OECD1 for new, OECD3 for nil
    if (report.message_type_indic === 'CRS702') fiDocTypeIndic = 'OECD0';
    else if (isNilReport && report.message_type_indic === 'CRS703') fiDocTypeIndic = 'OECD3';
    else fiDocTypeIndic = 'OECD1';
  }

  // GAP 4: For OECD0, reuse original DocRefId without CorrDocRefId
  const fiCorrDocRefIdXml = (() => {
    if (messageTypeIndic === 'CRS701' || messageTypeIndic === 'CRS703' || messageTypeIndic === 'CRS704') return '';
    if (messageTypeIndic === 'CRS702' && fiDocTypeIndic === 'OECD0') {
      // OECD0 (Resend Data) — reuse original DocRefId, no CorrDocRefId
      return '';
    }
    if (messageTypeIndic === 'CRS702') {
      if (!report.correction_doc_ref_id) {
        throw new Error('CorrDocRefId is mandatory for the ReportingFI DocSpec in correction reports (CRS702) but correction_doc_ref_id is not set.');
      }
      return `<CorrDocRefId>${report.correction_doc_ref_id}_FI</CorrDocRefId>`;
    }
    return '';
  })();

  const corrMessageRefIdXml = (() => {
    if (messageTypeIndic === 'CRS701' || messageTypeIndic === 'CRS703') return '';
    if (messageTypeIndic === 'CRS702') {
      if (!report.correction_message_ref_id) {
        throw new Error('CorrMessageRefId is mandatory for correction reports (CRS702) but is not set.');
      }
      return `<CorrMessageRefId>${report.correction_message_ref_id}</CorrMessageRefId>`;
    }
    return report.correction_message_ref_id
      ? `<CorrMessageRefId>${report.correction_message_ref_id}</CorrMessageRefId>`
      : '';
  })();

  const buildReportingGroup = (ns = '') => {
    if (isNilReport && messageTypeIndic !== 'CRS701') {
      const nilDocRefId = generateDocRefId({
        fiscalYear: report.reporting_year,
        cribNumber,
        serialNumber: '002',
        type: 'NIL'
      });

      let nilDocTypeIndic;
      if (report.is_test_supply) {
        nilDocTypeIndic = (report.message_type_indic === 'CRS703') ? 'OECD13' : 'OECD11';
      } else {
        nilDocTypeIndic = (report.message_type_indic === 'CRS703') ? 'OECD3' : 'OECD1';
      }

      const nilCorrDocRefIdXml = (report.message_type_indic === 'CRS703' && report.correction_doc_ref_id)
        ? `\n          <${ns}CorrDocRefId>${report.correction_doc_ref_id}_NIL</${ns}CorrDocRefId>`
        : '';

      return `
    <${ns}ReportingGroup>
      <${ns}NilReport>
        <${ns}DocSpec>
          <${ns}DocTypeIndic>${nilDocTypeIndic}</${ns}DocTypeIndic>
          <${ns}DocRefId>${nilDocRefId}</${ns}DocRefId>${nilCorrDocRefIdXml}
        </${ns}DocSpec>
        <${ns}NoAccountToReport>yes</${ns}NoAccountToReport>
      </${ns}NilReport>
    </${ns}ReportingGroup>`;
    }

    const ACCT_TYPE_CODE_MAP = {
      "IBAN": "OECD601",
      "Bank account number (non-IBAN)": "OECD602",
      "ISIN": "OECD603",
      "Securities account number (non-ISIN)": "OECD604",
      "Other account identifier": "OECD605"
    };

    const ctrlTypeMap = {
      legal_person_ownership: 'CRS801',
      legal_person_other_means: 'CRS802',
      legal_person_senior_managing_official: 'CRS803',
      trust_settlor: 'CRS804',
      trust_trustee: 'CRS805',
      trust_protector: 'CRS806',
      trust_beneficiary: 'CRS807',
      trust_other: 'CRS808',
      legal_arrangement_settlor_equivalent: 'CRS809',
      legal_arrangement_trustee_equivalent: 'CRS810',
      legal_arrangement_protector_equivalent: 'CRS811',
      legal_arrangement_beneficiary_equivalent: 'CRS812',
      legal_arrangement_other_equivalent: 'CRS813'
    };

    const accountBlocks = accounts.map((account, index) => {
      const accDocRefId = generateDocRefId({
        fiscalYear: report.reporting_year,
        cribNumber,
        serialNumber: String(index + 1).padStart(6, '0'),
        type: 'ACC'
      });

      let docTypeIndic;
      if (report.is_test_supply) {
        if (report.message_type_indic === 'CRS702') docTypeIndic = 'OECD12';
        else if (report.message_type_indic === 'CRS703') docTypeIndic = 'OECD13';
        else docTypeIndic = 'OECD11';
      } else {
        if (report.message_type_indic === 'CRS702') docTypeIndic = 'OECD2';
        else if (report.message_type_indic === 'CRS703') docTypeIndic = 'OECD3';
        else docTypeIndic = 'OECD1';
      }

      const corrDocRefIdXml = (() => {
        if (messageTypeIndic !== 'CRS702') return '';
        if (!report.correction_doc_ref_id) {
          throw new Error(`CorrDocRefId is mandatory for AccountReport DocSpec in correction reports (CRS702) but correction_doc_ref_id is not set (account: ${account.account_number}).`);
        }
        return `<${ns}CorrDocRefId>${report.correction_doc_ref_id}_ACC${String(index + 1).padStart(3, '0')}</${ns}CorrDocRefId>`;
      })();

      let derivedCrsCode = null;
      if (account.account_holder_type === 'entity') {
        const hasControllingPersons = (account.controlling_persons_count || 0) > 0;
        switch (account.entity_classification) {
          case 'passive_nfe':
            derivedCrsCode = hasControllingPersons ? 'CRS101' : 'CRS103';
            break;
          case 'active_nfe':
          case 'financial_institution':
            derivedCrsCode = 'CRS102';
            break;
          case 'not_applicable':
          default:
            derivedCrsCode = null;
        }

        if (derivedCrsCode === 'CRS101') {
          if (!hasControllingPersons) {
            throw new Error(`Organisation "${account.account_holder_name || account.account_number}" is a passive NFE with controlling persons (CRS101) — please add at least one controlling person before generating.`);
          }
          const accountCPsForValidation = controllingPersons.filter(cp => cp.account_id === account.id);
          for (const cp of accountCPsForValidation) {
            if (!cp.control_type) {
              const cpName = cp.first_name
                ? `${cp.first_name} ${cp.last_name || ''}`.trim()
                : (cp.full_name || cp.id);
              throw new Error(`Please select a "Type of Control" role for controlling person "${cpName}" on account "${account.account_holder_name || account.account_number}" before generating the report.`);
            }
          }
        }

        const taxCountries = (account.tax_residencies || []).map(r => r.country);
        const hasUS = taxCountries.includes('US');
        if (hasUS && account.entity_classification === 'passive_nfe' && !account.fatca_entity_classification) {
          throw new Error(`Organisation "${account.account_holder_name || account.account_number}" is a passive NFE with a US tax residency but has not been classified for FATCA. Please classify the organisation before generating the report.`);
        }
        if (['FATCA101', 'FATCA102'].includes(account.fatca_entity_classification) && !hasControllingPersons) {
          throw new Error(`Organisation "${account.account_holder_name || account.account_number}" requires Substantial Owner details — please add at least one substantial owner before generating.`);
        }
      }

      if (account.account_holder_type === 'individual' && account.date_of_birth) {
        const birthYear = new Date(account.date_of_birth).getFullYear();
        const currentYear = new Date().getFullYear();
        if (birthYear < 1900 || birthYear >= currentYear) {
          throw new Error(`Account "${account.account_number}": Birth date year must be between 1900 and ${currentYear - 1}. Found year: ${birthYear}.`);
        }
      }

      const closedAttr = account.account_closed_during_period ? ' ClosedAccount="true"' : '';
      const dormantAttr = account.account_dormant_at_reporting_date ? ' DormantAccount="true"' : '';

      const noAccountNumber = account.account_number_type === "No account number exists";
      const accountNumberVal = noAccountNumber ? 'NANUM' : (account.account_number ? escapeXML(account.account_number) : 'NANUM');
      const acctTypeCode = noAccountNumber ? null : ACCT_TYPE_CODE_MAP[account.account_number_type] || null;
      const acctTypeAttr = acctTypeCode ? ` AcctNumberType="${acctTypeCode}"` : '';

      if (!noAccountNumber && !account.account_number?.trim()) {
        const holderName = account.account_holder_name || account.account_number || 'Unknown';
        throw new Error(`Please enter an account number for "${holderName}", or select 'No account number exists' if one is not available.`);
      }

      const balanceValue = Math.max(0, account.year_end_cash_value || 0).toFixed(2);
      const balanceCurrency = account.year_end_cash_value_currency || account.gross_payments_currency || 'USD';

      const buildPaymentBlock = (ns = '', isFfi = false, reportingYear = '') => {
        const grossPayments = account.gross_payments;
        if (!grossPayments || grossPayments <= 0) return '';
        const payCurrency = account.gross_payments_currency || account.year_end_cash_value_currency;
        if (!payCurrency) {
          throw new Error(`Please select a currency for account "${account.account_number}" before generating the report.`);
        }
        const paymentTypeMap = {
          depository: 'CRS502',
          custodial: 'CRS501',
          equity_debt_interest: 'CRS504',
          cash_value_insurance: 'CRS504',
          annuity: 'CRS504'
        };
        const paymentType = paymentTypeMap[account.account_type] || 'CRS504';
        
        // Fiscal year-based payment type restrictions for FATCA accounts (isFfi = true)
        if (isFfi) {
          // 2014: suppress all payments for FFI accounts
          if (reportingYear === '2014') {
            return '';
          }
          
          // 2015: allow only CRS501 (custodial) and CRS502 (depository) for FFI accounts
          if (reportingYear === '2015') {
            if (!['CRS501', 'CRS502'].includes(paymentType)) {
              throw new Error(`For reporting year 2015, FFI account "${account.account_number}" can only report custodial (CRS501) or depository (CRS502) payment types. Found: ${paymentType}.`);
            }
          }
        }
        
        return `
      <${ns}Payment>
        <${ns}PaymentType>${paymentType}</${ns}PaymentType>
        <${ns}PaymentAmnt CurrCode="${payCurrency}">${parseFloat(grossPayments).toFixed(2)}</${ns}PaymentAmnt>
      </${ns}Payment>`;
      };

      const accountCPs = derivedCrsCode === 'CRS101'
        ? controllingPersons.filter(cp => cp.account_id === account.id)
        : [];

      const cpBirthDates = accountCPs.map(cp => cp.date_of_birth).filter(Boolean);
      const dupBirthDates = cpBirthDates.filter((d, i) => cpBirthDates.indexOf(d) !== i);
      if (dupBirthDates.length > 0) {
        console.warn(`Account "${account.account_holder_name || account.account_number}": Multiple controlling persons share the same birth date (${[...new Set(dupBirthDates)].join(', ')}).`);
      }

      const cpBlocks = accountCPs.map(cp => {
        if (!cp.last_name && !cp.full_name) {
          throw new Error(`Controlling person "${cp.first_name || cp.id}" on account "${account.account_holder_name || account.account_number}" is missing a Last Name.`);
        }

        const ctrlgPersonType = cp.control_type ? (ctrlTypeMap[cp.control_type] || 'CRS801') : 'CRS801';

        const cpAddressFallbackCountry = (() => {
          if (cp.address?.country) return normalizeCountryCode(cp.address.country);
          if (cp.tax_residencies?.length > 0) return normalizeCountryCode(cp.tax_residencies[0].country);
          return 'CW';
        })();

        const cpTaxResidencyBlocks = (cp.tax_residencies || []).map(res => {
          const cpCountryCode = normalizeCountryCode(res.country);
          const cpTin = res.tin ? sanitizeTIN(res.tin) : null;
          return `
          <${ns}ResCountryCode>${cpCountryCode}</${ns}ResCountryCode>
          ${cpTin ? `<${ns}TIN IssuedBy="${cpCountryCode}">${escapeXML(cpTin)}</${ns}TIN>` : ''}`;
        }).join('');

        return `
      <${ns}ControllingPerson>
        <${ns}Individual>
          ${cpTaxResidencyBlocks}
          <${ns}Name NameType="OECD207">
            <${ns}FirstName>${escapeXML(sanitizeText(cp.first_name || 'NFN'))}</${ns}FirstName>
            <${ns}LastName>${escapeXML(sanitizeText(cp.last_name || ''))}</${ns}LastName>
          </${ns}Name>
          ${buildAddressBlock(cp.address, cpAddressFallbackCountry, ns)}
          ${cp.date_of_birth ? `<${ns}BirthInfo><${ns}BirthDate>${cp.date_of_birth}</${ns}BirthDate></${ns}BirthInfo>` : ''}
        </${ns}Individual>
        <${ns}CtrlgPersonType>${ctrlgPersonType}</${ns}CtrlgPersonType>
      </${ns}ControllingPerson>`;
      }).join('');

      const taxResidencies = account.tax_residencies || [];
      const resCountryCodes = taxResidencies.length > 0
        ? taxResidencies.map(res => normalizeCountryCode(res.country)).filter(Boolean)
        : [normalizeCountryCode(account.account_holder_address?.country || 'CW')];

      const resCountryCodeBlocks = [...new Set(resCountryCodes)]
        .map(code => `<ResCountryCode>${code}</ResCountryCode>`)
        .join('\n          ');

      const tinBlocks = taxResidencies.map(res => {
        const resCode = normalizeCountryCode(res.country);
        const resTin = res.tin ? sanitizeTIN(res.tin) : null;
        if (resTin) return `<TIN IssuedBy="${resCode}">${escapeXML(resTin)}</TIN>`;
        if (resCode === 'US') return `<TIN IssuedBy="US">000000000</TIN>`;
        return '';
      }).join('');

      let accountHolderBlock;
      let acctClassifications = '';
      
      if (account.account_holder_type === 'individual') {
        accountHolderBlock = `
        <${ns}Individual>
          ${resCountryCodeBlocks.replace(/ResCountryCode/g, ns + 'ResCountryCode')}
          ${tinBlocks.replace(/TIN/g, ns + 'TIN')}
          <${ns}Name>
            ${account.name_prefix ? `<${ns}NamePrefix>${escapeXML(sanitizeText(account.name_prefix))}</${ns}NamePrefix>` : ''}
            ${account.title ? `<${ns}Title>${escapeXML(sanitizeText(account.title))}</${ns}Title>` : ''}
            <${ns}FirstName>${escapeXML(sanitizeText(account.first_name || 'NFN'))}</${ns}FirstName>
            ${account.middle_name ? `<${ns}MiddleName>${escapeXML(sanitizeText(account.middle_name))}</${ns}MiddleName>` : ''}
            <${ns}LastName>${escapeXML(sanitizeText(account.last_name || (account.account_holder_name || '').split(' ').slice(1).join(' ') || 'NFN'))}</${ns}LastName>
          </${ns}Name>
          ${buildAddressBlock(account.account_holder_address, 'CW', ns)}
          ${account.date_of_birth ? `<${ns}BirthInfo><${ns}BirthDate>${account.date_of_birth}</${ns}BirthDate></${ns}BirthInfo>` : ''}
          <${ns}Recalcitrant>${account.is_recalcitrant === true ? 'true' : 'false'}</${ns}Recalcitrant>
        </${ns}Individual>`;
      } else {
        const accountCPsForRes = controllingPersons.filter(cp => cp.account_id === account.id);
        const cpResCountries = accountCPsForRes
          .flatMap(cp => (cp.tax_residencies || []).map(r => normalizeCountryCode(r.country)))
          .filter(Boolean);
        const orgResCodes = [...new Set([...resCountryCodes, ...cpResCountries])];
        const orgResCountryCodeBlocks = orgResCodes
          .map(code => `<${ns}ResCountryCode>${code}</${ns}ResCountryCode>`)
          .join('\n          ');

        accountHolderBlock = `
        <${ns}Organisation>
          ${orgResCountryCodeBlocks}
          ${tinBlocks.replace(/TIN/g, ns + 'TIN')}
          <${ns}Name>${escapeXML(sanitizeText(account.account_holder_name))}</${ns}Name>
          ${buildAddressBlock(account.account_holder_address, 'CW', ns)}
          <${ns}Recalcitrant>${account.is_recalcitrant === true ? 'true' : 'false'}</${ns}Recalcitrant>
        </${ns}Organisation>`;
        
        // GAP 5: AcctHolderTypeCRS and FATCAClassification are siblings of Organisation inside AccountHolder (entity accounts only)
        acctClassifications = `${derivedCrsCode ? `
        <${ns}AcctHolderTypeCRS>${derivedCrsCode}</${ns}AcctHolderTypeCRS>` : ''}${account.fatca_entity_classification ? `
        <${ns}AcctHolderTypeFATCA>${account.fatca_entity_classification}</${ns}AcctHolderTypeFATCA>` : ''}`;
      }

      // GAP 9: AdditionalData section (optional, up to 100 items)
      const additionalDataBlock = (() => {
        const items = (account.additional_items || []).slice(0, 100);
        if (items.length === 0) return '';
        
        const itemsXml = items.map(item => {
          const itemName = escapeXML(sanitizeText(String(item.item_name || '').substring(0, 200)));
          const itemContent = escapeXML(sanitizeText(String(item.item_content || '').substring(0, 4000)));
          return `
        <${ns}AdditionalItem>
          <${ns}ItemName>${itemName}</${ns}ItemName>
          <${ns}ItemContent>${itemContent}</${ns}ItemContent>
        </${ns}AdditionalItem>`;
        }).join('');
        
        return `
      <${ns}AdditionalData>${itemsXml}
      </${ns}AdditionalData>`;
      })();

      return `
    <${ns}AccountReport>
      <${ns}DocSpec>
        <${ns}DocTypeIndic>${docTypeIndic}</${ns}DocTypeIndic>
        <${ns}DocRefId>${accDocRefId}</${ns}DocRefId>
        ${corrDocRefIdXml}
      </${ns}DocSpec>
      
      <${ns}AccountNumber${closedAttr}${dormantAttr}${acctTypeAttr}>${accountNumberVal}</${ns}AccountNumber>
      
      <${ns}AccountHolder>
        ${accountHolderBlock}${acctClassifications}
      </${ns}AccountHolder>
      
      <${ns}AccountBalance CurrCode="${balanceCurrency}">${balanceValue}</${ns}AccountBalance>
      ${buildPaymentBlock(ns, isFfi, report.reporting_year)}
      ${cpBlocks}${additionalDataBlock}
    </${ns}AccountReport>`;
    }).join('');

    return `
    <${ns}ReportingGroup>
      ${accountBlocks}
    </${ns}ReportingGroup>`;
  };

  // GAP 1: Correct namespace URIs, version 2.2
  return `<?xml version="1.0" encoding="UTF-8"?>
<FATCA_CRS version="2.2"
  xmlns="urn:fatcacrs:ties:v2"
  xmlns:sfa_ftc="urn:oecd:ties:fatcacrstypes:v2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:sfa="urn:oecd:ties:stffatcatypes:v2">
  <${ns}MessageHeader>
    <${ns}SendingCompanyIN>${sendingCompanyIN}</${ns}SendingCompanyIN>
    <${ns}TransmittingCountry>CW</${ns}TransmittingCountry>
    <${ns}ReceivingCountry>CW</${ns}ReceivingCountry>
    <${ns}MessageType>FATCA-CRS</${ns}MessageType>
    <${ns}MessageRefId>${messageRefId}</${ns}MessageRefId>${corrMessageRefIdXml ? `\n    ${corrMessageRefIdXml.replace(/</g, '<' + ns).replace(/<\/([^>]+)>/g, (match, tag) => '</' + ns + tag + '>')}` : ''}
    <${ns}MessageTypeIndic>${messageTypeIndic}</${ns}MessageTypeIndic>
    <${ns}ReportingPeriod>${report.reporting_year}-12-31</${ns}ReportingPeriod>
    <${ns}Timestamp>${timestamp}</${ns}Timestamp>
  </${ns}MessageHeader>
  
  <${ns}MessageBody>
    <${ns}ReportingFI>
      <${ns}ResCountryCode>CW</${ns}ResCountryCode>
      <${ns}TIN IssuedBy="${tinIssuedBy}">${escapeXML(tinValue)}</${ns}TIN>
      <${ns}Name NameType="OECD207">${escapeXML(entity.entity_name)}</${ns}Name>

      ${buildAddressBlock(entity.address, 'CW', ns)}${filerCategoryXml ? filerCategoryXml.replace(/</g, '<' + ns).replace(/<\/([^>]+)>/g, (match, tag) => '</' + ns + tag + '>') : ''}
      <${ns}DocSpec>
        <${ns}DocTypeIndic>${fiDocTypeIndic}</${ns}DocTypeIndic>
        <${ns}DocRefId>${fiDocRefId}</${ns}DocRefId>
        ${fiCorrDocRefIdXml ? fiCorrDocRefIdXml.replace(/</g, '<' + ns).replace(/<\/([^>]+)>/g, (match, tag) => '</' + ns + tag + '>') : ''}
      </${ns}DocSpec>
    </${ns}ReportingFI>
    ${buildReportingGroup(ns)}
  </MessageBody>
</FATCA_CRS>`;
}