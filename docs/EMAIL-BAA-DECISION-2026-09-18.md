# Email, BAAs, and the PHI Chain — Decision Doc for the Lawyer Meeting

Written 2026-09-18 by Cowork Claude (Opus). Research only; nothing built, no code touched.
Supersedes the vendor table in Report 5 of `docs/pre-stripe-status-2026-09-18.md` where the two disagree.

**This is not legal advice.** Every vendor claim below was fetched from that vendor's own pages on 2026-09-18. Where a page does not state something, it is marked "not stated" rather than filled in from a blog.

---

## 0. Read this first: Resend says both things, and they are consistent

**Corrected 2026-09-18 after Claude Code checked my work. My first version of this section was wrong; the error and the correction are both kept here on purpose.**

Report 5 quotes `resend.com/security` as stating *"Resend is not HIPAA compliant and cannot sign a Business Associate Agreement."*

I first reported that I could not find that sentence. **The sentence is there.** It sits in the page's FAQ, which is collapsed by default and rendered from the page's JSON-LD `FAQPage` data, so a fetch that reads only visible text returns the question without the answer. Claude Code checked the raw HTML and found it under "Is Resend HIPAA and ISO 27001 compliant?": *"Resend is not HIPAA compliant and cannot sign a Business Associate Agreement. Resend holds SOC 2 Type II, not an ISO 27001 certificate."*

What is also true, and is what I did see: the same page carries a compliance badge reading **"HIPAA — In progress,"** and `resend.com/enterprise` shows that badge and nothing more.

**The two statements do not conflict.** Read together they say: no BAA today, HIPAA somewhere on the roadmap. Report 5's quote stands exactly as written.

**What this means for the decision:** unchanged. Dental cannot be served through Resend today. The only thing the "In progress" badge adds is that **"when?" is a question worth asking**, rather than a closed door — and a badge is not a commitment, a date, or a plan tier. Recommend emailing Resend and getting three answers in writing: (1) is a BAA available today; (2) if not, is there a target date; (3) will it require Enterprise, at what cost.

**Two process lessons, both worth more than the finding:**

1. **A rendered-text fetch is not a read of the page.** Collapsed FAQs, accordions and JSON-LD structured data are invisible to it. For a claim this load-bearing, check the raw HTML. I did not, and I stated a negative — "the sentence is absent" — on the strength of a tool that cannot establish absence.
2. **The cross-check worked.** Two sessions read the same page the same day, disagreed, and the disagreement surfaced because the second one went to source. That is the "re-derive, never inherit" rule doing its job — on Cowork's output, not just on old docs. Nothing in Report 5 or in this doc should be treated as settled without a re-fetch.

---

## 1. The migration surface — what moving off Resend actually costs in code

Read-only scan of the repo, 2026-09-18.

| Fact | Count |
|---|---|
| Files constructing a Resend client (`new Resend(...)`) | **19**, across 15 route files and 4 libs |
| Distinct send call sites (`resend.emails.send(...)`) | **27** |
| Central send wrapper | **none** — only `lib/email-from.ts`, which builds the `From` header |
| Inbound webhook tied to Resend | `app/api/resend-webhook/route.ts` |
| Dependency | `resend@^6.12.3` |

**The shape of the problem:** there is no seam. Every route instantiates its own client and calls `emails.send` directly, so a provider swap touches 19 files rather than one. The good news is it is mechanical, not architectural — and the right first move is to introduce the seam that should have been there anyway: a single `lib/email/send.ts` that every caller goes through. That refactor is worth doing whether or not the provider ever changes, and it makes the provider question a one-line decision afterwards.

**Not everything has to move.** What matters is not who receives an email but whether its body carries identifying detail:

- **Carries caller/patient detail — must move:** `nova-templates.ts` (booking confirmations), `rex-sequences.ts` and `email-sequences.ts` (follow-ups), `intake/route.ts` (both the lead email and the owner alert), `send-response/route.ts`, `dossier/approve`, `felix/conflict-check`, `precall-brief`, `silence-check`, `weekly-digest`, `lead-engine/notify.ts`, `send-roi-report`.
- **Pure ops, no third-party detail — can stay:** `webhook-audit`, `usage-bill`, `stripe-webhook`, `early-access`, `dossier-nudge`.

Note that `precall-brief` and `felix/conflict-check` send to Chris's own address and still carry caller detail. Sending PHI to yourself through a non-BAA vendor is still sending PHI through a non-BAA vendor. Recipient is not the test.

**A dual-provider setup is therefore viable:** PHI-bearing mail through a BAA provider, ops alerts wherever. Whether that is worth the operational split is a judgment call — it saves migration effort now and costs clarity later.

---

## 2. Email providers that WILL sign a BAA

| Provider | BAA? | Plan / cost per the vendor's own page | Notes |
|---|---|---|---|
| **Paubox Email API** | **Yes** — *"A business associate agreement (BAA) comes with every plan, including the free tier."* | *"Send 300 emails per month for free, BAA included. Paid plans scale from there to millions of messages."* **Paid tier dollar amounts are not readable on their pricing page** (rendered as placeholders) — must be quoted by sales. | REST API **and** drop-in SMTP relay; official **Node.js SDK**; TLS 1.2+ by default; HITRUST certified. Purpose-built for healthcare. |
| **Amazon SES** | **Yes** — HIPAA Eligible Service since July 2019, under an AWS BAA. *"If you have a HIPAA Business Associate Addendum (BAA) in place with AWS, you can now start using Amazon SES for your HIPAA eligible workloads."* | **À la carte: $0.10 per 1,000 emails.** Essentials plan $0.16/1,000 up to 10M/mo. | Cheapest by a wide margin. Requires an AWS account and the AWS BAA. More setup: domain/DKIM, sandbox exit, bounce handling, reputation management — things Resend does for you. |
| **Mailgun** | **Yes** — publishes a HIPAA Business Associate Addendum at `mailgun.com/legal/hipaa-baa/`. | **Not stated** on the addendum page. | **Read the carve-out before relying on it.** The addendum itself says email *"may be unsecured, may be intercepted... and may be stored and disclosed by third parties,"* that content *"will be transmitted even if the recipient does not also support TLS, resulting in an unencrypted transmission,"* and that *"You are responsible for encrypting any sensitive data."* A BAA that disclaims transport security is a different product from Paubox's. |
| **LuxSci** | **Yes** — lists *"HIPAA-Compliant BAA"* and *"HIPAA-Compliant Email Send (ePHI)"* with REST API and SMTP relay access. | **Not stated** — *"Talk to an Expert about your volume, compliance, and integration requirements."* | Enterprise-shaped; built for high volume (20k–1M+/hour), dedicated IP. Likely overspecified for your volume. |

## 3. Email providers that will NOT — including one you might have reached for

| Provider | Position, in their own words |
|---|---|
| **Postmark** | *"Postmark is not HIPAA-compliant so we do not recommend using our platform if you need to send HIPAA-compliant emails. We also cannot sign any Business Associate Agreements around HIPAA."* |
| **SendGrid (Twilio)** | *"SendGrid does not natively support HIPAA compliant data transmission and is not a HIPAA Eligible Service."* And: *"Twilio is not able to sign Business Associate Agreements for SendGrid, therefore, customers should not use SendGrid for any purpose or in any manner involving Protected Health Information."* |
| **Resend** | No BAA today; HIPAA listed as "In progress." See section 0. |

Worth noting that the two obvious "just switch to X" answers — Postmark and SendGrid — are both flat no. The viable set is smaller than it looks.

---

## 4. The rest of the chain, now resolved

Report 5 left four vendors unresearched. All four are now answered.

| Vendor | Role in the chain | BAA? | The catch |
|---|---|---|---|
| **Anthropic** (Nova, Felix, email-ingest) | Reads caller data to draft | **Yes** — *"Anthropic provides a BAA covering our HIPAA-ready services, such as use of our first-party API or Enterprise plans."* | Significant conditions. The Primary Owner signs, then sales must **turn it on**. *"The BAA only covers the single organization that accepted it."* **Covered Models require 30-day data retention and are not available with zero data retention.** Batch API, Files API, Code Execution and Web Fetch are *"Not covered under Anthropic BAA and not accessible for HIPAA-Ready API users."* Cost not stated. |
| **Google Calendar** (booking events with patient names) | Writes events | **Yes**, via Google Workspace — *"customers... must enter a Business Associate Amendment (BAA) with Google."* Accepted electronically in the Admin console under **Account settings → Legal and compliance**. | Calendar is **not named** on the page I fetched; coverage is defined by Google's separate "HIPAA Included Functionality" list, which must be checked directly. Edition requirement not stated. |
| **Twilio** (SMS, currently unconfigured) | Would carry appointment detail | **Yes** — Programmable SMS, Programmable Voice and Elastic SIP Trunking have been HIPAA eligible since March 2020. | **Requires Security Edition or Enterprise Edition**: *"Customers wishing to sign a BAA with Twilio must have our Security Edition or Enterprise Edition."* That is a real cost step above a standard account. Separately, A2P 10DLC registration still takes days to weeks. |
| **Retell's model provider** | Runs the conversation | **Unknown — and Retell will not say publicly.** | Retell's compliance page states a BAA is required before transmitting PHI and is self-signed at no fee, but explicitly refers subprocessor questions to support: *"For compliance questions not covered above — including custom security reviews, vendor assessments, or subprocessor lists — contact us at support@retellai.com."* **Ask them for the subprocessor list in writing.** Your fleet runs `gemini-3.5-flash`; whether Retell's BAA flows through to Google is not publicly documented. |

**Carried forward from Report 5, unverified by me today:** Supabase signs (Team plan + paid HIPAA add-on, third-party sourced and unconfirmed — get a quote), Vercel signs (Pro required; you are on Hobby). Both should be re-fetched before anyone relies on them, for the reason section 0 demonstrates.

---

## 5. The three paths, with numbers attached

**Path A — Wait for Resend.**
Cost: nothing. Effort: nothing. Risk: entirely dependent on an unpublished timeline you do not yet have. Viable only if Resend gives a date in writing. Ask before dismissing it; "in progress" is worth one email.

**Path B — Move PHI-bearing email to Paubox, keep everything else.**
Cost: free up to 300/month, paid tiers unquoted. Effort: build the `lib/email/send.ts` seam, then port ~12 PHI-bearing call sites. Node SDK and SMTP relay both available, so the port is mechanical. Paubox is the only candidate that is purpose-built for this and includes the BAA at every tier with no plan escalation. **This is the path I would scope first.**

**Path C — Move everything to Amazon SES.**
Cost: ~$0.10 per 1,000 emails — effectively free at your volume. Effort: highest. You inherit deliverability, DKIM, sandbox exit, bounce and reputation management, all of which Resend currently handles. Attractive if you are already committing to AWS for other reasons; otherwise you are trading a real monthly bill for real ongoing operational work.

**Not a path: Mailgun on price alone.** Its own addendum disclaims transport encryption and puts the encryption burden on you. Ask the lawyer whether that BAA is worth what it appears to be worth.

**The fourth option, which is not a technical one:** do not sell dental as HIPAA-covered, say so plainly in the copy and the contract, and let the practice decide. That remains on the table and costs nothing to build — but it needs the lawyer's read on whether it is defensible when your client is a covered entity and your system is handling their patients' appointment data either way.

---

## 6. Revised questions for the lawyer

Sharper than the first list, now that costs are attached.

1. Does a booking confirmation carrying a patient name and appointment time constitute PHI when sent on behalf of a dental practice? **This is the hinge.** If yes, Paubox or SES; if there is a narrower reading, "strip identifying detail" becomes real and cheap.
2. Is there a conduit exception covering email transport here, or does it not reach a business associate in our position?
3. Which links in the chain — Retell, Supabase, Vercel, Anthropic, the email provider, Google Calendar — each need their own BAA?
4. **Anthropic's BAA requires 30-day data retention and forbids zero-data-retention.** Does accepting that create any obligation or exposure we should weigh?
5. **Mailgun's BAA explicitly disclaims transport encryption and shifts encryption responsibility to us.** Is such a BAA sufficient, or is it a BAA in name only?
6. Can we serve dental *without* holding out as HIPAA-covered, and what disclosure would that require given the client is a covered entity?
7. What must change in `docs/sales-ops/msa-sow-template.md` before it is ever sent? Specifically §6 (accessing the client's Dentrix system), §7 (accepting Business Associate status and offering a BAA on request), and the SOW's Dentrix scope items — against an integration that has never had credentials configured.
8. Does holding that template, unsigned and unsent, create exposure on its own?

---

## 7. What I could not verify, stated plainly

- Paubox paid-tier pricing — their pricing page renders placeholders; sales must quote it.
- LuxSci and Mailgun pricing — not stated publicly.
- Anthropic BAA cost and eligibility threshold — "contact Sales."
- Whether Google Calendar specifically sits on Google's HIPAA Included Functionality list.
- Which LLM provider Retell routes to, and whether its BAA covers that hop.
- Supabase and Vercel — carried forward from Report 5, not re-fetched by me.
- **Whether Resend's "In progress" has a date behind it.** The single highest-value unknown on this page.

---

## 8. Recommended order

1. **Email Resend and Retell.** Two questions, both free, both blocking. Resend: is a BAA coming, when, and on what plan. Retell: the subprocessor list and whether their BAA covers the model hop.
2. **Get a Paubox quote** for realistic monthly volume — use the minutes figure from the Retell usage run as a proxy for call-driven email volume.
3. **Then the lawyer**, with sections 5 and 6 in hand.
4. **Only then** scope the `lib/email/send.ts` seam. It is worth building regardless, but it should not be built against a provider nobody has chosen yet.

Nothing here is a build instruction. No code was changed and no vendor was contacted.
