/**
 * The type faces each theme kit needs.
 *
 * ── Why every face is declared here rather than loaded per request ──
 * `next/font/google` only works at module scope: the faces are resolved, subset and self-hosted at
 * BUILD time, so "load only the resolved theme's faces" cannot be a runtime decision. Declaring
 * them conditionally is not possible, and a dynamic import does not inject the CSS.
 *
 * What is possible, and what this does: `preload: false` on every face, plus applying only the
 * resolved theme's variable class to the page. The stylesheet then carries `@font-face` rules for
 * every kit, but a browser downloads a face only when rendered text actually uses it — so a
 * roofer's visitor fetches Archivo and Archivo Black, and never Fraunces or Newsreader.
 *
 * The cost is losing next/font's preload hint on the display face, which is a real but small LCP
 * penalty. The alternative — preloading every kit's faces on every site — is roughly a megabyte
 * of fonts a visitor will never see, on pages sold to businesses whose customers are on phones in
 * a driveway. Revisit if LCP measurements say otherwise; measure before changing it.
 *
 * Only each kit's DEFAULT display face is wired. `fontsFor()` returns two alternates per theme for
 * the Chunk C admin picker; those get declared here when that picker exists, not before.
 */

import {
  Archivo, Archivo_Black, Newsreader, Public_Sans, Instrument_Serif, DM_Sans,
  IBM_Plex_Sans, IBM_Plex_Mono, Saira_Condensed, Barlow, Fraunces, Karla,
} from 'next/font/google'
import type { Theme } from '@/lib/lead-engine/theme'

// ── Every option below is written out in full, and must stay that way ──
//
// `next/font/google` calls are read by an SWC plugin at BUILD time, not evaluated at runtime, so
// the argument has to be a statically analyzable object literal. A shared `const common = {...}`
// spread into each call fails with "Unexpected spread" — and `tsc` cannot see that constraint,
// because it is a build-plugin rule rather than a type rule.
//
// Found by loading the page rather than by typechecking, which is the lesson: with
// `ignoreBuildErrors: true` set in next.config.mjs, `npx tsc --noEmit` passing says nothing about
// whether the app compiles. The route has to actually be requested.
//
// So: no spread, no variables, no computed keys in any call here. Repetition is the price.

// IRONCLAD
const archivo      = Archivo({ subsets: ['latin'], display: 'swap', preload: false, variable: '--le-f-archivo' })
const archivoBlack = Archivo_Black({ subsets: ['latin'], display: 'swap', preload: false, weight: '400', variable: '--le-f-archivo-black' })

// COUNSEL
const newsreader = Newsreader({ subsets: ['latin'], display: 'swap', preload: false, variable: '--le-f-newsreader' })
const publicSans = Public_Sans({ subsets: ['latin'], display: 'swap', preload: false, variable: '--le-f-public-sans' })

// THRESHOLD
const instrumentSerif = Instrument_Serif({ subsets: ['latin'], display: 'swap', preload: false, weight: '400', variable: '--le-f-instrument-serif' })
const dmSans          = DM_Sans({ subsets: ['latin'], display: 'swap', preload: false, variable: '--le-f-dm-sans' })

// LEDGER
const plexSans = IBM_Plex_Sans({ subsets: ['latin'], display: 'swap', preload: false, weight: ['400', '600'], variable: '--le-f-plex-sans' })
const plexMono = IBM_Plex_Mono({ subsets: ['latin'], display: 'swap', preload: false, weight: ['400', '500'], variable: '--le-f-plex-mono' })

// YARD
const sairaCondensed = Saira_Condensed({ subsets: ['latin'], display: 'swap', preload: false, weight: ['400', '700'], variable: '--le-f-saira' })
const barlow         = Barlow({ subsets: ['latin'], display: 'swap', preload: false, weight: ['400', '600'], variable: '--le-f-barlow' })

// CLINIC
const fraunces = Fraunces({ subsets: ['latin'], display: 'swap', preload: false, variable: '--le-f-fraunces' })
const karla    = Karla({ subsets: ['latin'], display: 'swap', preload: false, variable: '--le-f-karla' })

/**
 * The class names to put on the theme wrapper — display, body and utility faces for one kit.
 *
 * next/font's `.variable` classes define `--le-f-*`; `tokensFor()` emits `--le-font-display` etc.
 * as the literal family names. Both work: the variable classes are what make the self-hosted files
 * reachable, and the family names are what the CSS actually asks for.
 */
const FONT_CLASSES: Record<Theme, string[]> = {
  ironclad:  [archivoBlack.variable, archivo.variable],
  // Forge is Ironclad's type, unchanged — the kit's differences are chrome, colour and elevation,
  // not the faces. It reuses the same two declarations rather than adding a seventh pair.
  forge:     [archivoBlack.variable, archivo.variable],
  counsel:   [newsreader.variable, publicSans.variable],
  threshold: [instrumentSerif.variable, dmSans.variable],
  ledger:    [plexSans.variable, plexMono.variable],
  yard:      [sairaCondensed.variable, barlow.variable],
  clinic:    [fraunces.variable, karla.variable],
}

export function fontClassFor(theme: Theme): string {
  return (FONT_CLASSES[theme] ?? FONT_CLASSES.counsel).join(' ')
}
