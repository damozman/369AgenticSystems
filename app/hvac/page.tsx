import { VerticalIntakePage } from '@/components/verticals/VerticalIntakePage'

export const metadata = {
  title: 'AI Receptionist for HVAC Companies | 369 Agentic Systems',
  description: 'Emergency calls answered 24/7. AI receptionist for HVAC companies — after-hours lead capture, booking, and follow-up.',
}

export default function HVACPage() {
  return <VerticalIntakePage vertical="hvac" demoPhone="(817) 635-0220" />
}
