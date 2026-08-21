# Media Slots — where video, audio and imagery go

Written 2026-08-20. The site had **five images total** before this — all of them the AI-generated
agent portraits. No photography, no screenshots, no audio, no video. This file says exactly where
each asset lands, what it has to weigh, and the one change that activates it.

**Rule that governs everything here:** the media has to be real. No stock photography of smiling
call-centre staff, no mocked dashboards presented as live, no invented numbers on a screenshot.
Real product artifacts are the whole advantage — they cannot be faked by a competitor, and this
site's credibility has been built on not overclaiming.

---

## Slot 1 — Hero video *(highest impact)*

**Where:** `public/index.html`, the `.hero-media` container, marked `<!-- MEDIA SLOT -->`.
It currently holds the animated call panel.

**What to shoot — the money shot.** Forty-five seconds, no narration:
phone rings → Ava answers (real audio) → caller asks for a day → transcript appears →
the Google Calendar event pops in → the confirmation email arrives.
That single clip proves the whole product, and every step of it is something the system really does.

**Specs**
| | |
|---|---|
| Aspect | 4:3 or 5:4 (the panel is ~520 × 420 — match it or the hero reflows) |
| Length | 30–60s, silent loop preferred; if it has audio, muted by default with an unmute control |
| Weight | **≤ 2.5 MB** for an autoplaying loop. Above that it hurts LCP badly. |
| Formats | `.webm` (VP9) first, `.mp4` (H.264) fallback |
| Poster | Required. Export a frame as `.jpg`, ≤ 120 KB. |

**To activate:** drop the files in `public/media/`, then replace the `.call-panel` div with:

```html
<video class="hero-video" autoplay muted loop playsinline preload="none"
       poster="/media/hero-poster.jpg" style="width:100%; border-radius:14px; display:block;">
  <source src="/media/hero-booking.webm" type="video/webm">
  <source src="/media/hero-booking.mp4"  type="video/mp4">
</video>
```

**Keep the call panel in the file, commented out.** It is the reduced-motion and no-JS fallback,
and it is what the page shows if the video ever fails to load.

---

## Slot 2 — Real call audio *(cheapest, most differentiated)*

**Where:** the "Proof, Not Promises" demo section on `public/index.html`, beside the phone number.

**Why this before video.** You are selling a voice and there is currently no audio anywhere on the
site. Competitors show video of a dashboard; you can play the actual product. It is also the
cheapest asset on this list to produce.

**⚠ Consent — read before recording.** Do **not** publish a real prospect's voice. Texas being a
one-party-consent state covers *recording* a call; it does not cover *broadcasting* a third party
on a marketing site. Produce the call deliberately: you (or someone who has agreed on the record)
call the demo line and play the customer. Same rule for any transcript screenshot — stage it or
scrub it.

**Specs:** 40–70s, `.mp3` at 96–128 kbps mono, **≤ 1 MB**, `preload="none"`.
Trim dead air at both ends; the first three seconds decide whether anyone listens to the rest.

Label it honestly next to the player: *"A real call to the demo line, recorded with consent."*

---

## Slot 3 — Founder video

**Where:** near the audit CTA strip on `public/index.html`, or on `/book-demo`. **Not the hero.**

**Why it earns a place.** For a company whose product is AI, a real human founder is the direct
answer to "this looks machine-made." It is the one thing that cannot be generated.

**Specs:** 60–90s, 16:9, click-to-play (never autoplay a talking head), poster required,
≤ 8 MB since it only loads on click.

---

## Slot 4 — Product screenshots

**Where:** the `#why` pillar strip and the system catalog cards, both on `public/index.html`.

**What:** the real dashboard with real calls in it, a real transcript, a booking on a real Google
Calendar, the confirmation email with its `.ics`. These are the substitute for the testimonials and
logo walls that are not available with zero clients.

**Specs:** `.jpg` or `.webp`, ≤ 200 KB each, 2× for retina, `loading="lazy"`.
Crop tight — a full-window screenshot reads as a screenshot; a cropped detail reads as a product.

**If a screenshot shows numbers, they must be real numbers.** The all-time totals are small
(72 calls, 31 leads, 24 bookings). Small and true beats large and invented — and a screenshot
showing plausible-but-fake volume is exactly the kind of claim this site has been kept clean of.

---

## Slot 5 — Per-vertical media on the lead pages

Twelve pages × a unique video each is the eventual goal. Two things to decide **before** shooting
twelve of anything:

1. **Bandwidth.** `public/` is served off Vercel's CDN and every byte counts against the plan's
   bandwidth. Twelve autoplaying hero videos is a different cost profile from one. Past two or
   three, move to a proper video host and embed.
2. **Photography is per-vertical, and this is where it belongs** — a roof, a bounce house at a
   party, a yard full of machines. The buyer needs to see their own world. It does *not* belong on
   the homepage, which serves all twelve buyers at once and would have to pick one.

The static `-leads` pages all share one structure, so a media block added to one can be replicated
across the others mechanically.

---

## Performance budget for the whole page

The homepage already loads Tailwind from a CDN plus Google Fonts before any of this. Keep the total
of all above-the-fold media **under 3 MB**, and let everything below the fold load lazily. If the
hero video pushes LCP past ~2.5s, ship the poster as the LCP element and start the video after load
instead.
