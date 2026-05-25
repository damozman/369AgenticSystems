/**
 * Dentrix Public API integration (Henry Schein One)
 * Docs: https://papidocs.hs1api.com/publicapi/home
 *
 * ENV VARS (add to Vercel when credentials arrive):
 *   DENTRIX_API_URL  — base URL from sandbox credentials email
 *   DENTRIX_API_KEY  — API key from sandbox credentials email
 *
 * Until credentials arrive, every function returns null/empty gracefully.
 * The email-ingest route falls back to prospect context from system_audits.
 */

const BASE_URL = process.env.DENTRIX_API_URL ?? ''
const API_KEY  = process.env.DENTRIX_API_KEY  ?? ''

function headers() {
  return {
    'Authorization': `Bearer ${API_KEY}`,
    'Content-Type':  'application/json',
    'Accept':        'application/json',
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DentrixPatient {
  patientId:          string
  firstName:          string
  lastName:           string
  email:              string
  phone:              string | null
  dateOfBirth:        string | null
  lastVisitDate:      string | null
  insuranceProvider:  string | null
  outstandingBalance: number | null
}

export interface DentrixAppointment {
  appointmentId: string
  date:          string
  type:          string
  provider:      string | null
  status:        string | null
}

export interface DentrixTreatmentPlan {
  planId:       string
  description:  string
  status:       string | null
  totalFee:     number | null
}

export interface DentrixContext {
  patient:             DentrixPatient | null
  upcomingAppointments: DentrixAppointment[]
  recentTreatments:    DentrixTreatmentPlan[]
}

// ── API calls (stubbed — fill in endpoint paths when docs arrive) ──────────────

async function get<T>(path: string): Promise<T | null> {
  if (!BASE_URL || !API_KEY) return null
  try {
    const res = await fetch(`${BASE_URL}${path}`, { headers: headers() })
    if (!res.ok) {
      console.warn(`[DENTRIX] ${res.status} on GET ${path}`)
      return null
    }
    return res.json() as Promise<T>
  } catch (err) {
    console.warn(`[DENTRIX] Network error on GET ${path}:`, err)
    return null
  }
}

export async function lookupPatientByEmail(email: string): Promise<DentrixPatient | null> {
  // TODO: confirm exact endpoint + query param from API docs
  // Expected: GET /patients?email={email}  OR  /patients/search?email={email}
  const data = await get<{ patients: DentrixPatient[] }>(
    `/patients?email=${encodeURIComponent(email)}`
  )
  return data?.patients?.[0] ?? null
}

export async function getUpcomingAppointments(patientId: string): Promise<DentrixAppointment[]> {
  // TODO: confirm endpoint — likely GET /patients/{id}/appointments?status=scheduled
  const data = await get<{ appointments: DentrixAppointment[] }>(
    `/patients/${patientId}/appointments?status=scheduled`
  )
  return data?.appointments ?? []
}

export async function getActiveTreatmentPlans(patientId: string): Promise<DentrixTreatmentPlan[]> {
  // TODO: confirm endpoint — likely GET /patients/{id}/treatmentplans?status=active
  const data = await get<{ treatmentPlans: DentrixTreatmentPlan[] }>(
    `/patients/${patientId}/treatmentplans?status=active`
  )
  return data?.treatmentPlans ?? []
}

// ── Main context builder ───────────────────────────────────────────────────────

export async function getDentrixContext(email: string): Promise<DentrixContext> {
  const patient = await lookupPatientByEmail(email)

  if (!patient) {
    return { patient: null, upcomingAppointments: [], recentTreatments: [] }
  }

  const [upcomingAppointments, recentTreatments] = await Promise.all([
    getUpcomingAppointments(patient.patientId),
    getActiveTreatmentPlans(patient.patientId),
  ])

  return { patient, upcomingAppointments, recentTreatments }
}

// ── Format for Claude prompt ───────────────────────────────────────────────────

export function formatDentrixContext(ctx: DentrixContext): string {
  if (!ctx.patient) return ''

  const p = ctx.patient
  const lines: string[] = [
    `PATIENT RECORD (Dentrix):`,
    `- Name: ${p.firstName} ${p.lastName}`,
    `- Last Visit: ${p.lastVisitDate ?? 'No record found'}`,
    `- Insurance: ${p.insuranceProvider ?? 'Unknown'}`,
    `- Outstanding Balance: ${p.outstandingBalance != null ? `$${p.outstandingBalance.toFixed(2)}` : 'Unknown'}`,
  ]

  if (ctx.upcomingAppointments.length > 0) {
    const next = ctx.upcomingAppointments[0]
    lines.push(`- Next Appointment: ${next.date} (${next.type})`)
  } else {
    lines.push(`- Next Appointment: None scheduled`)
  }

  if (ctx.recentTreatments.length > 0) {
    lines.push(`- Active Treatment Plans: ${ctx.recentTreatments.map(t => t.description).join(', ')}`)
  }

  return lines.join('\n')
}
