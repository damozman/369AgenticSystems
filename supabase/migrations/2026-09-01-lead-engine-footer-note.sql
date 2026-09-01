-- Lead Engine: the footer note.
--
-- A law firm's site needs "this does not create an attorney-client relationship"; a roofer's often
-- needs a state contractor licence number; most sites need neither. The plan called this
-- "template-scoped fixed copy", and that framing is WRONG -- `service_clean` serves legal,
-- insurance, accounting, consulting AND cleaning, so scoping by template would print an
-- attorney-client disclaimer on a cleaning company's website.
--
-- It is vertical-scoped, which this schema deliberately cannot answer: `createSite` does not store
-- the vertical (input vs resolved output -- see its own note). So the same shape as
-- `headline_noun`: store the RESOLVED text as a leaf. Nothing derives layout, template or theme
-- from it, and an operator can set it for a case no map could know.
--
-- Nullable, and null is the common case -- most sites render no note at all, exactly as today.

alter table public.lead_engine_sites
  add column if not exists footer_note text;

comment on column public.lead_engine_sites.footer_note is
  'Verbatim footer line -- a professional disclaimer, a contractor licence number. Defaulted from '
  'VERTICAL_FOOTER_NOTES at creation for the verticals that conventionally need one, and '
  'operator-overridable. NOT legal advice and NOT template-derived. Null renders no note.';
