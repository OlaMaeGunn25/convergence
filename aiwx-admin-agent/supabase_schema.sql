-- =========================================================================
-- "AIWX Operations Administrator™" by CONVERGENCE-Ai Production Database Migration Schema
-- Product Owner: convergence-ai.com | Version: 2.0 | PROPRIETARY
-- Targets: PostgreSQL (Supabase) Database Setup
-- =========================================================================

-- Enable uuid-ossp extension for generating UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Create Tenant Configurations Table (Rebranding, colors, credentials vault)
CREATE TABLE IF NOT EXISTS tenant_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_name VARCHAR(255) NOT NULL,
    vertical VARCHAR(50) NOT NULL,
    logo_text VARCHAR(50) DEFAULT 'OPS',
    primary_color VARCHAR(7) DEFAULT '#0b57d0',     -- Theme Cobalt Blue
    secondary_color VARCHAR(7) DEFAULT '#f1b31c',   -- Theme Amber Gold
    api_endpoint TEXT,
    vault_key TEXT,                                 -- Encrypted credentials KMS block
    upskill_matrix BOOLEAN DEFAULT FALSE,           -- Premium upskilling flag
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row-Level Security for tenant isolation
ALTER TABLE tenant_configs ENABLE ROW LEVEL SECURITY;

-- Create Policy: Users can only read/write their own tenant config
-- Note: In a production OAuth system, we validate auth.uid() matching a metadata tenant field.
-- For a lightweight multi-tenant client API validation:
CREATE POLICY tenant_isolation_policy ON tenant_configs
    FOR ALL
    USING (id = (coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb -> 'user_metadata' ->> 'tenant_id')::uuid)
    WITH CHECK (id = (coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb -> 'user_metadata' ->> 'tenant_id')::uuid);

-- 2. Create HITL Queue Table (Human-in-the-loop task lists)
CREATE TABLE IF NOT EXISTS hitl_queue (
    id VARCHAR(50) PRIMARY KEY,                    -- e.g. T-1002, CP-2001, etc.
    tenant_id UUID REFERENCES tenant_configs(id) ON DELETE CASCADE,
    vertical VARCHAR(50) NOT NULL,
    task_type VARCHAR(100) NOT NULL,
    details TEXT,
    status VARCHAR(20) DEFAULT 'pending',           -- 'pending', 'approved', 'revised', 'frozen'
    action_code TEXT,                               -- Action trigger mapping (e.g. n8n trigger)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS on HITL Queue
ALTER TABLE hitl_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY hitl_queue_isolation_policy ON hitl_queue
    FOR ALL
    USING (tenant_id = (coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb -> 'user_metadata' ->> 'tenant_id')::uuid)
    WITH CHECK (tenant_id = (coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb -> 'user_metadata' ->> 'tenant_id')::uuid);

-- 3. Indexes for Optimized Fetching
CREATE INDEX IF NOT EXISTS idx_tenant_configs_company ON tenant_configs(company_name);
CREATE INDEX IF NOT EXISTS idx_hitl_queue_tenant ON hitl_queue(tenant_id);
CREATE INDEX IF NOT EXISTS idx_hitl_queue_status ON hitl_queue(status);
CREATE INDEX IF NOT EXISTS idx_hitl_queue_vertical ON hitl_queue(vertical);

-- 4. Initial Seed Data (CONVERGENCE-Ai Agency Demo Data)
-- This creates the initial bypass profile when client name is "CONVERGENCE-Ai"
INSERT INTO tenant_configs (id, company_name, vertical, logo_text, primary_color, secondary_color, api_endpoint, vault_key, upskill_matrix)
VALUES (
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', -- Static UUID for Demo
    'AIWX Operations Administrator: A Cloud-Native AI Operations Hub.',
    'medical',
    'CONV',
    '#0b57d0',
    '#f1b31c',
    'https://api.convergence-ai.com/v1',
    'ops_kms_vault_secret_key_dsi_six_sigma',
    true
)
ON CONFLICT (id) DO NOTHING;

-- Seed pending tasks for the demo profile
INSERT INTO hitl_queue (id, tenant_id, vertical, task_type, details, status, action_code)
VALUES 
    ('T-1002', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'medical', 'Patient Scheduling Dispute', 'Fielded patient dispute call. Automatically reschedule Dr. Aris''s 3:00 PM surgery appointment with Patient Sarah Davis to Tuesday at 10:00 AM.', 'pending', 'Reschedule Calendar & Email Confirmation'),
    ('T-1003', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'finance', 'Procure-to-Pay Invoice', 'Supplier invoice received from Acmax Corp. Amount: $4,850.00. Match status: PO #8893 matched. Ready for ledger posting and ACH release.', 'pending', 'Release ACH Payment & Post to QuickBooks'),
    ('T-1004', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'logistics', 'Travel Flight Routing', 'Booking flight route JFK to LAX for Exec John Miller. Carrier: Delta Flight DL42. Price: $620.00. Expense report draft prepared.', 'pending', 'Purchase Flight Ticket & Send Invoice'),
    ('T-1005', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'realestate', 'Lead Follow-up Draft', 'Drafted follow-up contract and appointment confirmation email for buyer of 450 Maple Avenue.', 'pending', 'Send Email & Schedule Home Showing'),
    ('T-1006', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'professional', 'Social Post Release Audit', 'Drafted LinkedIn educational post for Tier 1 AI Starter Sprint. Verified SEO keywords (''AI for small business'', ''business automation'') and platform spacing. Ready for publish.', 'pending', 'Release to LinkedIn, Instagram, and Threads')
ON CONFLICT (id) DO NOTHING;

-- 5. Analytics Telemetry Logging Table
CREATE TABLE IF NOT EXISTS task_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    task_id TEXT NOT NULL,
    action TEXT NOT NULL,        -- 'approved', 'rejected', 'auto_resolved'
    vertical TEXT,
    integration TEXT,
    duration_ms INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on task_events
ALTER TABLE task_events ENABLE ROW LEVEL SECURITY;

-- RLS Isolation Policy for task_events based on JWT claim tenant_id
CREATE POLICY task_events_isolation_policy ON task_events
    FOR ALL
    USING (tenant_id = (coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb -> 'user_metadata' ->> 'tenant_id')::text)
    WITH CHECK (tenant_id = (coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb -> 'user_metadata' ->> 'tenant_id')::text);

-- Index for analytics querying
CREATE INDEX IF NOT EXISTS idx_task_events_tenant ON task_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_task_events_created ON task_events(created_at);

-- 6. Admin Users Table (For server-backed Super Admin bypass verification)
CREATE TABLE IF NOT EXISTS admin_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS on admin_users
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Policy: Admin users can view the admin user records if authenticated
CREATE POLICY admin_read_policy ON admin_users
    FOR SELECT
    USING (true);

-- Seed initial admin user
INSERT INTO admin_users (email)
VALUES ('admin@convergence-ai.com')
ON CONFLICT (email) DO NOTHING;

-- 7. Knowledge Base Table (For ingested SOP training rules RAG vectors)
CREATE TABLE IF NOT EXISTS knowledge_base (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenant_configs(id) ON DELETE CASCADE,
    category VARCHAR(100) NOT NULL,
    content TEXT NOT NULL,
    vector_status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'processing', 'processed'
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS on knowledge_base
ALTER TABLE knowledge_base ENABLE ROW LEVEL SECURITY;

-- RLS Isolation Policy for knowledge_base
CREATE POLICY knowledge_base_isolation_policy ON knowledge_base
    FOR ALL
    USING (tenant_id = (coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb -> 'user_metadata' ->> 'tenant_id')::uuid)
    WITH CHECK (tenant_id = (coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb -> 'user_metadata' ->> 'tenant_id')::uuid);

CREATE INDEX IF NOT EXISTS idx_knowledge_base_tenant ON knowledge_base(tenant_id);


-- 8. Immutable Audit Trail (governance layer)
-- Records who did what, when, and with what outcome for every governed mutation
-- and HITL decision across the gateway and admin orchestrator. Written by
-- aiwx-smb-auditor/lib/audit.js and the admin HITL action handler.
CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actor TEXT NOT NULL,                 -- authenticated identity (API key actor / admin email)
    role TEXT,                           -- 'operator' | 'viewer' | admin role
    action TEXT NOT NULL,                -- e.g. 'audit.run', 'post.publish', 'crm.export', 'hitl.action'
    resource TEXT,                       -- target (domain, post id, task id, ...)
    outcome TEXT NOT NULL DEFAULT 'success', -- 'success' | 'failure' | 'pending'
    status INTEGER,                      -- HTTP status, if applicable
    ip TEXT,
    tenant_id UUID,                      -- owning tenant, when known
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_audit_log_ts ON audit_log(ts);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON audit_log(actor);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_tenant ON audit_log(tenant_id);

-- Audit rows are append-only. Enable RLS; reads are tenant-scoped, and there is
-- deliberately no UPDATE/DELETE policy so entries cannot be mutated via the API.
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_log_read_policy ON audit_log
    FOR SELECT
    USING (
        tenant_id IS NULL
        OR tenant_id = (coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb -> 'user_metadata' ->> 'tenant_id')::uuid
    );
CREATE POLICY audit_log_insert_policy ON audit_log
    FOR INSERT
    WITH CHECK (true);

-- =========================================================================
-- 9. CAMPAIGN SCHEDULER  (replaces aiwx-social-media-agent/config/campaign_schedule.json)
-- =========================================================================
-- The JSON file was read-modify-written by three concurrent writers — the
-- in-process scheduler loop in aiwx-smb-auditor/server.js, the standalone
-- scheduler_daemon.js, and the campaign REST endpoints — with no locking, so a
-- post could be claimed and published twice, or a status write could be lost.
-- Post rows now carry their own status and are claimed atomically (see
-- claim_due_campaign_posts below).

-- Singleton row holding the global on/off switch the JSON file kept as
-- `schedulerActive`. The CHECK on the primary key permits exactly one row.
CREATE TABLE IF NOT EXISTS campaign_schedule_state (
    id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),
    scheduler_active BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO campaign_schedule_state (id, scheduler_active)
VALUES (TRUE, FALSE)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS campaign_posts (
    id TEXT PRIMARY KEY,                       -- e.g. post_01 (authored upstream)
    tenant_id UUID REFERENCES tenant_configs(id) ON DELETE CASCADE,
    platform TEXT NOT NULL,
    scheduled_date TEXT,                       -- authored date, 'YYYY-MM-DD'
    scheduled_time TEXT,                       -- authored time, e.g. '10:00 AM EST'
    scheduled_at TIMESTAMPTZ,                  -- resolved absolute instant; authoritative for due-ness
    text TEXT,
    image TEXT,
    status TEXT NOT NULL DEFAULT 'APPROVED',   -- PENDING|APPROVED|PUBLISHING|PUBLISHED|FAILED|REJECTED
    hitl_task_id VARCHAR(50) REFERENCES hitl_queue(id) ON DELETE SET NULL,
    error TEXT,
    logs TEXT,
    screenshot TEXT,
    claimed_at TIMESTAMPTZ,                    -- when a worker took ownership
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Partial index: the scheduler only ever scans for due, still-approved posts.
CREATE INDEX IF NOT EXISTS idx_campaign_posts_due
    ON campaign_posts(scheduled_at)
    WHERE status = 'APPROVED';
CREATE INDEX IF NOT EXISTS idx_campaign_posts_status ON campaign_posts(status);
CREATE INDEX IF NOT EXISTS idx_campaign_posts_tenant ON campaign_posts(tenant_id);

ALTER TABLE campaign_posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS campaign_posts_isolation_policy ON campaign_posts;
CREATE POLICY campaign_posts_isolation_policy ON campaign_posts
    FOR ALL
    USING (
        tenant_id IS NULL
        OR tenant_id = (coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb -> 'user_metadata' ->> 'tenant_id')::uuid
    )
    WITH CHECK (
        tenant_id IS NULL
        OR tenant_id = (coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb -> 'user_metadata' ->> 'tenant_id')::uuid
    );

-- -------------------------------------------------------------------------
-- claim_due_campaign_posts — the race fix.
--
-- Atomically flips every due, APPROVED post to PUBLISHING and returns the rows
-- it actually claimed. SKIP LOCKED means a second scheduler running the same
-- statement concurrently silently passes over rows the first one is holding
-- rather than blocking or double-claiming them, so the server loop and the
-- standalone daemon can both run without coordinating.
--
-- p_exclude_platforms preserves the existing split in behaviour: server.js
-- skips LinkedIn (published by a separate flow), scheduler_daemon.js does not.
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION claim_due_campaign_posts(
    p_limit INT DEFAULT 10,
    p_exclude_platforms TEXT[] DEFAULT ARRAY[]::TEXT[]
)
RETURNS SETOF campaign_posts
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    UPDATE campaign_posts p
       SET status     = 'PUBLISHING',
           claimed_at = NOW(),
           updated_at = NOW()
     WHERE p.id IN (
         SELECT c.id
           FROM campaign_posts c
          WHERE c.status = 'APPROVED'
            AND c.scheduled_at IS NOT NULL
            AND c.scheduled_at <= NOW()
            AND NOT (lower(c.platform) = ANY (
                SELECT lower(x) FROM unnest(p_exclude_platforms) AS x
            ))
            AND EXISTS (
                SELECT 1 FROM campaign_schedule_state s
                 WHERE s.id AND s.scheduler_active
            )
          ORDER BY c.scheduled_at
          FOR UPDATE OF c SKIP LOCKED
          LIMIT p_limit
     )
    RETURNING p.*;
END;
$$;

-- Terminal transitions for a claimed post. Writing the whole outcome in one
-- statement removes the read-modify-write the callbacks used to do.
CREATE OR REPLACE FUNCTION complete_campaign_post(
    p_id TEXT,
    p_success BOOLEAN,
    p_error TEXT DEFAULT NULL,
    p_logs TEXT DEFAULT NULL,
    p_screenshot TEXT DEFAULT NULL
)
RETURNS SETOF campaign_posts
LANGUAGE sql
AS $$
    UPDATE campaign_posts
       SET status       = CASE WHEN p_success THEN 'PUBLISHED' ELSE 'FAILED' END,
           error        = CASE WHEN p_success THEN NULL ELSE p_error END,
           logs         = COALESCE(p_logs, logs),
           screenshot   = COALESCE(p_screenshot, screenshot),
           published_at = CASE WHEN p_success THEN NOW() ELSE published_at END,
           updated_at   = NOW()
     WHERE id = p_id
    RETURNING *;
$$;

-- Requeue posts a crashed worker left stranded in PUBLISHING. Without this a
-- process that dies mid-publish would strand the post forever, since only the
-- claiming worker ever writes the terminal status.
CREATE OR REPLACE FUNCTION requeue_stale_campaign_posts(p_stale_after INTERVAL DEFAULT '30 minutes')
RETURNS SETOF campaign_posts
LANGUAGE sql
AS $$
    UPDATE campaign_posts
       SET status = 'APPROVED', claimed_at = NULL, updated_at = NOW()
     WHERE status = 'PUBLISHING'
       AND claimed_at IS NOT NULL
       AND claimed_at < NOW() - p_stale_after
    RETURNING *;
$$;

-- -------------------------------------------------------------------------
-- HITL unification: a campaign post awaiting human release is represented by a
-- row in the shared hitl_queue (the same queue the admin console already
-- renders and acts on — see the seeded 'Social Post Release Audit' task). This
-- trigger propagates the admin's decision back onto the linked post, so
-- aiwx-admin-agent/server/index.js needs no changes: its existing PATCH of
-- hitl_queue.status releases or rejects the post.
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sync_hitl_decision_to_campaign_post()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
        UPDATE campaign_posts
           SET status = CASE
                            WHEN NEW.status = 'approved' THEN 'APPROVED'
                            WHEN NEW.status = 'revised'  THEN 'REJECTED'
                            ELSE status
                        END,
               updated_at = NOW()
         WHERE hitl_task_id = NEW.id
           AND status = 'PENDING';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_hitl_decision_to_campaign_post ON hitl_queue;
CREATE TRIGGER trg_hitl_decision_to_campaign_post
    AFTER UPDATE OF status ON hitl_queue
    FOR EACH ROW
    EXECUTE FUNCTION sync_hitl_decision_to_campaign_post();

-- =========================================================================
-- 10. ACTIVITY ALERTS  (replaces aiwx-social-media-agent/config/activity_alerts.json)
-- =========================================================================
-- Resolving or replying to an alert used to rewrite the entire array, so two
-- operators acting at once could drop each other's reply. Each alert is now its
-- own row and each action is a single-row UPDATE.
CREATE TABLE IF NOT EXISTS activity_alerts (
    id TEXT PRIMARY KEY,
    tenant_id UUID REFERENCES tenant_configs(id) ON DELETE CASCADE,
    platform TEXT NOT NULL,
    user_name TEXT,
    user_handle TEXT,
    avatar TEXT,
    post_id TEXT,
    post_title TEXT,
    comment_text TEXT,
    ai_draft TEXT,
    reply_text TEXT,
    status TEXT NOT NULL DEFAULT 'UNRESOLVED',   -- UNRESOLVED | RESOLVED | REPLIED
    replied_at TIMESTAMPTZ,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_alerts_status ON activity_alerts(status);
CREATE INDEX IF NOT EXISTS idx_activity_alerts_ts ON activity_alerts(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_activity_alerts_tenant ON activity_alerts(tenant_id);

ALTER TABLE activity_alerts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS activity_alerts_isolation_policy ON activity_alerts;
CREATE POLICY activity_alerts_isolation_policy ON activity_alerts
    FOR ALL
    USING (
        tenant_id IS NULL
        OR tenant_id = (coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb -> 'user_metadata' ->> 'tenant_id')::uuid
    )
    WITH CHECK (
        tenant_id IS NULL
        OR tenant_id = (coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb -> 'user_metadata' ->> 'tenant_id')::uuid
    );

-- =========================================================================
-- 11. AUTOMATED AUDIT QUEUE  (replaces aiwx-smb-auditor/config/audit_queue.json)
-- =========================================================================
CREATE TABLE IF NOT EXISTS audit_queue_state (
    id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),
    active BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO audit_queue_state (id, active)
VALUES (TRUE, FALSE)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS audit_queue_jobs (
    id TEXT PRIMARY KEY,
    tenant_id UUID REFERENCES tenant_configs(id) ON DELETE CASCADE,
    domain TEXT NOT NULL,
    vertical TEXT,
    status TEXT NOT NULL DEFAULT 'queued',    -- queued | running | completed | failed
    error TEXT,
    attempts INT NOT NULL DEFAULT 0,
    queued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);

-- Enforces the "don't enqueue a domain that's already waiting" rule the JSON
-- version checked in application code, where the check and the append were not
-- atomic and so admitted duplicates under concurrent POSTs.
CREATE UNIQUE INDEX IF NOT EXISTS idx_audit_queue_jobs_unique_queued
    ON audit_queue_jobs(domain)
    WHERE status = 'queued';
CREATE INDEX IF NOT EXISTS idx_audit_queue_jobs_claim
    ON audit_queue_jobs(queued_at)
    WHERE status = 'queued';

ALTER TABLE audit_queue_jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS audit_queue_jobs_isolation_policy ON audit_queue_jobs;
CREATE POLICY audit_queue_jobs_isolation_policy ON audit_queue_jobs
    FOR ALL
    USING (
        tenant_id IS NULL
        OR tenant_id = (coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb -> 'user_metadata' ->> 'tenant_id')::uuid
    )
    WITH CHECK (
        tenant_id IS NULL
        OR tenant_id = (coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb -> 'user_metadata' ->> 'tenant_id')::uuid
    );

-- Claim exactly one queued job. SKIP LOCKED lets several auditor instances run
-- the loop concurrently: each gets a different job, none blocks, none repeats.
CREATE OR REPLACE FUNCTION claim_next_audit_job()
RETURNS SETOF audit_queue_jobs
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    UPDATE audit_queue_jobs j
       SET status     = 'running',
           started_at = NOW(),
           attempts   = j.attempts + 1
     WHERE j.id = (
         SELECT q.id
           FROM audit_queue_jobs q
          WHERE q.status = 'queued'
            AND EXISTS (
                SELECT 1 FROM audit_queue_state s WHERE s.id AND s.active
            )
          ORDER BY q.queued_at
          FOR UPDATE OF q SKIP LOCKED
          LIMIT 1
     )
    RETURNING j.*;
END;
$$;

CREATE OR REPLACE FUNCTION complete_audit_job(
    p_id TEXT,
    p_success BOOLEAN,
    p_error TEXT DEFAULT NULL
)
RETURNS SETOF audit_queue_jobs
LANGUAGE sql
AS $$
    UPDATE audit_queue_jobs
       SET status       = CASE WHEN p_success THEN 'completed' ELSE 'failed' END,
           error        = CASE WHEN p_success THEN NULL ELSE p_error END,
           completed_at = NOW()
     WHERE id = p_id
    RETURNING *;
$$;

-- Same crash-recovery guard as the campaign posts: a job whose worker died
-- stays 'running' forever otherwise.
CREATE OR REPLACE FUNCTION requeue_stale_audit_jobs(p_stale_after INTERVAL DEFAULT '30 minutes')
RETURNS SETOF audit_queue_jobs
LANGUAGE sql
AS $$
    UPDATE audit_queue_jobs
       SET status = 'queued', started_at = NULL
     WHERE status = 'running'
       AND started_at IS NOT NULL
       AND started_at < NOW() - p_stale_after
    RETURNING *;
$$;

-- The claim/complete functions are the only supported way to transition a job
-- or post out of its waiting state; they run with the caller's privileges so the
-- RLS policies above still apply to non-service-role connections.

-- =========================================================================
-- GOVERNANCE NOTE — Row-Level Security vs. the service-role key
-- =========================================================================
-- The RLS policies above are enforced ONLY for connections that carry an
-- end-user JWT (Supabase anon/authenticated keys). The application servers
-- currently connect with the SERVICE-ROLE key, which BYPASSES RLS entirely.
-- Therefore, with the current connection model, tenant isolation is enforced at
-- the APPLICATION layer (explicit tenant_id filters), not by these policies.
--
-- To make RLS actually govern app traffic (recommended, Phase-2b), do ONE of:
--   (a) Connect with a per-user/anon JWT that carries user_metadata.tenant_id,
--       so the policies fire; OR
--   (b) Before each query on the service-role connection, scope the session:
--         SELECT set_config('request.jwt.claims',
--                json_build_object('user_metadata',
--                  json_build_object('tenant_id', <tenant>))::text, true);
--       so current_setting('request.jwt.claims') resolves per request; OR
--   (c) Route all tenant data access through a single data-access module that
--       appends `.eq('tenant_id', ctx.tenantId)` to every query (belt-and-braces
--       even once (a)/(b) is in place).
-- Until then, treat service-role queries as trusted-but-unscoped and rely on the
-- application tenant guard.

