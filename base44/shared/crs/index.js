// Classification Studio — shared CRS engine entry point.
export { evaluate, inputHash, materialSnapshot, ENGINE_VERSION } from "./engine.js";
export { BASELINE_PACK, BASELINE_RULES, BASELINE_PACK_VERSION, resolvePack, getRule } from "./baselinePack.js";
export { normalizeCountry, buildCountryIndex, countryName } from "./countries.js";
export { buildDecision, accountWriteBack, canConfirm, loadStudioInput, loadPublishedPacks } from "./decision.js";
export { matchesCondition, CONDITION_FACTS, CONDITION_OPERATORS } from "./conditions.js";
export { validatePack, diffPacks, packFingerprint, draftFingerprint, effectiveRulesForValidation, ruleContent, nextVersion, baselineRuleRows, PARAM_SPECS, EDITABLE_TEXT_FIELDS, PROCEDURE_LABELS, HOOK_LABELS } from "./library.js";
export { FIXTURES, runFixtures, runFixture } from "./fixtures.js";
export { EXTRA_QUESTION_HOOKS } from "./engine.js";
export { buildTimeline, previousDecision, snapshotChanges, changesFor, decisionRows, stepRows, aiRows, showValue, OUTCOME_TEXT, SOURCE_TEXT, TRIGGER_TEXT } from "./timeline.js";
export { changeCaseDueDate, reevaluationOutcome, changeCaseFields, isSystemProposal } from "./reevaluation.js";
export { phoneCountry } from "./phones.js";
