import React from "react";
import { Badge } from "@/components/ui/badge";
import { Users, HeartHandshake } from "lucide-react";
import { deglyph } from "../../../base44/shared/crs/references.js";

const ROLE = {
  legal_person_ownership: "Owner", legal_person_other_means: "Control by other means", legal_person_senior_managing_official: "Senior managing official",
  trust_settlor: "Settlor", trust_trustee: "Trustee", trust_protector: "Protector", trust_beneficiary: "Beneficiary", trust_other: "Other person in control",
  legal_arrangement_settlor_equivalent: "Settlor-equivalent",
};
const MANUAL = { reportable: "Reportable", non_reportable: "Non-reportable", pending_review: "Pending review", work_in_progress: "In progress", excluded: "Excluded" };
const nameOf = (p) => p.full_name || [p.first_name, p.last_name].filter(Boolean).join(" ") || "Unnamed";
const residencesOf = (p) => [...new Set([...(p.tax_residencies || []).map((t) => t.country), p.country_of_residence_code, p.country_of_residence, p.address?.country].filter(Boolean))];

/**
 * Who stands behind the account: the controlling persons of an entity (and whether the CRS looks through to them),
 * or the beneficiaries / heirs of an individual account. Shows the manual-flow classification beside the studio's.
 */
export default function StudioPeople({ row }) {
  const { account, input, result } = row;
  const cps = input?.controllingPersons || [];
  const bens = input?.beneficiaries || [];
  const entity = result?.entity;

  if (account.account_holder_type === "entity") {
    const studioByName = Object.fromEntries((entity?.controlling_persons || []).map((p) => [p.name, p]));
    return (
      <div className="rounded-lg border bg-slate-50/60 p-3">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <Users className="w-4 h-4 text-slate-500" />
          <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold">Controlling persons · {cps.length}</p>
          {entity && entity.look_through !== null && (
            <Badge variant="outline" className={entity.look_through ? "border-orange-300 text-orange-800" : "border-slate-300 text-slate-600"}>
              {entity.look_through ? "Looked through" : "Not looked through"}
            </Badge>
          )}
        </div>
        {entity?.reason && <p className="text-xs text-slate-700 mb-2">{deglyph(entity.reason)}</p>}
        {cps.length === 0 ? <p className="text-xs text-slate-500">No controlling persons are recorded for this entity.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="text-left text-slate-500"><th className="py-1 pr-2 font-medium">Name</th><th className="py-1 pr-2 font-medium">Role</th><th className="py-1 pr-2 font-medium">Residence</th><th className="py-1 pr-2 font-medium">Self-certification</th><th className="py-1 pr-2 font-medium">Manual result</th></tr></thead>
              <tbody>
                {cps.map((c, i) => {
                  const s = studioByName[nameOf(c)];
                  return (
                    <tr key={c.id || i} className="border-t border-slate-200">
                      <td className="py-1 pr-2 text-slate-800">{nameOf(c)}</td>
                      <td className="py-1 pr-2">{ROLE[c.control_type] || "Controlling person"}{c.ownership_percentage ? ` · ${c.ownership_percentage}%` : ""}</td>
                      <td className="py-1 pr-2">{residencesOf(c).join(", ") || <span className="text-amber-700">Not recorded</span>}{s?.reportable_jurisdictions?.length ? <Badge variant="outline" className="ml-1 text-[10px] border-orange-300 text-orange-800">reportable jurisdiction</Badge> : null}</td>
                      <td className="py-1 pr-2">{c.self_certification_obtained ? "On file" : "Not on file"}</td>
                      <td className="py-1 pr-2">{c.is_reportable === true ? "Reportable" : c.is_reportable === false ? "Non-reportable" : "Not classified"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  const deceased = account.account_holder_is_alive === false || account.account_holder_deceased_during_period === true;
  if (!bens.length && !deceased) return null;
  const holders = result?.holders;
  return (
    <div className="rounded-lg border bg-slate-50/60 p-3">
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <HeartHandshake className="w-4 h-4 text-slate-500" />
        <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold">Beneficiaries · {bens.length}</p>
        {deceased && <Badge variant="outline" className="border-slate-400 text-slate-700">Holder deceased</Badge>}
        {holders && <Badge variant="outline" className="border-orange-300 text-orange-800">Checked as account holders</Badge>}
      </div>
      {holders?.label && <p className="text-xs text-slate-700 mb-2">{holders.label}: each is checked as an account holder (CRS VIII(E)(1)).</p>}
      {bens.length === 0 ? <p className="text-xs text-slate-500">No beneficiaries or heirs are recorded on this account.</p> : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="text-left text-slate-500"><th className="py-1 pr-2 font-medium">Name</th><th className="py-1 pr-2 font-medium">Residence</th><th className="py-1 pr-2 font-medium">Manual result</th></tr></thead>
            <tbody>
              {bens.map((b, i) => (
                <tr key={b.id || i} className="border-t border-slate-200">
                  <td className="py-1 pr-2 text-slate-800">{nameOf(b)}</td>
                  <td className="py-1 pr-2">{residencesOf(b).join(", ") || <span className="text-amber-700">Not recorded</span>}</td>
                  <td className="py-1 pr-2">{MANUAL[b.reportability_status] || b.reportability_status || "Not classified"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
