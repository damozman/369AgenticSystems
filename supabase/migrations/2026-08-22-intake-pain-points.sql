-- Pain points as an ordered array. Dossier build order step 2.
--
-- The intake form's bottleneck question is becoming a checkbox group: today it is a single-choice
-- <select> ending in "All of the above", which is the option that destroys the most information —
-- someone who picks it has told you nothing about priority. Three of five tells the dossier what
-- to lead with.
--
-- Order is meaningful: the dossier addresses each checked point in the order the form lists them,
-- which is why this is an array and not a set or a bag of booleans.
--
-- `pain_point` (singular, TEXT, added in step 0) is kept and continues to be written as the same
-- values joined by ", ". That is deliberate redundancy with one specific job: /api/intake degrades
-- its insert when a column is missing rather than failing and losing the prospect, so if this
-- migration has not been applied yet the joined string still carries the whole answer. One writer,
-- two representations — not two writers.
--
-- Purely additive, safe to run anytime.

ALTER TABLE system_audits
  ADD COLUMN IF NOT EXISTS pain_points TEXT[];

COMMENT ON COLUMN system_audits.pain_points IS
  'Bottlenecks the prospect checked on the intake form, in the order the form lists them. Mirrored as a ", "-joined string in pain_point.';

-- Read the units off these two before doing arithmetic with them.
COMMENT ON COLUMN system_audits.monthly_volume IS
  'TOTAL inbound calls/leads per month, as estimated by the prospect. NOT the missed portion. Multiplying this by RECOVERY_RATE claims 30% of every call they receive is recoverable revenue, which is a fabricated number — the missed rate must come from the measured audit call, never from an assumption.';

COMMENT ON COLUMN system_audits.avg_job_value IS
  'Average value of one closed job/booking/matter, in dollars, as estimated by the prospect. Label varies per vertical (job value, rental value, commission, annual premium, matter value).';
