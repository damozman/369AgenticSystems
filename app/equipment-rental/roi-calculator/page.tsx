import { Suspense } from 'react'
import { VerticalROICalculator } from '@/components/verticals/VerticalROICalculator'

export const metadata = {
  title: 'Equipment Rental ROI Calculator | 369 Agentic Systems',
  description: 'Estimate how many rentals you’re losing to missed calls — and how much you can recover.',
}

export default function EquipmentRentalROIPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', background: '#0A0A0A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#475569', fontFamily: 'monospace', fontSize: 12 }}>Calculating your ROI...</p>
      </div>
    }>
      <VerticalROICalculator vertical="equipment-rental" />
    </Suspense>
  )
}
