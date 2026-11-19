// Classification Studio — shared CRS engine entry point.
export { evaluate, inputHash, materialSnapshot, ENGINE_VERSION } from "./engine.js";
export { BASELINE_PACK, BASELINE_RULES, BASELINE_PACK_VERSION, resolvePack, getRule } from "./baselinePack.js";
export { normalizeCountry, buildCountryIndex, countryName } from "./countries.js";
export { buildDecision, accountWriteBack, canConfirm, loadStudioInput } from "./decision.js";
