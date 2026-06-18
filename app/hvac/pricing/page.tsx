import { Suspense } from 'react'
import { VerticalPricing } from '@/components/verticals/VerticalPricing'

export const metadata = {
  title: 'HVAC AI Receptionist Pricing | 369 Agentic Systems',
  description: 'Simple monthly pricing for HVAC companies. No long-term contracts.',
}

export default function HVACPricingPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', background: '#0A0A0A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#475569', fontFamily: 'monospace', fontSize: 12 }}>Loading pricing...</p>
      </div>
    }>
      <VerticalPricing vertical="hvac" />
    </Suspense>
  )
}
