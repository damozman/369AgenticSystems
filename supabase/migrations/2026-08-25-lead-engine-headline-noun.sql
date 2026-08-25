-- Lead Engine: the hero headline's noun.
--
-- The hero set the business name as its <h1>, so a stranger landing cold could not tell what the
-- company sold without scrolling to Services. The headline is now "<noun> in <primary area>" —
-- "Roofing in Fort Worth" — built entirely from what we already hold. This column is the noun.
--
-- It is the RESOLVED noun, never the vertical key. `createSite` deliberately does not store the
-- vertical, because the vertical is an input and template/theme are its resolved output, and
-- keeping both invites them to disagree. Nothing derives a template, theme or layout from this
-- column, so it carries none of that risk — and an operator can override it for a business that
-- sells itself as something the map cannot know ("Storm restoration", not "Roofing").
--
-- Nullable on purpose. Null means "we have no noun", and the hero falls back to the business name
-- exactly as it did before. Every existing row is null and renders unchanged.

alter table public.lead_engine_sites
  add column if not exists headline_noun text;

comment on column public.lead_engine_sites.headline_noun is
  'What the business does, for the hero headline ("Roofing"). Resolved from the vertical at '
  'creation via VERTICAL_NOUNS, operator-overridable. NOT the vertical key — the vertical is '
  'deliberately not stored. Null means the hero falls back to the business name.';
