-- Adds stripe_customer_id to agent_subscriptions so the client dashboard can
-- link to Stripe's self-serve Billing Portal. Purely additive, safe to run anytime.

ALTER TABLE agent_subscriptions
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
