'use client'

import { motion } from 'framer-motion'
import { ReactNode } from 'react'

interface ScanCardProps {
  children: ReactNode
  className?: string
  accentColor?: string
  scanDelay?: number
}

export default function ScanCard({
  children,
  className = '',
  accentColor = '#D4AF37',
  scanDelay = 0,
}: ScanCardProps) {
  return (
    <div
      className={`relative overflow-hidden rounded-xl border bg-[var(--bg-surface)] ${className}`}
      style={{ borderColor: `${accentColor}22` }}
    >
      {/* Top accent line */}
      <div
        className="absolute inset-x-0 top-0 h-[1px] pointer-events-none"
        style={{
          background: `linear-gradient(90deg, transparent, ${accentColor}55, transparent)`,
        }}
      />

      {/* Sweep scan line — the "active intelligence module" effect */}
      <motion.div
        className="absolute inset-x-0 h-[2px] pointer-events-none z-10"
        style={{
          background: `linear-gradient(90deg, transparent, ${accentColor}70, transparent)`,
          boxShadow: `0 0 10px ${accentColor}40`,
        }}
        initial={{ top: '-4px' }}
        animate={{ top: 'calc(100% + 4px)' }}
        transition={{
          duration: 2.5,
          repeat: Infinity,
          repeatDelay: 4 + scanDelay,
          ease: 'linear',
          delay: scanDelay,
        }}
      />

      {children}
    </div>
  )
}
