import { NextResponse } from 'next/server'

// Called by Retell mid-call as a Function/Tool — no auth needed (returns only public date data)

function ordinal(n: number): string {
  const v = n % 100
  if (v >= 11 && v <= 13) return `${n}th`
  switch (n % 10) {
    case 1: return `${n}st`
    case 2: return `${n}nd`
    case 3: return `${n}rd`
    default: return `${n}th`
  }
}

function getDayOfWeekCT(date: Date): number {
  // Parse CT wall-clock time so getDay() returns the correct CT weekday
  return new Date(date.toLocaleString('en-US', { timeZone: 'America/Chicago' })).getDay()
}

function formatSlot(date: Date, time: string): string {
  const opts = { timeZone: 'America/Chicago' } as const
  const weekday    = new Intl.DateTimeFormat('en-US', { ...opts, weekday: 'long'   }).format(date)
  const month      = new Intl.DateTimeFormat('en-US', { ...opts, month:   'long'   }).format(date)
  const dayOfMonth = parseInt(
    new Intl.DateTimeFormat('en-US', { ...opts, day: 'numeric' }).format(date)
  )
  const year = new Intl.DateTimeFormat('en-US', { ...opts, year: 'numeric' }).format(date)
  // Year is included deliberately — without it, the LLM has no grounding for
  // the current year anywhere in the conversation and has to guess when it
  // later constructs book_appointment's appointment_date argument. Confirmed
  // on a real booking: it guessed 2025 instead of the real year, 2026.
  return `${weekday}, ${month} ${ordinal(dayOfMonth)}, ${year} at ${time}`
}

export async function GET() {
  const TIMES = ['10:00 AM', '2:00 PM']
  const slots: string[] = []

  const cursor = new Date()
  cursor.setDate(cursor.getDate() + 1) // always start from tomorrow

  while (slots.length < 4) {
    const dow = getDayOfWeekCT(cursor) // 0 = Sun, 6 = Sat
    if (dow >= 1 && dow <= 5) {        // Mon–Fri only
      for (const time of TIMES) {
        if (slots.length < 4) slots.push(formatSlot(cursor, time))
      }
    }
    cursor.setDate(cursor.getDate() + 1)
  }

  // suggested = first morning slot of day 1 + first morning slot of day 2
  return NextResponse.json({
    slots,
    suggested: `${slots[0]} or ${slots[2]}`,
  })
}
