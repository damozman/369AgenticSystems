import { VerticalIntakePage } from '@/components/verticals/VerticalIntakePage'

export const metadata = {
  title: 'AI Receptionist for Equipment & Heavy Machinery Rental | 369 Agentic Systems',
  description: 'Never lose another rental to a missed call. AI receptionist for equipment and heavy machinery yards — excavators, boom and scissor lifts, telehandlers, skid steers, compaction, generators, trailers and attachments. 24/7 call answering, per-machine availability, and multi-day booking.',
}

export default function EquipmentRentalPage() {
  return <VerticalIntakePage vertical="equipment-rental" demoPhone="(817) 635-0220" />
}
