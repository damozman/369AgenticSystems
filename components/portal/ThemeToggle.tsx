'use client'

import { useEffect, useState } from 'react'
import { Sun, Moon } from 'lucide-react'

interface Props {
  className?:  string
  showLabel?:  boolean
}

export default function ThemeToggle({ className = '', showLabel = false }: Props) {
  const [isLight, setIsLight] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('portal-theme')
    const light = saved === 'light'
    setIsLight(light)
    document.documentElement.classList.toggle('light', light)
  }, [])

  function toggle() {
    const next = !isLight
    setIsLight(next)
    document.documentElement.classList.toggle('light', next)
    localStorage.setItem('portal-theme', next ? 'light' : 'dark')
  }

  return (
    <button onClick={toggle} aria-label="Toggle theme" className={className}>
      {isLight
        ? <Moon size={15} className="flex-shrink-0" />
        : <Sun  size={15} className="flex-shrink-0" />
      }
      {showLabel && (
        <span className="text-sm">{isLight ? 'Dark mode' : 'Light mode'}</span>
      )}
    </button>
  )
}
