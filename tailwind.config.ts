import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        gold: {
          DEFAULT: '#D4AF37',
          dim: '#8B6914',
          bright: '#F0C94A',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'sans-serif'],
        display: ['var(--font-display)', 'Instrument Sans', 'sans-serif'],
        mono: ['"Courier New"', 'monospace'],
      },
      keyframes: {
        scanLine: {
          '0%':   { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(2000%)' },
        },
        terminalBlink: {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0' },
        },
        pulseGold: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(212,175,55,0.4)' },
          '50%':      { boxShadow: '0 0 0 6px rgba(212,175,55,0)' },
        },
      },
      animation: {
        'scan-line':        'scanLine 3.5s linear infinite',
        'terminal-blink':   'terminalBlink 1s step-end infinite',
        'pulse-gold':       'pulseGold 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}

export default config
