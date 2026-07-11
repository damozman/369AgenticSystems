# Later-Phase Possibilities
**Not commitments, not a roadmap — a place to park ideas that came up in past sessions so they don't get lost or re-litigated from scratch. Review and prioritize when there's bandwidth past current launch work.**

---

## The one that actually matters most: per-client provisioning automation

Every paying client is set up manually today — there's no automation connecting a Stripe payment to a real per-client Retell agent, phone number, and dashboard config. This has been flagged repeatedly (truthfulness audits, launch checklists) as the biggest gap between "what the marketing implies" and "what happens operationally." Worth being the first thing pulled off this list once there's revenue to justify the build time — manual setup doesn't scale past a handful of clients.

---

## Product expansion ladder (upsell the same client, one add-on at a time)

From the original AI-receptionist sales playbook (`../sales-ops/AI-Receptionist-Blueprint.md`) — the idea was to land clients on the base receptionist, then expand:

| Add-on | Rough monthly add | What it'd need |
|---|---|---|
| Booking / scheduling (real, not just confirmation) | +$150–$300 | Actual calendar-write integration, not just a confirmation email |
| Missed-lead follow-up & reactivation | +$200–$400 | Re-engagement sequence for leads that went cold, not just new captures |
| Review requests after each job | +$100–$200 | Post-job trigger + review-platform integration |
| Intake / quoting automation | +$200–$400 | Real pricing logic — explicitly avoided so far to prevent the agent inventing numbers |

None of this is built. It's a pricing-ladder concept, not a spec.

---

## Integration ideas by trigger point

| Integration | Purpose | Trigger |
|---|---|---|
| Gumloop → vertical intake pipe | Pipe prospect domain into Gumloop for a site audit, enrich the pre-call brief | Post-form submission |
| Twilio SMS | Storm alert texts, SMS estimating links, follow-up sequences | Specialist 2 — original Month 2 idea |
| Tomorrow.io | Hail/storm detection by zip → auto-alert nearby roofing clients | Specialist 2 — original Month 2 idea |
| Cal.com → Claude pre-call research | Auto-research a prospect before a call, add to the pre-call brief | `book-demo` webhook |
| Per-client Retell number | Each paying client gets a dedicated Retell number instead of the shared demo line | First real client onboarded — this is the provisioning gap above |
| PDF report generation | Convert the ROI report to a downloadable PDF | Low priority, cosmetic |
| Call-reasons dashboard card | Group `issue_description` by category, show top 3 | Needs real call volume first — 50+ calls before this is meaningful |

---

## Dental practice management integration (Dentrix)

Full research already done — see `DENTRIX-INTEGRATION-GUIDE.md` in this folder for the actual API options, sandbox access paths, and what data it would expose (patient history, appointment schedule, treatment plans, insurance info).

**Status:** Dental is waitlist-only, zero agents built for it. This integration is a prerequisite for a real dental product, not a nice-to-have — patient-record context is what would make a dental receptionist actually useful versus just another vertical skin on Ava. Don't start building this until dental moves off the waitlist.

---

## Things that were floated once and are probably not worth reviving

Keeping a short "no" list here too, so these don't get re-proposed cold in a future session without the context of why they were dropped:

- **Flowise as the agent orchestration layer** — early plan, never built. Real system calls Claude directly from Vercel functions instead (see `lib/rex-sequences.ts`, `lib/nova-templates.ts` for the pattern). No reason to revisit unless a genuinely multi-step agent workflow shows up that direct API calls can't handle cleanly.
- **Automated remediation via "Authorize Agent Patch"** — explicitly decided against (2026-07-07). Chris doesn't want 369 taking automated action on a prospect's live infrastructure sight-unseen. This is a deliberate no, not an open question.
- **Gemini-based "CEO Agent" / "Hermes" orchestration layer** — an early conceptual org-chart for splitting strategy/coding/cloud-ops across different models. Never matched what actually got built (Claude Code + direct Vercel functions). Fine as a historical idea, not worth resurrecting as-is.
