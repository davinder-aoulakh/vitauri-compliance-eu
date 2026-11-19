import { describe, it, expect } from "vitest";
import { phoneCountry, evaluate } from "../../base44/shared/crs/index.js";

describe("phoneCountry", () => {
  it("reads international numbers", () => {
    expect(phoneCountry("+32 53 123 456")).toBe("BE");
    expect(phoneCountry("0031 20 123 4567")).toBe("NL");
    expect(phoneCountry("+5999 461 1234")).toBe("CW");
    expect(phoneCountry("+1 721 555 1234")).toBe("SX");
    expect(phoneCountry("+351 21 123 4567")).toBe("PT");
  });
  it("returns null when the country can't be told", () => {
    expect(phoneCountry("+1 212 555 1234")).toBeNull(); // US or Canada
    expect(phoneCountry("+7 495 123 4567")).toBeNull();
    expect(phoneCountry("461 1234")).toBeNull();
    expect(phoneCountry("")).toBeNull();
    expect(phoneCountry("+32")).toBeNull();
  });
});

const C = ["CW", "BE", "NL", "US"].map((c) => ({ country_code: c, country_name: c, is_crs_country: c !== "US" }));
const ctx = { settings: { reporting_jurisdiction: "CW", preexisting_cutoff: "2015-12-31", residence_address_test_allowed: true }, reportableList: { version: "x", jurisdictions: [{ code: "BE" }, { code: "NL" }] }, countries: C, asOf: "2026-11-19" };
const acct = (phone) => ({ account_holder_type: "individual", account_holder_name: "P", account_type: "depository", account_creation_date: "2014-06-12", year_end_cash_value: 50000, year_end_cash_value_currency: "USD", current_address: { country: "CW" }, current_phone: phone });

describe("phone indicium in the engine", () => {
  it("a Belgian number on a CW-resident pre-existing account is indicium (c) and asks whether it is cured", () => {
    const r = evaluate({ ...ctx, account: acct("+32 53 123 456") });
    expect(r.steps.find((s) => s.key === "IND_PRE.INDICIA_SEARCH").evidence).toMatch(/c_phone BE/);
    expect(r.gaps.map((g) => g.key)).toEqual(["IND_PRE.CURE"]);
  });
  it("a local or US number is not an indicium", () => {
    expect(evaluate({ ...ctx, account: acct("+5999 461 1234") }).outcome.status).toBe("non_reportable");
    expect(evaluate({ ...ctx, account: acct("+1 212 555 1234") }).outcome.status).toBe("non_reportable");
  });
});
