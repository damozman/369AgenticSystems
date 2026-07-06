import Image from 'next/image'

interface AvaCardProps {
  vertical: string
  size?: 'small' | 'medium' | 'large'
  showVirtue?: boolean
}

const AVA_CONFIG: Record<string, { image: string; color: string; virtue: string }> = {
  roofing:      { image: '/agents/ava/ava_roofing.jpg',     color: '#FF4500', virtue: 'Never Miss Another Storm Lead' },
  hvac:         { image: '/agents/ava/ava_hvac.jpg',        color: '#FF6533', virtue: '24/7 Emergency Response' },
  plumbing:     { image: '/agents/ava/ava_plumbing.jpg',    color: '#0369A1', virtue: 'No Emergency Goes Unanswered' },
  dental:       { image: '/agents/ava/ava_dental.jpg',      color: '#EC4899', virtue: 'Patient Retention, Not Voicemail' },
  legal:        { image: '/agents/ava/ava_legal.jpg',       color: '#60A5FA', virtue: 'High-Value Cases, Never Cold' },
  'real-estate':{ image: '/agents/ava/ava_real_estate.jpg', color: '#0EA5E9', virtue: 'Lead Velocity, Always' },
  insurance:    { image: '/agents/ava/ava_insurance.jpg',   color: '#14B8A6', virtue: 'Every Quote, Every Follow-Up' },
  saas:         { image: '/agents/ava/ava_saas.jpg',        color: '#8B5CF6', virtue: 'Churn Prevention, Conversion Focus' },
  wholesale:    { image: '/agents/ava/ava_wholesale.jpg',   color: '#84CC16', virtue: 'Order Confirmation, Zero Delays' },
}

const DIMENSIONS = {
  small:  { w: 140, h: 175 },
  medium: { w: 200, h: 250 },
  large:  { w: 280, h: 350 },
}

export function AvaCard({ vertical, size = 'medium', showVirtue = true }: AvaCardProps) {
  const config = AVA_CONFIG[vertical]
  if (!config) return null

  const { w, h } = DIMENSIONS[size]

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 16,
      padding: '24px 20px',
      background: 'rgba(255,255,255,0.03)',
      backdropFilter: 'blur(24px)',
      WebkitBackdropFilter: 'blur(24px)',
      border: `1px solid rgba(148,163,184,0.1)`,
      borderTop: `2px solid ${config.color}`,
      borderRadius: 16,
      transition: 'border-color 0.2s, background 0.2s',
    }}>
      {/* Image */}
      <div style={{ position: 'relative', width: w, height: h, borderRadius: 12, overflow: 'hidden', flexShrink: 0 }}>
        <Image
          src={config.image}
          alt={`Ava — AI Receptionist for ${vertical}`}
          fill
          className="object-cover"
          sizes={`${w}px`}
        />
        {/* Color overlay at bottom */}
        <div style={{
          position: 'absolute', inset: 0,
          background: `linear-gradient(to top, ${config.color}22 0%, transparent 50%)`,
          pointerEvents: 'none',
        }} />
      </div>

      {/* Name + role */}
      <div style={{ textAlign: 'center' }}>
        <p style={{
          margin: '0 0 2px',
          fontSize: size === 'large' ? 22 : 18,
          fontWeight: 700,
          color: config.color,
          fontFamily: "'Instrument Sans', sans-serif",
          letterSpacing: '-0.01em',
        }}>
          Ava
        </p>
        <p style={{
          margin: 0,
          fontFamily: 'monospace',
          fontSize: 9,
          color: '#475569',
          textTransform: 'uppercase',
          letterSpacing: '0.15em',
        }}>
          AI Receptionist
        </p>
      </div>

      {/* Virtue */}
      {showVirtue && (
        <p style={{
          margin: 0,
          fontSize: 12,
          color: '#64748B',
          textAlign: 'center',
          lineHeight: 1.6,
          maxWidth: 200,
        }}>
          {config.virtue}
        </p>
      )}

      {/* Live indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{
          width: 6, height: 6, borderRadius: '50%',
          background: config.color,
          boxShadow: `0 0 8px ${config.color}99`,
          display: 'inline-block',
        }} />
        <span style={{
          fontFamily: 'monospace', fontSize: 8,
          color: config.color,
          textTransform: 'uppercase', letterSpacing: '0.15em',
        }}>
          LIVE
        </span>
      </div>
    </div>
  )
}
