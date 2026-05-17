import type { Metadata } from 'next'
import { Inter, Instrument_Sans } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const instrumentSans = Instrument_Sans({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['400', '500', '600', '700'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: '369 Agentic Systems — Client Command Center',
  description: 'The End of Admin. The Start of Agentic Scale.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${instrumentSans.variable}`}>
      {/* Apply saved theme before first paint to prevent flash-of-dark */}
      <head>
        <script dangerouslySetInnerHTML={{ __html:
          `(function(){var t=localStorage.getItem('portal-theme');if(t==='light')document.documentElement.classList.add('light');})()`
        }} />
      </head>
      <body className="font-sans antialiased">{children}</body>
    </html>
  )
}
