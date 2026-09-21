-- EXPLAIN ANALYZE for hot queries — run after seeding 10k tickets
-- Replace '<project-id>' with the actual UUID of the demo project

-- 1. GET tickets (default sort: receivedAt DESC, cursor pagination)
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT id, description, status, page, received_at, reported_at, browser_name, device_type
FROM tickets
WHERE project_id = '<project-id>'
  AND status != 'Deleted'
ORDER BY received_at DESC, id
LIMIT 50;

-- 2. GET tickets with status filter
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT id, description, status, page, received_at, reported_at, browser_name, device_type
FROM tickets
WHERE project_id = '<project-id>'
  AND status = 'New'
ORDER BY received_at DESC, id
LIMIT 50;

-- 3. GET tickets with text search
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT id, description, status, page, received_at, reported_at, browser_name, device_type
FROM tickets
WHERE project_id = '<project-id>'
  AND description ILIKE '%koszyk%'
ORDER BY received_at DESC, id
LIMIT 50;

-- 4. GET tickets: COUNT for withTotal=true
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT count(*)
FROM tickets
WHERE project_id = '<project-id>'
  AND status != 'Deleted';

-- 5. POST /tickets: origin check
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT 1
FROM project_origins
WHERE project_id = '<project-id>'
  AND lower(origin) = lower('http://127.0.0.1:5500')
LIMIT 1;

-- 6. POST /tickets: sanitization rules
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT id, project_id, pattern, replacement, is_enabled
FROM sanitization_rules
WHERE (project_id = '<project-id>' OR project_id IS NULL)
  AND is_enabled = true
ORDER BY project_id NULLS LAST;
