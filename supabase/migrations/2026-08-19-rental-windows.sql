-- Multi-day rental windows.
--
-- The gap this closes was live and specific: a bounce house booked Saturday 10:00 for 90 minutes
-- read as FREE at noon, while it was physically at a party until Sunday. `book_slot()` has always
-- accepted an arbitrary tstzrange, so the database could already hold a multi-day booking — what
-- did not exist was any way to say "this item is hired by the day" and therefore any way to
-- OFFER one. Dumpsters and portable restrooms are unsellable without it, since multi-day hire is
-- the entire service.
--
-- Both columns are NULLABLE, and null is the load-bearing case: an item with no rental
-- configuration keeps exactly today's intra-day slot behaviour. Every existing client books
-- people-time, and a regression there breaks every roofer, attorney and plumber at once — the
-- same property `verify-inventory.mjs` already asserts for items in general.

alter table public.client_inventory
  -- Shortest hire that may be booked, in nights out. 1 = out one morning, back the next.
  -- NULL means this item is not hired by the day at all — it is booked as an intra-day slot,
  -- exactly as it is today. That is the default and it is deliberate.
  add column if not exists min_rental_days int
    check (min_rental_days is null or min_rental_days >= 1),

  -- Longest hire that may be booked. NULL with a non-null minimum means "no stated maximum",
  -- which is a real answer for a yard that will hire a dumpster for as long as you want it.
  add column if not exists max_rental_days int
    check (max_rental_days is null or max_rental_days >= 1);

-- A maximum below the minimum offers nothing at all, and would do so silently — the item would
-- simply stop appearing with no error anywhere. Rejected at write time instead.
alter table public.client_inventory
  drop constraint if exists client_inventory_rental_range;

alter table public.client_inventory
  add constraint client_inventory_rental_range
    check (
      min_rental_days is null
      or max_rental_days is null
      or max_rental_days >= min_rental_days
    );

comment on column public.client_inventory.min_rental_days is
  'Shortest hire in nights out. NULL = not a multi-day rental; booked as an intra-day slot as before.';
comment on column public.client_inventory.max_rental_days is
  'Longest hire in nights out. NULL alongside a set minimum means no stated maximum.';
