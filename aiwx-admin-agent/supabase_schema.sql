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

