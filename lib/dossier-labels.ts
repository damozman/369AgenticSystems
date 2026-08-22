/**
 * What each bottleneck checkbox actually SAID on the page the prospect filled in.
 *
 * `pain_points` stores keys — `afterhours`, `doublebook` — because a key is stable and a
 * sentence is not. The dossier has to print the sentence, and it has to be the same sentence they
 * read, in the same words. Reflecting someone's own answer back at them in different language is
 * the fastest way to make a report feel generated.
 *
 * **Generated from the pages, which are the source of truth**, and guarded by
 * `lib/dossier-labels.test.ts`, which re-reads every form at test time and fails on any drift.
 * Editing a checkbox label on a page without regenerating this map is exactly the two-writers
 * problem that keeps costing this project real data.
 *
 * Regenerate: node scripts/generate-dossier-labels.mjs
 */

export type PainLabels = Record<string, Record<string, string>>

export const PAIN_LABELS: PainLabels = {
  'dumpster-rental': {
    driving: "Calls come in while drivers are on route",
    afterhours: "Hire calls after hours & weekends",
    yard: "No reliable view of what is on the yard",
    dates: "Hire periods tracked by hand",
  },
  'equipment-rental': {
    counter: "Phone rings while the counter is busy",
    earlylate: "Calls before we open and after we close",
    fleet: "No reliable view of which machines are free",
    dates: "Rental periods tracked by hand",
  },
  'event-rentals': {
    afterhours: "Availability calls on evenings & weekends",
    onsite: "Phone rings while we are setting up or delivering",
    memory: "No reliable way to check what is free",
    doublebook: "Same unit promised to two customers",
  },
  'hvac': {
    afterhours: "Missed calls after hours & weekends",
    seasonal: "Seasonal volume overwhelming the office",
    followup: "No follow-up on estimates & quotes",
    dispatch: "Emergency dispatch slow or manual",
  },
  'insurance': {
    afterhours: "Missed calls after hours & weekends",
    peakhours: "Calls roll to voicemail during peak hours",
    leads: "New quote lead qualification",
    admin: "General admin overload",
  },
  'legal': {
    leads: "Missed or slow lead follow-up",
    afterhours: "Missed calls after hours & weekends",
    conflicts: "No conflict-check before consultations",
    scheduling: "Scheduling and coordination",
    admin: "General admin overload",
  },
  'plumbing': {
    afterhours: "Missed calls after hours & weekends",
    dispatch: "Emergency dispatch slow or manual",
    followup: "No follow-up on estimates & quotes",
    overflow: "Call overflow during busy periods",
  },
  'real-estate': {
    speed: "Slow response to portal leads",
    afterhours: "Missed calls after hours & weekends",
    showings: "Showing scheduling chaos",
    followup: "Follow-up sequences that die",
    team: "No dedicated agent to field inbound calls",
  },
  'roofing': {
    speed: "Slow storm lead response",
    afterhours: "Missed calls after hours & weekends",
    tracking: "No record of missed calls to follow up on",
    voicemail: "Callers hit voicemail, call a competitor instead",
    pipeline: "Lead pipeline & follow-up system",
  },
  'saas': {
    afterhours: "Missed calls after hours & weekends",
    slow: "Demo requests answered too slowly",
    team: "No dedicated SDR to field inbound calls",
    followup: "No follow-up on trial signups & inquiries",
  },
  'unlisted': {
    afterhours: "Missed calls after hours & weekends",
    busy: "Calls come in while we are working",
    voicemail: "Callers hit voicemail and ring a competitor",
    tracking: "No record of who called and did not connect",
    followup: "Follow-up that never happens",
  },
  'wholesale': {
    afterhours: "Order calls after hours & weekends",
    busy: "Sales team buried in existing calls",
    voicemail: "Callers hit voicemail, call a competitor instead",
    tracking: "No record of missed calls to follow up on",
  },
}

/**
 * The label for one checked key, or null.
 *
 * Null when the key is unknown — a page edited after a submission, or a key from a vertical this
 * prospect does not belong to. The dossier omits what it cannot name rather than printing a raw
 * key like "doublebook" at someone.
 */
export function painLabel(vertical: string, key: string): string | null {
  return PAIN_LABELS[vertical]?.[key] ?? PAIN_LABELS.unlisted?.[key] ?? null
}
