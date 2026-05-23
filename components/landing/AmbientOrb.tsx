'use client'

import { useEffect, useRef } from 'react'

export default function AmbientOrb() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    let mx = 50, my = 50, cx = 50, cy = 50
    let raf: number

    const onMove = (e: MouseEvent) => {
      mx = (e.clientX / window.innerWidth) * 100
      my = (e.clientY / window.innerHeight) * 100
    }

    const tick = () => {
      cx += (mx - cx) * 0.04
      cy += (my - cy) * 0.04
      el.style.background = `
        radial-gradient(ellipse 60% 52% at ${cx}% ${cy}%,
          rgba(212,175,55,0.09) 0%, transparent 62%),
        radial-gradient(ellipse 42% 38% at ${100 - cx}% ${100 - cy}%,
          rgba(99,102,241,0.05) 0%, transparent 58%),
        radial-gradient(ellipse 30% 30% at 50% 50%,
          rgba(245,158,11,0.025) 0%, transparent 70%)
      `
      raf = requestAnimationFrame(tick)
    }

    document.addEventListener('mousemove', onMove)
    raf = requestAnimationFrame(tick)

    return () => {
      document.removeEventListener('mousemove', onMove)
      cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <div
      ref={ref}
      aria-hidden="true"
      style={{
        position: 'fixed', inset: 0,
        pointerEvents: 'none', zIndex: 1,
      }}
    />
  )
}
