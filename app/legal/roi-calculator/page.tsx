import { Suspense } from 'react'
import { VerticalROICalculator } from '@/components/verticals/VerticalROICalculator'

export default function Page() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#0A0A0A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><p style={{ color: '#475569', fontFamily: 'monospace', fontSize: 12 }}>Loading your analysis...</p></div>}>
      <VerticalROICalculator vertical="legal" />
    </Suspense>
  )
}
