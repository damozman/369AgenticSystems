-- The prospect's business phone number. Dossier step 5.
--
-- The intake forms never asked for one. That is a gap with two costs:
--
--   1. The audit call — the centrepiece of the dossier, the "we called your line at 8:41 PM and it
--      went to voicemail" artifact — had no number to dial. The design says "your published
--      number" and assumed we held it. We did not.
--   2. Chris could not ring a lead back. Every submission arrived with an email and nothing else,
--      for a product whose entire subject is the telephone.
--
-- Scraping the number off their website was considered and is kept only as a cross-check: it is
-- what `lib/website-audit.ts` already extracts, but a prospect with no website would get no call,
-- and a mis-scraped number means dialling a stranger. The number they typed is authoritative.
--
-- Purely additive, safe to run anytime.

ALTER TABLE system_audits
  ADD COLUMN IF NOT EXISTS client_phone TEXT;

COMMENT ON COLUMN system_audits.client_phone IS
  'The business line the prospect gave us, as typed. Normalised to E.164 only at dial time by toE164() — storing it raw keeps what they actually entered visible when a number turns out to be undialable.';
