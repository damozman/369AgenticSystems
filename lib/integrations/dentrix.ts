/**
 * Dentrix Public API integration (Henry Schein One)
 * Docs:    https://papidocs.hs1api.com/publicapi/home
 * Base:    https://hs1api.com/v1  (confirm from credentials email)
 *
 * ENV VARS — add to Vercel when sandbox credentials arrive:
 *   DENTRIX_API_URL  — e.g. https://hs1api.com/v1
 *   DENTRIX_API_KEY  — Bearer token from credentials email
 *
 * Without credentials every function returns null/empty — email-ingest
 * falls back to system_audits context automatically.
 *
 * Endpoint map (from API docs):
 *   GET /patients?email={email}              → find patient by email
 *   GET /patients/{id}/appointments          → appointment schedule
 *   GET /patients/{id}/treatmentplan         → treatment plan (singular)
 *   GET /patients/{id}/communications        → past messages (optional)
 */

const BASE_URL = process.env.DENTRIX_API_URL ?? ''
const API_KEY  = process.env.DENTRIX_API_KEY  ?? ''

function authHeaders() {
  return {
    'Authorization': `Bearer ${API_KEY}`,
    'Content-Type':  'application/json',
    'Accept':        'application/json',
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DentrixPatient {
  id:                 string        // API returns 'id', not 'patientId'
  name:               string        // API returns full name as single field
  email:              string
  phone:              string | null
  dateOfBirth:        string | null
  lastVisitDate:      string | null
  insurance:          string | null
  allergies:          string | null
  outstandingBalance: number | null
}

export interface DentrixAppointment {
  id:       string
  dateTime: string
  type:     string
  provider: string | null
  status:   string | null
}

export interface DentrixTreatment {
  id:          string
  name:        string
  isCompleted: boolean
  fee:         number | null
}

export interface DentrixContext {
  patient:              DentrixPatient | null
  upcomingAppointments: DentrixAppointment[]
  treatmentPlan:        DentrixTreatment[]
}

// ── API helpers ───────────────────────────────────────────────────────────────

async function apiGet<T>(path: string): Promise<T | null> {
  if (!BASE_URL || !API_KEY) return null
  try {
    const res = await fetch(`${BASE_URL}${path}`, { headers: authHeaders() })
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

// ── Individual lookups ────────────────────────────────────────────────────────

export async function lookupPatientByEmail(email: string): Promise<DentrixPatient | null> {
  // Response is a root array: [patient, ...]
  const data = await apiGet<DentrixPatient[]>(`/patients?email=${encodeURIComponent(email)}`)
  return data?.[0] ?? null
}

export async function getAppointments(patientId: string): Promise<DentrixAppointment[]> {
  const data = await apiGet<DentrixAppointment[]>(`/patients/${patientId}/appointments`)
  return data ?? []
}

export async function getTreatmentPlan(patientId: string): Promise<DentrixTreatment[]> {
  // Endpoint is /treatmentplan (singular) per API docs
  const data = await apiGet<DentrixTreatment[]>(`/patients/${patientId}/treatmentplan`)
  return data ?? []
}

// ── Main context builder ───────────────────────────────────────────────────────

export async function getDentrixContext(email: string): Promise<DentrixContext> {
  const patient = await lookupPatientByEmail(email)

  if (!patient) {
    return { patient: null, upcomingAppointments: [], treatmentPlan: [] }
  }

  const [appointments, treatmentPlan] = await Promise.all([
    getAppointments(patient.id),
    getTreatmentPlan(patient.id),
  ])

  const upcoming = appointments
    .filter(a => a.status !== 'completed' && new Date(a.dateTime) > new Date())
    .sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime())

  return { patient, upcomingAppointments: upcoming, treatmentPlan }
}

// ── Format for Claude prompt ───────────────────────────────────────────────────

export function formatDentrixContext(ctx: DentrixContext): string {
  if (!ctx.patient) return ''

  const p = ctx.patient
  const lines: string[] = [
    `PATIENT RECORD (Dentrix):`,
    `- Name: ${p.name}`,
    `- Last Visit: ${p.lastVisitDate ?? 'No record'}`,
    `- Insurance: ${p.insurance ?? 'Unknown'}`,
    `- Allergies: ${p.allergies ?? 'None on file'}`,
    `- Outstanding Balance: ${p.outstandingBalance != null ? `$${p.outstandingBalance.toFixed(2)}` : 'Unknown'}`,
  ]

  if (ctx.upcomingAppointments.length > 0) {
    const next = ctx.upcomingAppointments[0]
    lines.push(`- Next Appointment: ${next.dateTime} — ${next.type}`)
  } else {
    lines.push(`- Next Appointment: None scheduled`)
  }

  const pending = ctx.treatmentPlan.filter(t => !t.isCompleted)
  if (pending.length > 0) {
    lines.push(`- Pending Treatments: ${pending.map(t => t.name).join(', ')}`)
  }

  return lines.join('\n')
}
