# Gumloop Agent Instruction — Wire Webhook URL into Marketing Pages

**Trigger:** When Gumloop Pro is activated and a public webhook URL is available.

---

## What needs to happen

All 8 marketing pages in the `/public` folder currently submit forms to a placeholder URL or a test endpoint. Once Gumloop Pro provides a live public webhook URL for the pipeline, that URL must be inserted into each form's `fetch` call.

---

## The 8 files to update

| Industry | File path |
|----------|-----------|
| Legal | `public/legal-automation/index.html` |
| Roofing | `public/roofing-leads/index.html` |
| SaaS | `public/saas-optimization/index.html` |
| Dental | `public/dental/index.html` |
| Real Estate | `public/real-estate/index.html` |
| Insurance | `public/insurance-leads/index.html` |
| Wholesale | `public/wholesale-leads/index.html` |
| Main (Custom/modal) | `public/index.html` |

---

## What to find in each file

Search each file for the form submission `fetch` call. It will look like one of these patterns:

```js
fetch('GUMLOOP_WEBHOOK_URL_HERE', { ... })
fetch('https://app.gumloop.com/api/...', { ... })
fetch('YOUR_WEBHOOK_URL', { ... })
```

Some files may already have a placeholder or a test URL. The exact string varies — search each file for `fetch(` to locate it.

---

## What to replace it with

Replace the URL argument with your live Gumloop webhook URL. It will look like:

```
https://api.gumloop.com/webhook/YOUR_PIPELINE_ID/trigger
```

or the URL shown in your Gumloop pipeline's "Webhook Input" node settings under **Pro → Expose Webhook**.

The replacement should look like:

```js
fetch('https://api.gumloop.com/webhook/YOUR_ACTUAL_ID/trigger', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(formData)
})
```

---

## Validation after wiring

1. Go to one marketing page (e.g., `https://369agenticsystems.com/roofing-leads/`)
2. Fill out the form with test data (use your own email)
3. Submit — you should see the terminal animation play
4. Check Gumloop dashboard — the pipeline run should appear within 30 seconds
5. Check your email — Diagnostic Alert should arrive within 2 minutes
6. Check Supabase `system_audits` table — a new row should be inserted
7. Check the portal dashboard — a new card should appear in the Active Specialists grid

If all 7 steps pass, the integration is live. Repeat for at least 2 other industry pages to confirm all forms are wired correctly.

---

## Note on Zero-Touch Policy

These are static HTML files served directly by Vercel's CDN. They are **never** converted to `.tsx` or imported into the Next.js app. Edit them as plain HTML files only.
