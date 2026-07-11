/**
 * Transform questionnaire form responses into Retell Knowledge Base entries
 */

export interface Questionnaire {
  client_domain: string
  respondent_role?: string
  pain_point?: string
  service_types?: string
  avg_job_value?: string
  has_emergency_service?: boolean
  emergency_contact?: string
  response_time?: string
  common_objections?: string
  jargon?: string
  other_notes?: string
}

export interface KBEntry {
  title: string
  content: string
  metadata?: {
    category: string
    [key: string]: any
  }
}

/**
 * Convert questionnaire into KB entries for Retell agent
 */
export function questionnaireToKB(questionnaire: Questionnaire): KBEntry[] {
  const entries: KBEntry[] = []

  // ENTRY 1: Business Context
  if (questionnaire.pain_point || questionnaire.service_types || questionnaire.avg_job_value) {
    const businessContent = [
      questionnaire.service_types && `Services offered: ${questionnaire.service_types}`,
      questionnaire.avg_job_value && `Average job value: ${questionnaire.avg_job_value}`,
      questionnaire.pain_point && `Main pain point: ${questionnaire.pain_point}`,
      questionnaire.has_emergency_service && `24/7 emergency services: Available`,
    ]
      .filter(Boolean)
      .join('\n')

    if (businessContent) {
      entries.push({
        title: 'About This Business',
        content: businessContent,
        metadata: { category: 'business_context' },
      })
    }
  }

  // ENTRY 2: Services & Response Time
  if (questionnaire.response_time) {
    entries.push({
      title: 'How We Respond to Customers',
      content: `Response time: ${questionnaire.response_time}`,
      metadata: { category: 'operations' },
    })
  }

  // ENTRY 3: Emergency Handling
  if (questionnaire.has_emergency_service && questionnaire.emergency_contact) {
    entries.push({
      title: 'Emergency Call Routing',
      content: `Emergency contact: ${questionnaire.emergency_contact}\n\nWhen callers mention emergencies, prioritize connecting them quickly to ${questionnaire.emergency_contact.split(' ')[0]}.`,
      metadata: { category: 'operations' },
    })
  }

  // ENTRY 4: Handling Objections
  if (questionnaire.common_objections) {
    entries.push({
      title: 'Common Objections & How to Respond',
      content: `Common objections callers raise: ${questionnaire.common_objections}\n\nBe prepared to address these smoothly and proactively offer solutions.`,
      metadata: { category: 'sales' },
    })
  }

  // ENTRY 5: Language & Terminology
  if (questionnaire.jargon) {
    entries.push({
      title: 'Industry Jargon & Terminology',
      content: `Use this language to sound like an insider:\n${questionnaire.jargon}`,
      metadata: { category: 'language' },
    })
  }

  // ENTRY 6: General Notes
  if (questionnaire.other_notes) {
    entries.push({
      title: 'Additional Context',
      content: questionnaire.other_notes,
      metadata: { category: 'notes' },
    })
  }

  // Return at least a default entry if nothing else exists
  if (entries.length === 0) {
    entries.push({
      title: 'General Context',
      content: `This is a customer for ${questionnaire.client_domain}. Provide helpful, professional service.`,
      metadata: { category: 'default' },
    })
  }

  return entries
}

/**
 * Format KB entries for Retell API
 */
export function formatForRetellAPI(kbEntries: KBEntry[]) {
  return {
    documents: kbEntries.map(entry => ({
      title: entry.title,
      content: entry.content,
      metadata: entry.metadata || {},
    })),
  }
}
