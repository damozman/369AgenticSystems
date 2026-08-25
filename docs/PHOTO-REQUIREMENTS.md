# Lead Engine — Photo Requirements

Two parts. Part A is customer-facing — copy it into onboarding as-is. Part B is the pipeline spec for the agent.

**Status: Part B BUILT and PROVEN end to end, 2026-08-24.** `lib/lead-engine/limits.ts`,
`lib/lead-engine/photo-pipeline.ts`, `lib/lead-engine/photo-storage.ts`, `lib/lead-engine/photos.ts`
(allocator), the rendering pass in `components/lead-engine/SiteSections.tsx`, and two API routes.
tsc clean, 18 new tests, `next build` clean, rendering verified against all 8 real review fixtures
on a live dev server, and — same day, via a throwaway admin harness at
`/admin/lead-engine-photos` (not part of the product) — a real HEIC photo uploaded, converted,
resized, stored, and deleted through the actual live routes. No mocking anywhere in that chain:
real signed Storage upload, real `heic-convert` decode, real DB row (4000×3000, 4 variants,
`#989898` dominant), real `DELETE` route, verified read-only afterward that the row and all 8
storage objects were actually gone, not just that the route returned 200.

**Two decisions this section assumed away turned out to need answers, both settled 2026-08-24:**

1. **sharp can't decode HEIC on Vercel.** Its prebuilt binaries exclude libheif (HEVC patent
   licensing) — confirmed live, no `@img/sharp-*-heif` package is installed. Chris's call:
   `heic-convert` (WASM, `libheif-js`, no native build step) decodes HEIC only; sharp does
   everything downstream. Neither needs `next.config.mjs` or Vercel build changes.
2. **A 20MB upload can never reach `app/api/lead-engine/photos/route.ts` as a request body.**
   Vercel Functions cap request/response bodies at 4.5MB, hard and unconfigurable (confirmed
   against Vercel's own docs, updated 2026-07-01). §6/§10 below describe the ORIGINAL single-route
   design and are kept for the processing logic they still fully specify, but the upload path
   itself is now two routes, not one — see "What actually got built" below before reading §6/§10
   as if they described the live route shape.

**Formerly "still unverified," closed out same day — do not re-verify:**
- Real HEIC decoding — `heic-convert` correctly decoded a real iPhone HEIC end to end.
- The whole two-hop upload from an actual browser (sign → direct-to-Storage → process) — run for
  real, not just reasoned through against the SDK source.
- Both Storage buckets exist: `lead-engine-photos` (public, from Phase 6) and
  `lead-engine-photos-incoming` (private, created by hand 2026-08-24).
- The 2026-08-24 migration is applied — proven by the test row actually having
  `width`/`height`/`aspect_ratio`/`dominant_hex`/`variants` populated.

**Still genuinely open:** there is no CUSTOMER-facing UI that calls `/api/lead-engine/photos/sign`
— only the internal admin harness at `/admin/lead-engine-photos`. That's Chunk B.

### What actually got built (read this before §6/§10, which describe the original single-route design)

**Two routes, not one**, because of the 4.5MB body-cap finding above:

- `POST /api/lead-engine/photos/sign` — `{siteId, filename}` in, `{path, token}` out. Mints a
  Supabase Storage signed upload URL scoped to the PRIVATE incoming bucket. The browser then
  calls Supabase's own `uploadToSignedUrl` directly — the raw file never touches our route.
- `POST /api/lead-engine/photos` — `{siteId, incomingPath, filename, isPrimary?, caption?}` in.
  Downloads the raw bytes server-to-server (not bound by the inbound limit), runs
  `normalizeToRaster` → `processPhoto` → uploads every WebP+JPEG variant to the PUBLIC bucket →
  writes the `lead_engine_photos` row → deletes the raw original from the incoming bucket, always,
  success or failure.
- `DELETE /api/lead-engine/photos?photoId=...` — as originally specified.

`lib/lead-engine/limits.ts` gained `decideBatchPhotoUpload` (the "over 18 files" message, for a
future dashboard offering multi-select) and `decideResolution` (the 1200/2000px checks, run after
decode since resolution can't be known from an undecoded file) alongside the raised
`decidePhotoUpload` caps.

---

# Part A · What to send us

*Send this to the customer during onboarding.*

## The short version

**8 to 14 photos. Landscape. Straight off your phone is fine — just don't crop them first.**

## What we need

**Take them landscape (phone sideways).** We crop the same photo different ways for different parts of the page, and we can always crop a wide photo down. We can't widen a narrow one.

**Don't crop or edit before sending.** Send the original. Filters, borders, and pre-cropped images give us less to work with, and anything already filtered will clash with the rest of the set.

**Leave room around the subject.** Don't fill the frame edge to edge. The hero image at the top of your page is cropped tall, so a roof photographed tight to the frame loses its top and bottom.

**Full size, not "small" or "medium."** If your phone or email offers to shrink them, decline. Text and shingles and equipment detail fall apart at small sizes.

## The shot list

Send at least one of each. More of the first two is better than more of the last two.

| | What | Why |
|---|---|---|
| 1 | **3–5 finished jobs**, wide enough to see the whole thing | The main proof that you do good work |
| 2 | **1–2 of your crew or you on site**, working, not posed | The single most-looked-at photo on any service site |
| 3 | **1 wide establishing shot** — a property, a yard, a full job in context | Used as a full-width band across the page |
| 4 | **1–2 of your truck or equipment** with your branding visible | Signals a real, equipped business |
| 5 | **1–2 close details** — a finished edge, a seam, a specific piece of work | Shows care |

**Tell us which one is your best.** We'll put it at the top of the page. If you don't say, we use whichever you sent first.

## What we can't use

- Screenshots, or photos of photos
- Anything with another company's logo, truck, or branding in it
- Stock photos or images from the internet — we'd rather build your page with no photos than someone else's
- Photos with people whose permission you don't have, especially customers or their homes
- Heavy filters, added text, watermarks, or collages

## If you don't have photos

Say so. We build the page differently — it's designed to work on words alone and it looks intentional, not empty. You can add photos later at no cost, and we'll refresh them quarterly as part of your monthly plan.

---

# Part B · Pipeline spec

*For the agent. Extends `lib/lead-engine/limits.ts` and `app/api/lead-engine/photos/route.ts`.*

## 1. Raise the count cap from 12 to 18

Current arithmetic doesn't cover a full site: hero (1) + band (1) + six-service ladder (6) + gallery (6) = 14 distinct slots. At 12 the allocator is already rationing, which is why "ladder wins when short" exists as a rule.

```
stored maximum      18
rendered            hero 1 · band 1 · ladder ≤6 · gallery ≤6
warn in admin UI    below 8 (some slots will go unfilled)
```

## 2. Raise the size cap from 5MB to 20MB on ingest

5MB rejects real customer photos. A 12MP phone JPEG is 3–5MB, a modern iPhone at full resolution is 4–8MB, and a DSLR JPEG runs 8–15MB. The cap should stop abuse, not ordinary uploads.

Compression happens server-side after ingest, so stored output is small regardless.

```
accept          ≤ 20MB per file, ≤ 18 files
reject with     a clear message naming the actual size and the limit
```

## 3. Accepted input formats

```
image/jpeg · image/png · image/webp · image/heic · image/heif
```

**HEIC is mandatory and is the one most likely to be missed.** iPhones shoot HEIC by default. It stores fine and renders in no browser, so without conversion a customer's upload succeeds and their site shows nothing. Convert on ingest with `sharp` (libheif-backed) or `heic-convert`.

Reject and explain: GIF, BMP, TIFF, SVG, PDF. SVG especially — it can carry script and this is a public bucket.

## 4. Minimum resolution

```
reject      < 1200px on the long edge
warn        < 2000px on the long edge (usable, but not for the hero)
ideal       ≥ 3000px
```

The band renders full-bleed and can display at 2560px on a wide monitor. The hero is roughly 610×620 CSS, so 1240px tall at 2×. 2000px on the long edge is the honest floor for a photo that might land in either slot.

## 5. Processing on ingest — in this order

```
1. Read EXIF orientation, apply the rotation, THEN strip all EXIF.
   Order matters. Strip first and sideways photos stay sideways.

2. Strip ALL metadata. GPS coordinates in a job-site photo are the
   coordinates of a customer's home, and this is a public bucket.
   This is a privacy requirement, not an optimization.

3. Convert to WebP, quality 82. Keep a JPEG fallback at the same
   quality for older clients.

4. Generate variants at 480 / 960 / 1440 / 2560px on the long edge.
   Skip any variant larger than the source — never upscale.

5. Extract a dominant color and store it as a hex on the photo row,
   for use as a placeholder background while the image loads.

6. Store original dimensions and the computed aspect ratio.
```

Never serve the original to a browser. A 4000px source behind a 610px hero slot is the difference between a fast page and a slow one, and the hero image is your LCP element.

## 6. Storage paths

```
lead-engine-photos/{site_id}/{photo_id}/{width}.webp
lead-engine-photos/{site_id}/{photo_id}/{width}.jpg
```

Extend `lead_engine_photos` with: `width int`, `height int`, `aspect_ratio numeric`, `dominant_hex text`, `variants jsonb`, `is_primary boolean default false`.

## 7. Rendering

```html
<img
  srcset="…480.webp 480w, …960.webp 960w, …1440.webp 1440w, …2560.webp 2560w"
  sizes="<per slot>"
  loading="<eager for hero, lazy for all others>"
  fetchpriority="<high for hero only>"
  width height          <!-- always, to prevent layout shift -->
  style="background: var(--dominant-hex)"
  alt="<see §9>"
/>
```

Every slot keeps `object-fit: cover` with a fixed `aspect-ratio` — that's already correct and shouldn't change.

## 8. Allocation — one addition

The allocator (hero → band → ladder → gallery, deterministic by `sort_order`) is right and stays. Add two rules:

- **`is_primary` overrides sort order for the hero slot.** The customer tells us their best photo; that's the one at the top of the page.
- **Prefer aspect ratio per slot when a choice exists.** The band wants the widest available photo; the hero wants the least-wide. Fall back to `sort_order` when ratios are equivalent. A 21:9 landscape cropped into a tall hero slot loses most of its subject.

## 9. Alt text

Never leave it empty and never generate a description of image content — we can't see the photo and a wrong description is worse than none.

Compose from data already held: `"{business_name} — {service_name}"` where the photo is allocated to a service row, `"{business_name}"` otherwise. Purely decorative slots get `alt=""`.

Add a caption field to the admin edit page so a human can improve it. `lead_engine_photos.caption` already exists.

## 10. Rejection messages

Every rejection tells the customer what to do next, not just what failed.

| Cause | Message |
|---|---|
| Over 20MB | "This photo is 24MB and the limit is 20MB. Send it from your phone's photo app rather than a file manager and it'll compress automatically." |
| Under 1200px | "This one's too small to print clearly on your page. If you shrank it to email it, send the original instead." |
| Unsupported type | "We can accept JPG, PNG, WebP, and iPhone photos. This file is a PDF." |
| Over 18 files | "That's 22 photos and we can use 18. Pick your best 18 — we'd rather have your strongest work than all of it." |

## 11. Tests

- HEIC input converts and renders; assert the output is WebP
- A photo with EXIF orientation 6 comes out upright
- All EXIF is absent from output, GPS specifically asserted
- A 900px source is rejected; a 1500px source warns but stores
- No variant exceeds the source dimensions
- `is_primary` takes the hero slot over a lower `sort_order`
- The allocator never assigns one photo to two slots — this is the bug that put the same roof on a page three times
- A 20MB upload succeeds; 21MB is rejected with the size named
