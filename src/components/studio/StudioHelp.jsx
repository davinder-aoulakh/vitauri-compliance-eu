import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const CONFIRM_ROLES = ["tenant_admin", "tenant_supervisor"];

const Section = ({ id, title, children, highlight }) => (
  <AccordionItem value={id}>
    <AccordionTrigger className="text-left text-sm font-semibold">
      <span className="flex items-center gap-2">{title}{highlight && <Badge variant="outline" className="border-teal-600 text-teal-700 text-[10px]">For you</Badge>}</span>
    </AccordionTrigger>
    <AccordionContent className="text-sm text-slate-700 space-y-2 leading-relaxed">{children}</AccordionContent>
  </AccordionItem>
);

const GLOSSARY = [
  ["Pre-existing account", "An account already open on your jurisdiction's cut-off date (for many early adopters 31 December 2015). Pre-existing accounts are reviewed from the records you hold; new accounts need a self-certification at opening.", "CRS VIII(C)(9), HB ¶154–156"],
  ["Lower value / high value", "A pre-existing individual account of USD 1,000,000 or less is lower value; above that it is high value and needs the enhanced review: a paper record search where needed and the relationship manager inquiry.", "CRS III(B)–(C), HB ¶159, ¶170"],
  ["Indicia", "Signs of residence in another jurisdiction: (a) identified as resident, (b) address, (c) phone number with none in your jurisdiction, (d) standing instructions, (e) power of attorney or signatory, (f) hold-mail or in-care-of address only.", "CRS III(B)(2), HB ¶167"],
  ["Curing indicia", "Indicia can be set aside with a self-certification and/or documentary evidence showing the holder is resident elsewhere.", "CRS III(B)(6), HB ¶169"],
  ["Undocumented account", "A lower value account with only a hold-mail or in-care-of address where the paper search and outreach found nothing. It is reported as undocumented.", "CRS III(B)(5), HB ¶174"],
  ["Active / Passive NFE", "A non-financial entity is active if it meets one of the tests (for example less than 50% passive income, listed, governmental, holding company of an operating group). Otherwise it is passive, and its controlling persons are looked through.", "CRS VIII(D)(9), HB ¶196–197"],
  ["Controlling persons", "The natural persons who control an entity (25% ownership is indicative), or for a trust the settlor, trustees, protector, beneficiaries and anyone else in control.", "CRS VIII(D)(6), HB ¶144–151"],
  ["Change in circumstances", "Any change that adds information relevant to an account holder's status or conflicts with it. The self-certification or evidence can no longer be relied on; obtain a new one or a reasonable explanation by the later of 90 days or the end of the year.", "HB ¶165, ¶202, ¶220"],
  ["Reportable jurisdiction list", "The jurisdictions your tax authority exchanges information with for the year. Only residence in these jurisdictions makes an account reportable (unless the wider approach applies).", "CRS VIII(D)(4)"],
];

/** Plain-language help for the Classification Studio, with the parts that matter for the user's role. */
export default function StudioHelp({ user }) {
  const role = user?.app_role;
  const canConfirm = CONFIRM_ROLES.includes(role);
  const isSuper = role === "super_admin";
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] items-start">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">How the Classification Studio works</CardTitle>
          <CardDescription>
            The studio checks each account against the OECD Common Reporting Standard (CRS) and its Implementation Handbook, using the data you already hold. It asks only what the data can't answer, and keeps a permanent record of every decision. Manual classification on the Accounts page keeps working as before.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="multiple" defaultValue={["start"]}>
            <Section id="start" title="1. The queues">
              <p><strong>Ready to confirm:</strong> every CRS question is answered by the account data or by saved answers. Check the decision path, then confirm.</p>
              <p><strong>Needs input:</strong> the data can't answer at least one question. Only those questions are asked, one at a time; each answer can open the next step.</p>
              <p><strong>Changed:</strong> a confirmed account whose data or rules changed, and the automatic re-check gives a different result or new questions.</p>
              <p><strong>Classified:</strong> accounts with a confirmed decision.</p>
            </Section>
            <Section id="path" title="2. Reading the decision path">
              <p>Each step shows the CRS question, the answer, where the answer came from and the CRS and Handbook references:</p>
              <ul className="list-disc pl-5 space-y-0.5">
                <li><strong>From account data</strong>: a field on the account, controlling person or studio evidence.</li>
                <li><strong>Calculated</strong>: worked out by the rules, for example the balance band or the cut-off date test.</li>
                <li><strong>Reference data</strong>: the reportable jurisdiction list or the country table.</li>
                <li><strong>Your answer</strong> or <strong>AI suggestion · accepted</strong>: answers given in the studio.</li>
              </ul>
            </Section>
            <Section id="answer" title="3. Answering questions and saving">
              <p>Click an answer under a blue question. The studio re-runs at once, so you see the next question or the outcome. <strong>Save answers</strong> keeps them for your colleagues; anyone in your organisation who uses the studio can save answers.</p>
              <p>If the right answer is a fact the account should hold (a balance, a self-certification date, an entity classification), it is better to record it on the account. The question then disappears for good.</p>
              <p>Use <strong>Change</strong> next to an answered step to take an answer back.</p>
            </Section>
            <Section id="ai" title="4. AI suggestions">
              <p><strong>Suggest answers with AI</strong> looks only at the open questions and the account's CRS fields. Each suggestion shows how confident it is, why, and which fields it used. It can also say there isn't enough information.</p>
              <p>A suggestion is only used if you click <strong>Use this</strong>. The decision record shows which answers came from an accepted suggestion. AI suggestions can be switched off in Settings.</p>
            </Section>
            <Section id="confirm" title="5. Confirming decisions" highlight={canConfirm}>
              <p>Only <strong>tenant admins and supervisors</strong> can confirm. Confirming re-checks the rules on the server, saves a permanent decision record, and sets the account's reportability status and reason. The Accounts page and reports then show the result, and the account's Classification History shows a "Classification Studio" entry.</p>
              <p>In the Ready queue you can tick several accounts and use <strong>Confirm selected</strong> (up to 100 at a time). If your organisation uses a second sign-off, a different admin or supervisor signs off before the account changes.</p>
              <p>If the account data changed while you were reviewing, confirming is refused. Reload and check again.</p>
            </Section>
            <Section id="changed" title="6. Changes after confirmation" highlight={canConfirm}>
              <p>When a confirmed account's data, its controlling persons or the rules change, the studio re-checks it automatically. Fields that don't matter for CRS, such as an email address, are ignored.</p>
              <ul className="list-disc pl-5 space-y-0.5">
                <li><strong>Same result:</strong> the history shows "Checked, no change".</li>
                <li><strong>Different result or new questions:</strong> the account moves to <strong>Changed</strong> with a change case and a due date (the later of 90 days or the end of the year). Its status stays as it is until someone decides.</li>
              </ul>
              <p>An admin or supervisor either answers any open questions and chooses <strong>Confirm new result</strong>, or chooses <strong>Keep current decision</strong> and says why, for example after correcting a data error. Until the change is resolved, treat the holder as resident in both the old and the new jurisdictions.</p>
              <p>For trusts, use <strong>Record trust distribution</strong> when a member of a class of beneficiaries receives a payment.</p>
            </Section>
            <Section id="records" title="7. Decision records and exports">
              <p>Every decision is kept with its steps, evidence, references, answers, the rule and list versions it used, who decided and until when it must be kept. Open the history under the decision path, or the <strong>Decision records</strong> tab for a reporting year.</p>
              <p>Download a <strong>PDF</strong> for a single decision, or <strong>Export Excel</strong> for a year (decisions, steps, AI suggestions).</p>
            </Section>
            <Section id="settings" title="8. Settings">
              <p>The Settings tab holds the elections your jurisdiction and institution make: the pre-existing cut-off date, the residence address test, the USD 250,000 entity exemption, the wider approach, record retention, the reporting currency and exchange rates, second sign-off and AI suggestions. Tenant admins can change them. Every change is logged.</p>
            </Section>
            <Section id="faq" title="9. Questions people ask">
              <p><strong>Why does the studio differ from my manual result?</strong> The studio follows the Handbook steps strictly. Common reasons: an active non-financial entity resident in a reportable jurisdiction is itself reportable; a financial institution holder is not looked through; a pre-existing entity under USD 250,000 isn't reviewed when the exemption is elected; residence outside the reportable list (for example the United States) is not CRS-reportable. Open the account and read its decision path.</p>
              <p><strong>Does the studio change my manual classifications?</strong> Only when an admin or supervisor confirms a studio decision. Until then it only shows its result.</p>
              <p><strong>What if I edit an account?</strong> Nothing changes on the account. If the account has a confirmed studio decision, the studio re-checks it and, if needed, moves it to Changed.</p>
              <p><strong>Can I still classify manually?</strong> Yes. The Accounts page works as before.</p>
            </Section>
            {isSuper && (
              <Section id="super" title="For super admins: the CRS Rule Library" highlight>
                <p>The studio's rules live in the CRS Rule Library. Create a draft, change wording, thresholds, optional steps or add extra local questions, then run the Handbook reference cases and the impact report before publishing. Core Handbook steps are locked. Publishing changes no account or confirmed decision; confirmed accounts whose result changes are flagged in Changed by the nightly re-check. Roll back from the version list.</p>
                <p>Rolling out to another tenant: switch on "Classification Studio" in Tenant Management, open the studio for that tenant, set up and confirm its CRS settings, and check its reportable jurisdiction list in Reference data.</p>
              </Section>
            )}
          </Accordion>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">CRS terms</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {GLOSSARY.map(([term, text, ref]) => (
            <div key={term}>
              <p className="text-sm font-semibold text-slate-800">{term}</p>
              <p className="text-xs text-slate-600">{text}</p>
              <p className="text-[11px] font-mono text-slate-400">{ref}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
