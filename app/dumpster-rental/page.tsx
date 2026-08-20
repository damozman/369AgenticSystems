import { VerticalIntakePage } from '@/components/verticals/VerticalIntakePage'

export const metadata = {
  title: 'AI Receptionist for Dumpster & Portable Restroom Rental | 369 Agentic Systems',
  description: 'Never lose another hire to a missed call. AI receptionist for roll-off dumpster and portable restroom yards — 24/7 call answering, multi-day hire booking, and follow-up.',
}

export default function DumpsterRentalPage() {
  return <VerticalIntakePage vertical="dumpster-rental" demoPhone="(817) 635-0220" />
}
