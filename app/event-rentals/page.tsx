import { VerticalIntakePage } from '@/components/verticals/VerticalIntakePage'

export const metadata = {
  title: 'AI Receptionist for Party & Event Rental Companies | 369 Agentic Systems',
  description: 'Never lose another booking to a missed call. AI receptionist for bounce house, mobile casino, DJ and party bus rentals — 24/7 availability answering, per-item booking, and follow-up.',
}

export default function EventRentalsPage() {
  return <VerticalIntakePage vertical="event-rentals" demoPhone="(817) 635-0220" />
}
