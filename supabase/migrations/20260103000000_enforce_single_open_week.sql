-- Enforce that only one week can be open at a time (demo mode)
-- 1) Clean up existing data: keep most recent start_date as open, close others
WITH w AS (
  SELECT id
  FROM public.weeks
  ORDER BY start_date DESC NULLS LAST, created_at DESC NULLS LAST
  LIMIT 1
)
UPDATE public.weeks
SET status = CASE WHEN id = (SELECT id FROM w) THEN 'open' ELSE 'closed' END;

-- 2) Prevent multiple open weeks going forward
CREATE UNIQUE INDEX IF NOT EXISTS weeks_only_one_open
ON public.weeks (status)
WHERE status = 'open';
