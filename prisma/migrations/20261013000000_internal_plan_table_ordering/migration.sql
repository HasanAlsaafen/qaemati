-- Restaurants created before billing sit on the internal unlimited plan, which
-- should include everything, table ordering too.
UPDATE "Plan"
SET "features" = array_append("features", 'tableOrdering')
WHERE "id" = 'plan_internal' AND NOT ('tableOrdering' = ANY("features"));
