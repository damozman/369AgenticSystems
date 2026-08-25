/**
 * Turns one uploaded photo into what a site actually serves.
 *
 * `docs/PHOTO-REQUIREMENTS.md` Part B, §5, in order — and the order is load-bearing, not just
 * documentation:
 *
 * 1. Read EXIF orientation, apply the rotation, THEN strip all EXIF. Strip first and a sideways
 *    photo stays sideways.
 * 2. Strip ALL metadata. GPS in a job-site photo is the coordinates of a customer's home, and this
 *    is a public bucket — a privacy requirement, not an optimisation.
 * 3. Convert to WebP q82, keep a JPEG fallback at the same quality.
 * 4. Generate 480/960/1440/2560px variants, skipping anything larger than the source.
 * 5. Extract a dominant color for a loading placeholder.
 * 6. Report original (post-rotation) dimensions and aspect ratio.
 *
 * `sharp` does both 1 and 2 as a side effect of how its output methods work: calling `.rotate()`
 * with no arguments reads the EXIF orientation tag and bakes it into the pixels, and NOT calling
 * `.withMetadata()` on the output means sharp does not copy EXIF/ICC/GPS forward — so the ordering
 * above falls out of the pipeline shape rather than needing an explicit strip step.
 *
 * **HEIC/HEIF go through `heic-convert` first, never through sharp.** Sharp's prebuilt binaries
 * exclude libheif (HEVC patent licensing), so it cannot decode HEIC in Vercel's serverless build —
 * confirmed 2026-08-24, no `@img/sharp-*-heif` package is present. `heic-convert` is WASM-backed
 * (`libheif-js` via `heic-decode`), needs no native build step, and works identically in
 * serverless. Chris's call, same date: use both, each for what it does — heic-convert only for the
 * decode, sharp for everything downstream.
 */

import sharp from 'sharp'
import convertHeic from 'heic-convert'
import { decideResolution, type ResolutionDecision } from '@/lib/lead-engine/limits'

const VARIANT_WIDTHS = [480, 960, 1440, 2560] as const
const ENCODE_QUALITY = 82

export interface PhotoVariantBuffers {
  width: number
  webp: Buffer
  jpg: Buffer
}

export interface ProcessedPhoto {
  width: number
  height: number
  aspectRatio: number
  dominantHex: string
  variants: PhotoVariantBuffers[]
  resolution: ResolutionDecision
}

/**
 * HEIC/HEIF only. Everything else passes through untouched — sharp decodes JPEG/PNG/WebP fine on
 * its own, and running every upload through an extra JS-based decode would be pure waste.
 */
export async function normalizeToRaster(
  buffer: Buffer,
  contentType: string,
): Promise<{ buffer: Buffer; contentType: string }> {
  if (contentType !== 'image/heic' && contentType !== 'image/heif') {
    return { buffer, contentType }
  }
  const jpeg = await convertHeic({ buffer, format: 'JPEG', quality: 1 })
  return { buffer: Buffer.from(jpeg), contentType: 'image/jpeg' }
}

function toHex(n: number): string {
  return Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, '0')
}

/**
 * Decode, orient, measure, and re-encode. `buffer` must already be a raster format sharp can read
 * — call `normalizeToRaster` first for anything that might be HEIC.
 */
export async function processPhoto(buffer: Buffer): Promise<ProcessedPhoto> {
  const oriented = sharp(buffer).rotate()
  // toBuffer here both bakes in the EXIF rotation and gives back the POST-rotation dimensions —
  // sharp's own .metadata() reports the file's original (pre-rotation) width/height plus the
  // orientation tag, which is the wrong number to compare against MIN_PHOTO_LONG_EDGE for a photo
  // shot in portrait and tagged to display that way.
  const { data: rotatedBuffer, info } = await oriented.toBuffer({ resolveWithObject: true })
  const { width, height } = info

  const stats = await sharp(rotatedBuffer).stats()
  const dominantHex = `#${toHex(stats.dominant.r)}${toHex(stats.dominant.g)}${toHex(stats.dominant.b)}`

  const longEdge = Math.max(width, height)
  const resolution = decideResolution(longEdge)

  const widths: number[] = VARIANT_WIDTHS.filter(w => w <= width)
  // A photo narrower than every variant width still needs at least one stored size.
  if (widths.length === 0) widths.push(width)

  const variants: PhotoVariantBuffers[] = await Promise.all(
    widths.map(async (w): Promise<PhotoVariantBuffers> => {
      const resized = sharp(rotatedBuffer).resize({ width: w, withoutEnlargement: true })
      const [webp, jpg] = await Promise.all([
        resized.clone().webp({ quality: ENCODE_QUALITY }).toBuffer(),
        resized.clone().jpeg({ quality: ENCODE_QUALITY }).toBuffer(),
      ])
      return { width: w, webp, jpg }
    }),
  )

  return {
    width,
    height,
    aspectRatio: width / height,
    dominantHex,
    variants,
    resolution,
  }
}
