import { Suspense } from 'react'
import { VerticalROICalculator } from '@/components/verticals/VerticalROICalculator'

export const metadata = {
  title: 'Plumbing ROI Calculator | 369 Agentic Systems',
  description: 'See how much after-hours missed calls are costing your plumbing company each month.',
}

export default function PlumbingROIPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', background: '#0A0A0A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#475569', fontFamily: 'monospace', fontSize: 12 }}>Calculating your ROI...</p>
      </div>
    }>
      <VerticalROICalculator vertical="plumbing" />
    </Suspense>
  )
}
