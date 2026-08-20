import { VerticalIntakePage } from '@/components/verticals/VerticalIntakePage'

export const metadata = {
  title: 'AI Receptionist for Equipment Rental Yards | 369 Agentic Systems',
  description: 'Never lose another rental to a missed call. AI receptionist for skid steers, trailers and small plant — 24/7 call answering, per-machine availability, and multi-day booking.',
}

export default function EquipmentRentalPage() {
  return <VerticalIntakePage vertical="equipment-rental" demoPhone="(817) 635-0220" />
}
