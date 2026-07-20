# Lovable.ai Master Prompt Spec: Scaffolding the CONVERGENCE-Ai Agentic Execution Loop
### Platform: CONVERGENCE-Ai Deployed Suites | Class: Backend & Database Orchestration | Version: 1.0
#### Purpose: High-Fidelity Copy-Pasteable Prompt to Direct Lovable.ai to Build the Core Agent Loop

Use this document to direct **Lovable.ai** (or your preferred AI development companion) to scaffold the missing **Agentic Execution Loop**—the keystone that transforms your dashboard interface into a fully functional, self-hosted, private AI operations assistant.

---

## Part 1: Strategic Validation Message & Core Framework

Copy and paste this direct instruction into Lovable.ai to initiate the execution loop scaffolding.

```text
Yes! Your assessment of what is in place vs. what is missing is 100% correct and incredibly accurate. The UI panels look beautiful, but we now need to build the "Keystone"—the actual Agentic Execution Loop, the Supabase schema extensions, the Deno Edge Functions, and the real-time Human-in-the-Loop (HITL) review queue.

Please proceed to scaffold and build Phase 1 (The Core Execution Loop) and Phase 2 (Specific Agent Pipelines) step-by-step using the following strict database DDL blueprints, Edge Function specs, and React UI layout guides.

Maintain our strict branding guidelines: Space Grotesk (headers), Inter (body), Brilliant Electric Blue (#0084ff), and Sky Blue/Cyan Sparkles (#00c6ff) theme overlays, with NO gold/yellow accents.
```

---

## Part 2: Phase 1 — Supabase Database Schema Extensions (DDL Prompt)

Feed this database prompt to Lovable.ai to execute the necessary SQL schema updates:

```text
Please run or generate a Supabase SQL Migration to create the missing database schemas, enable Row-Level Security (RLS), and add columns for our agentic loop:

-- 1. Extend the existing agent_tasks table
ALTER TABLE agent_tasks 
ADD COLUMN IF NOT EXISTS error_message TEXT,
ADD COLUMN IF NOT EXISTS tool_calls JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS tokens_used INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS latency_ms INTEGER DEFAULT 0;

-- 2. Create the agents registry table
CREATE TABLE IF NOT EXISTS agents (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    system_prompt TEXT NOT NULL,
    model TEXT NOT NULL DEFAULT 'gpt-4o',
    tools JSONB DEFAULT '[]'::jsonb,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Create the agent_logs / observability table
CREATE TABLE IF NOT EXISTS agent_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    task_id UUID REFERENCES agent_tasks(id) ON DELETE CASCADE,
    agent_name TEXT NOT NULL,
    log_level TEXT NOT NULL DEFAULT 'info', -- 'info', 'warn', 'error', 'agent'
    message TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Create the admin audit log (Who approved what, when)
CREATE TABLE IF NOT EXISTS admin_audit_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    task_id UUID REFERENCES agent_tasks(id) ON DELETE SET NULL,
    admin_id UUID REFERENCES auth.users(id),
    action TEXT NOT NULL, -- 'approved', 'rejected_revision', 'override'
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Enable RLS and setup Security Policies
ALTER TABLE agents ENABLE ROW_LEVEL SECURITY;
ALTER TABLE agent_logs ENABLE ROW_LEVEL SECURITY;
ALTER TABLE admin_audit_log ENABLE ROW_LEVEL SECURITY;

-- 6. Setup basic read policies (Select matching tenant/business context)
CREATE POLICY "Allow read access to agents for authenticated users" 
ON agents FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow read access to logs for authenticated users" 
ON agent_logs FOR SELECT TO authenticated USING (true);

-- 7. Add agent_tasks to Supabase Realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE agent_tasks;
```

---

## Part 3: Phase 2 — The Supabase Deno Edge Function (`run-agent` Pipeline)

Feed this specification to Lovable.ai to implement the serverless reasoning loop:

```text
Please build the core "run-agent" Supabase Deno Edge Function. This function executes the serverless reasoning loop, parses pending tasks, calls the LLM (GPT-4o), and writes outputs back.

### Functional Mechanics of the Edge Function:
1. **Triggering**: Triggered either via a database webhook on `agent_tasks` insertion (`status = 'pending'`), or direct HTTP POST requests from the client UI.
2. **State Transition**:
   - Updates `agent_tasks.status` to `'running'`.
   - Starts a latency timer.
3. **Execution Loop**:
   - Reads the task type (`task_type`) and queries the `agents` registry table to fetch the designated agent's `system_prompt` and tool schemas.
   - Formats the prompt using client-context inputs (`input_text`).
   - Dispatches a payload to the LLM (OpenAI API or Claude API).
4. **Log Streams**:
   - Streams live, emulated logs to the `agent_logs` table (writing log levels `'info'`, `'agent'`, and `'success'`) to feed the client’s real-time terminal window.
5. **Human-in-the-Loop (HITL) Intercept**:
   - If the task requires high-risk client-facing output (e.g. sending a Stripe invoice or email), the Edge Function formats the LLM output draft, sets `confidence_score` (between 0.0 and 1.0), and shifts `status` to `'needs_review'`, pausing execution.
   - If the task is standard automation (e.g. simple FAQ match), the function completes the task and sets `status = 'completed'`.
6. **Error Handling**:
   - Wraps the loop in a try-catch block. If execution fails, sets `status = 'failed'`, records `error_message`, and writes an `'error'` log entry.
```

---

## Part 4: Phase 3 — React Task Submission & Review UI (`AdminTaskHub.tsx`)

Feed this visual specification to Lovable.ai to wire up the frontend to the real-time Supabase tables:

```text
Please redesign and wire up the "AdminTaskHub.tsx" component to connect to live Supabase tables with real-time feedback:

### 1. Unified Real-Time Subscription
Use `supabase.channel` to subscribe to real-time shifts on the `agent_tasks` and `agent_logs` tables. 
- The UI list must instantly refresh when a task's status transitions (`pending` -> `running` -> `needs_review` -> `completed` / `failed`).
- The log console terminal must print incoming `agent_logs` lines as they are written in real-time.

---

### 2. Task Submission Dashboard
- Provide a form to select a vertical (e.g. Medical, Legal, Real Estate), input a text request, and click **"Submit Task to Agent"**.
- Submitting the form inserts a row in `agent_tasks` with `status = 'pending'`, which instantly initiates the `run-agent` Edge Function.

---

### 3. Split Review Queue (Tabs)
Provide a tabbed interface to separate tasks by state:
- **Pending/Running Queue**: Displays tasks currently being evaluated by the serverless LLM. Renders a pulsing sky-blue scanner light.
- **Review Queue (HITL)**: Displays tasks in `needs_review` state.
  - Render an interactive card detailing the LLM draft, the confidence score, and the target action (e.g. "Release ACH Payout").
  - Provide two prominent buttons:
    1.  `Approve & Release` (glowing green success): Calls Supabase to set `status = 'completed'`, inserts an audit log row into `admin_audit_log`, and resumes the process flow.
    2.  `Request Revision` (cyan/red border): Opens an input box to provide revision notes, sets `status = 'pending'`, and triggers the Edge Function to re-draft.
- **Completed Archive**: Displays historical finished tasks.
```
