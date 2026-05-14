# Static Marketing Assets

Place your existing HTML industry pages here to preserve their URLs.
Vercel serves index.html files at directory paths automatically.

## Required structure

```
public/
├── index.html                    ← yoursite.com/
├── legal-automation/
│   └── index.html                ← yoursite.com/legal-automation/
├── roofing-leads/
│   └── index.html                ← yoursite.com/roofing-leads/
├── saas-optimization/
│   └── index.html                ← yoursite.com/saas-optimization/
├── dental/
│   └── index.html                ← yoursite.com/dental/
├── real-estate/
│   └── index.html                ← yoursite.com/real-estate/
├── insurance-leads/
│   └── index.html                ← yoursite.com/insurance-leads/
└── wholesale-leads/
    └── index.html                ← yoursite.com/wholesale-leads/
```

## Zero-Touch Policy

These files are NOT converted to Next.js pages. They are pure static HTML
served directly by the Vercel CDN edge, completely isolated from the Next.js
app's CSS, Tailwind, and JavaScript bundles.

## Local development note

In `next dev`, static files are accessible at their explicit paths only:
  - http://localhost:3000/index.html
  - http://localhost:3000/legal-automation/index.html

On Vercel (production), directory URLs resolve automatically:
  - https://yoursite.com/legal-automation/
