import { test } from 'node:test'
import assert from 'node:assert/strict'
import sharp from 'sharp'
import { normalizeToRaster, processPhoto } from '@/lib/lead-engine/photo-pipeline'

/**
 * Every fixture here is generated with `sharp({create: ...})`, not a real phone photo — that is
 * real image processing, not a mock, and it is what lets EXIF orientation, GPS stripping and
 * upscale-prevention be asserted against actual bytes rather than trusted from the sharp docs.
 *
 * **What this file does NOT prove: real HEIC decoding.** heic-convert (`libheif-js`, WASM) has no
 * bundled test fixture and this repo has no encoder that can produce a valid HEIC file to decode
 * — constructing one by hand is not a shortcut worth taking, since a hand-built HEIC that happens
 * to parse is not evidence a real iPhone photo will. `normalizeToRaster`'s ROUTING is proven below
 * (heic/heif content-types reach the converter path, everything else bypasses it); the decode
 * itself needs one real-phone upload before this ships, the same discipline this project already
 * applies to the audit call's voicemail path and the onboarding welcome-email link.
 */

const solidJpeg = (width: number, height: number, rgb: { r: number; g: number; b: number }) =>
  sharp({ create: { width, height, channels: 3, background: rgb } }).jpeg().toBuffer()

const orientedJpeg = (width: number, height: number, orientation: number, rgb: { r: number; g: number; b: number }) =>
  sharp({ create: { width, height, channels: 3, background: rgb } })
    .jpeg()
    .withMetadata({ orientation, exif: { GPS: { GPSLatitude: '32/1' }, IFD0: { Make: 'Apple' } } })
    .toBuffer()

test('normalizeToRaster passes non-HEIC buffers through untouched', async () => {
  const buf = await solidJpeg(20, 20, { r: 0, g: 0, b: 0 })
  const out = await normalizeToRaster(buf, 'image/jpeg')
  assert.equal(out.buffer, buf, 'must not re-encode a format sharp can already read')
  assert.equal(out.contentType, 'image/jpeg')
})

test('normalizeToRaster routes HEIC and HEIF to the converter, not sharp', async () => {
  // Proves ROUTING only — see the file-level note above for why decode itself isn't asserted here.
  for (const type of ['image/heic', 'image/heif']) {
    await assert.rejects(
      () => normalizeToRaster(Buffer.from('not a real heic file'), type),
      /heic|invalid|decode/i,
      `${type} should reach heic-convert and fail on non-HEIC bytes, not silently pass through`,
    )
  }
})

test('EXIF orientation is applied to the pixels, then all EXIF including GPS is stripped', async () => {
  // A 100x50 source tagged orientation 6 ("rotate 90° CW to display upright") must come out 50x100.
  const src = await orientedJpeg(100, 50, 6, { r: 10, g: 200, b: 10 })
  const srcMeta = await sharp(src).metadata()
  assert.ok(srcMeta.exif, 'fixture must actually carry EXIF, or this test proves nothing')

  const result = await processPhoto(src)
  assert.equal(result.width, 50)
  assert.equal(result.height, 100)

  for (const v of result.variants) {
    const meta = await sharp(v.jpg).metadata()
    assert.equal(meta.exif, undefined, `variant at ${v.width}px must carry no EXIF (GPS specifically)`)
  }
})

test('a 900px source is rejected, a 1500px source warns but still produces variants', async () => {
  const tooSmall = await solidJpeg(900, 600, { r: 100, g: 100, b: 100 })
  const small = await processPhoto(tooSmall)
  assert.equal(small.resolution.status, 'reject')

  const warnSize = await solidJpeg(1500, 1000, { r: 100, g: 100, b: 100 })
  const warned = await processPhoto(warnSize)
  assert.equal(warned.resolution.status, 'warn')
  assert.ok(warned.variants.length > 0, 'a warned photo still stores — the warning is advisory')
})

test('no variant ever exceeds the source dimensions', async () => {
  // Narrower than every stated variant width (480/960/1440/2560).
  const src = await solidJpeg(300, 200, { r: 50, g: 50, b: 200 })
  const result = await processPhoto(src)
  assert.ok(result.variants.length >= 1, 'a source too small for any preset still gets one stored size')
  for (const v of result.variants) {
    assert.ok(v.width <= 300, `variant width ${v.width} exceeds the 300px source`)
  }
})

test('dominant color reads back as a real hex string', async () => {
  const src = await solidJpeg(200, 200, { r: 200, g: 20, b: 20 })
  const result = await processPhoto(src)
  assert.match(result.dominantHex, /^#[0-9a-f]{6}$/)
  // A solid-color fixture should read back close to its own input, not exact — JPEG is lossy.
  const r = parseInt(result.dominantHex.slice(1, 3), 16)
  assert.ok(r > 150, `dominant red channel ${r} should reflect the mostly-red fixture`)
})

test('aspect ratio is width over height, post-rotation', async () => {
  const wide = await solidJpeg(400, 100, { r: 1, g: 1, b: 1 })
  const result = await processPhoto(wide)
  assert.equal(result.aspectRatio, 4)
})
