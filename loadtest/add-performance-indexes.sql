-- Migration: AddPerformanceIndexes
-- Hot-path indexes for GET /projects/{id}/tickets and POST /tickets

-- GET tickets sorted by receivedAt (default) with cursor pagination
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_tickets_project_received_cursor
    ON tickets (project_id, received_at DESC, id);

-- GET tickets sorted by reportedAt with cursor pagination (NULLs sort after non-NULL)
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_tickets_project_reported_cursor
    ON tickets (project_id, reported_at DESC NULLS LAST, id);

-- GET tickets filtered by status within a project
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_tickets_project_status
    ON tickets (project_id, status)
    WHERE status != 'Deleted';

-- Full-text search on description (GIN trigram for ILIKE %...%)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_tickets_description_trgm
    ON tickets USING gin (description gin_trgm_ops);

-- POST /tickets: fast origin lookup per project
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_project_origins_project
    ON project_origins (project_id);

-- POST /tickets: fast sanitization rules lookup (enabled only)
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_sanitization_rules_project_enabled
    ON sanitization_rules (project_id)
    WHERE is_enabled = true;
