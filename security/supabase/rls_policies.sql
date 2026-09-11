-- Convergence-Ai — Row-Level Security policies (CURRENT deployment: Lovable.ai + Supabase)
--
-- RLS is the DETERMINISTIC BOLA / principal-to-object boundary for the live deployment.
-- It is the boundary that holds when an agent is co-opted by a prompt injection: even if
-- the model is tricked into asking for another tenant's row, Postgres refuses the read.
-- This mirrors security/opa/bola_guard.rego, which enforces the same logic at the Agent
-- Gateway on the GCP/AWS targets. The two must stay in agreement.
--
-- Model: every tenant-scoped table carries tenant_id. auth.jwt() carries the authenticated
-- principal's tenant_id and role. The browser holds only the anon key; the service-role key
-- (which bypasses RLS) is used ONLY server-side inside edge functions, never shipped to the client.

-- Helper: the authenticated principal's tenant, taken from the verified JWT.
create or replace function auth_tenant_id() returns text
  language sql stable as $$
    select coalesce(auth.jwt() ->> 'tenant_id', '')
$$;

create or replace function auth_role() returns text
  language sql stable as $$
    select coalesce(auth.jwt() ->> 'app_role', 'member')
$$;

-- ---------------------------------------------------------------------------
-- Tenant-scoped tables: default-deny, then allow only same-tenant rows.
-- Apply this pattern to every tenant table (tasks, connections, kb, agents, ...).
-- ---------------------------------------------------------------------------
alter table if exists public.tasks       enable row level security;
alter table if exists public.connections enable row level security;
alter table if exists public.kb          enable row level security;
alter table if exists public.agents      enable row level security;
alter table if exists public.hitl_queue  enable row level security;

-- TASKS ---------------------------------------------------------------------
drop policy if exists tasks_tenant_isolation on public.tasks;
create policy tasks_tenant_isolation on public.tasks
  for all
  using      (tenant_id = auth_tenant_id())   -- no cross-tenant read
  with check (tenant_id = auth_tenant_id());   -- no cross-tenant write

-- CONNECTIONS (holds connector state; credentials live in Vault, referenced only) ----
drop policy if exists connections_tenant_isolation on public.connections;
create policy connections_tenant_isolation on public.connections
  for all
  using      (tenant_id = auth_tenant_id())
  with check (tenant_id = auth_tenant_id());

-- KB / RAG ------------------------------------------------------------------
drop policy if exists kb_tenant_isolation on public.kb;
create policy kb_tenant_isolation on public.kb
  for all
  using      (tenant_id = auth_tenant_id())
  with check (tenant_id = auth_tenant_id());

-- AGENTS --------------------------------------------------------------------
drop policy if exists agents_tenant_isolation on public.agents;
create policy agents_tenant_isolation on public.agents
  for all
  using      (tenant_id = auth_tenant_id())
  with check (tenant_id = auth_tenant_id());

-- HITL QUEUE: read within tenant; approvals gated so the requester cannot self-approve.
drop policy if exists hitl_read on public.hitl_queue;
create policy hitl_read on public.hitl_queue
  for select using (tenant_id = auth_tenant_id());

drop policy if exists hitl_approve on public.hitl_queue;
create policy hitl_approve on public.hitl_queue
  for update
  using  (tenant_id = auth_tenant_id() and auth_role() in ('approver','admin'))
  with check (
    tenant_id = auth_tenant_id()
    and requested_by <> auth.uid()   -- segregation of duties: no self-approval
  );

-- ---------------------------------------------------------------------------
-- audit_log: append-only, tenant-readable, never updatable or deletable by clients.
-- The evidence trail every security decision writes (allow AND block).
-- ---------------------------------------------------------------------------
alter table if exists public.audit_log enable row level security;

drop policy if exists audit_insert on public.audit_log;
create policy audit_insert on public.audit_log
  for insert with check (tenant_id = auth_tenant_id());

drop policy if exists audit_read on public.audit_log;
create policy audit_read on public.audit_log
  for select using (tenant_id = auth_tenant_id());

-- No UPDATE or DELETE policy exists -> RLS denies both for all non-service roles,
-- making the audit trail append-only for tenants. Revoke direct mutation too:
revoke update, delete on public.audit_log from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Verification: RLS must be ENABLED on every tenant table. CI asserts this
-- (see .github/workflows/agentic-security.yml -> rls-check). A tenant table
-- without RLS is a build-failing gap, never a silent default.
-- ---------------------------------------------------------------------------
