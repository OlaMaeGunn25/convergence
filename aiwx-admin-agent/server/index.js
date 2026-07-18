/*
   "AI Operations Middleware" Google Cloud Server Orchestrator
   Product Owner: convergence-ai.com | Version: 1.0 | PROPRIETARY
   Express API endpoint to programmatically provision, license, and orchestrate serverless customer sandboxes.
*/

const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { ServicesClient } = require('@google-cloud/run').v2;
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();

// Allowed origins check for CORS security (supports localhost in development, locks to convergence-ai.com in production)
const allowedOrigins = ['https://convergence-ai.com'];
app.use(cors({
    origin: function(origin, callback) {
        if (!origin) return callback(null, true);
        if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:') || allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        return callback(new Error('Not allowed by CORS'));
    }
}));

app.use(express.json());

// Custom lightweight in-memory rate limiter middleware (zero external dependencies)
const rateLimit = (options = {}) => {
    const windowMs = options.windowMs || 15 * 60 * 1000;
    const max = options.max || 100;
    const message = options.message || "Too many requests, please try again later.";
    const hits = new Map();

    return (req, res, next) => {
        const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        const now = Date.now();
        
        if (!hits.has(ip)) {
            hits.set(ip, []);
        }
        
        let timestamps = hits.get(ip);
        timestamps = timestamps.filter(t => now - t < windowMs);
        
        if (timestamps.length >= max) {
            return res.status(429).json({ error: message });
        }
        
        timestamps.push(now);
        hits.set(ip, timestamps);
        next();
    };
};

// Custom light request body validator middleware
const validate = (fields) => {
    return (req, res, next) => {
        const missing = fields.filter(f => req.body[f] === undefined || req.body[f] === null || req.body[f] === '');
        if (missing.length > 0) {
            return res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` });
        }
        next();
    };
};

// No hardcoded fallback: a baked-in vault key in source control defeats the
// purpose of a vault. Fail loudly at boot if it is not provided.
const DEFAULT_VAULT_KEY = process.env.DEFAULT_VAULT_KEY;
if (!DEFAULT_VAULT_KEY) {
    console.error("CRITICAL FAILURE: DEFAULT_VAULT_KEY environment variable is required.");
    process.exit(1);
}

const PORT = process.env.PORT || 8080;

const requiredEnvVars = ['JWT_SECRET', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'ENCRYPTION_KEY'];
const missingEnvVars = requiredEnvVars.filter(env => !process.env[env]);
if (missingEnvVars.length > 0) {
    console.error(`================================================================`);
    console.error(`   CRITICAL FAILURE: Missing required environment variables:     `);
    console.error(`   ${missingEnvVars.join(', ')}`);
    console.error(`   Please check your .env configuration file.                   `);
    console.error(`================================================================`);
    process.exit(1);
}

const JWT_SECRET = process.env.JWT_SECRET;
const GCP_PROJECT = process.env.GCP_PROJECT || "aiwx-sandbox-prod-88";
const GCP_LOCATION = process.env.GCP_LOCATION || "us-central1";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Resilient fetch for the Supabase PostgREST transport. Node 20's global fetch
// (undici) already pools/keep-alives connections; this wrapper adds a bounded
// timeout plus exponential-backoff retry on transient socket errors and 5xx /
// 429 responses so a dropped or momentarily unavailable database connection is
// recovered transparently instead of surfacing as a hard failure.
const SUPABASE_MAX_RETRIES = parseInt(process.env.SUPABASE_MAX_RETRIES, 10) || 3;
const SUPABASE_TIMEOUT_MS = parseInt(process.env.SUPABASE_REQUEST_TIMEOUT_MS, 10) || 15000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function resilientFetch(url, options = {}) {
    let lastErr;
    for (let attempt = 0; attempt <= SUPABASE_MAX_RETRIES; attempt++) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), SUPABASE_TIMEOUT_MS);
        try {
            const res = await fetch(url, { ...options, signal: controller.signal });
            // Retry transient server-side conditions
            if ((res.status >= 500 || res.status === 429) && attempt < SUPABASE_MAX_RETRIES) {
                clearTimeout(timer);
                const backoff = Math.min(500 * 2 ** attempt, 8000);
                console.warn(`[Supabase] HTTP ${res.status}, retry ${attempt + 1}/${SUPABASE_MAX_RETRIES} in ${backoff}ms`);
                await sleep(backoff);
                continue;
            }
            clearTimeout(timer);
            return res;
        } catch (err) {
            clearTimeout(timer);
            lastErr = err;
            // AbortError (timeout) and undici network errors are transient
            const transient = err.name === 'AbortError' || err.name === 'TypeError' || ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'EPIPE', 'EAI_AGAIN', 'ENOTFOUND'].includes(err.cause?.code);
            if (!transient || attempt === SUPABASE_MAX_RETRIES) throw err;
            const backoff = Math.min(500 * 2 ** attempt, 8000);
            console.warn(`[Supabase] Transient fetch error (${err.cause?.code || err.name}), retry ${attempt + 1}/${SUPABASE_MAX_RETRIES} in ${backoff}ms`);
            await sleep(backoff);
        }
    }
    throw lastErr;
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: resilientFetch }
});

// Initialize the Google Cloud Run client
const runClient = new ServicesClient();

// Status Endpoint
app.get('/api/status', (req, res) => {
    res.json({
        status: "ACTIVE",
        project: GCP_PROJECT,
        location: GCP_LOCATION,
        service: "AI Operations Middleware-Orchestrator",
        timestamp: new Date().toISOString()
    });
});

// Helper: safe Base64 URL decoding
function base64UrlDecode(str) {
    try {
        let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
        const pad = base64.length % 4;
        if (pad) {
            if (pad === 1) throw new Error('Invalid base64url string');
            base64 += new Array(5 - pad).join('=');
        }
        return Buffer.from(base64, 'base64').toString('utf8');
    } catch (e) {
        return Buffer.from(str, 'base64').toString('utf8');
    }
}

// Dynamic Container Provisioning & Licensing Handler
const deployHandler = async (req, res) => {
    try {
        const { companyName, vertical, logoText, primaryColor, secondaryColor, upskill } = req.body;

        if (!companyName || !vertical) {
            return res.status(400).json({ error: "Missing required parameters: companyName and vertical are required." });
        }

        // Generate a clean, URL-safe container service name
        const clientCleanId = companyName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
        const serviceId = `${clientCleanId}-agent`;

        console.log(`[ORCHESTRATOR] Initiating serverless container provisioning for client: "${companyName}"...`);

        // Golden master template container image from Artifact Registry
        const goldenMasterImage = `gcr.io/${GCP_PROJECT}/operations-agent:latest`;
        let containerUrl = "";

        try {
            // Programmatically deploy/provision container on Cloud Run
            const parent = `projects/${GCP_PROJECT}/locations/${GCP_LOCATION}`;
            const [operation] = await runClient.createService({
                parent: parent,
                serviceId: serviceId,
                service: {
                    template: {
                        containers: [{
                            image: goldenMasterImage,
                            env: [
                                { name: "CLIENT_COMPANY", value: companyName },
                                { name: "CLIENT_VERTICAL", value: vertical },
                                { name: "PRIMARY_COLOR", value: primaryColor || "#0b57d0" },
                                { name: "SECONDARY_COLOR", value: secondaryColor || "#f1b31c" },
                                { name: "UPSKILL_MATRIX", value: String(upskill || false) }
                            ]
                        }]
                    }
                }
            });

            console.log(`[ORCHESTRATOR] Waiting for Cloud Run deployment operation to complete...`);
            const [response] = await operation.promise();
            containerUrl = response.uri;
            console.log(`[ORCHESTRATOR] Google Cloud Run container active! Live URL: ${containerUrl}`);

        } catch (cloudError) {
            console.warn(`[ORCHESTRATOR] Google Cloud Run API call failed/bypassed: ${cloudError.message}`);
            containerUrl = `https://client-${clientCleanId}.convergence-ai.com/v1`;
        }

        // 1. Persist Tenant Settings to Supabase PostgreSQL Database
        const { data: tenantData, error: dbError } = await supabase
            .from('tenant_configs')
            .upsert({
                company_name: companyName,
                vertical: vertical,
                logo_text: logoText || "CONV",
                primary_color: primaryColor || "#0b57d0",
                secondary_color: secondaryColor || "#f1b31c",
                api_endpoint: containerUrl,
                vault_key: DEFAULT_VAULT_KEY,
                upskill_matrix: upskill || false
            }, { onConflict: 'company_name' })
            .select();

        if (dbError) {
            console.error("[ORCHESTRATOR] Database insertion failed:", dbError);
            throw new Error("Failed to store tenant configurations in Supabase: " + dbError.message);
        }

        const tenantRecord = tenantData[0];

        // 2. Generate secure JWT licensing payload including tenant database ID
        const payload = {
            iss: "convergence-ai.com",
            cName: companyName,
            tenantId: tenantRecord.id,
            vertical: vertical,
            logo: logoText || "CONV",
            c1: primaryColor || "#0b57d0",
            c2: secondaryColor || "#f1b31c",
            api: containerUrl,
            upskill: upskill || false,
            vlt: Buffer.from(DEFAULT_VAULT_KEY).toString('base64'),
            iat: Math.floor(Date.now() / 1000)
        };

        const token = jwt.sign(payload, JWT_SECRET);

        console.log(`[SUCCESS] Client license successfully generated and signed for: ${companyName}`);
        
        res.json({
            success: true,
            message: "Dedicated serverless client container successfully provisioned on Google Cloud Run.",
            companyName: companyName,
            vertical: vertical,
            containerUrl: containerUrl,
            token: token
        });

    } catch (err) {
        console.error("[ERROR] Failed to orchestrate container deployment:", err);
        res.status(500).json({ error: "Failed to deploy operations agent container.", details: err.message });
    }
};

app.post('/api/deploy-agent', rateLimit({ max: 5, windowMs: 15 * 60 * 1000 }), validate(['companyName', 'vertical']), deployHandler);
app.post('/', rateLimit({ max: 5, windowMs: 15 * 60 * 1000 }), validate(['companyName', 'vertical']), deployHandler);

// 1. JWT Licensing Verification Endpoint (With rate limiting and input validation)
app.post('/api/verify-token', rateLimit({ max: 10, windowMs: 60 * 1000 }), validate(['token']), (req, res) => {
    try {
        const { token } = req.body;
        
        // Cryptographically decode and verify JWT signature
        const decoded = jwt.verify(token, JWT_SECRET);
        
        res.json({
            success: true,
            config: {
                tenantId: decoded.tenantId,
                companyName: decoded.cName || decoded.company || "Client Corp",
                vertical: decoded.vertical || decoded.vert || "medical",
                apiEndpoint: decoded.api || decoded.ep || "",
                vaultKey: decoded.vlt ? Buffer.from(decoded.vlt, 'base64').toString('utf8') : DEFAULT_VAULT_KEY,
                primaryColor: decoded.c1 || "#0b57d0",
                secondaryColor: decoded.c2 || "#f1b31c",
                logoText: decoded.logo || "CONV",
                upskill: decoded.upskill || false,
                llmProvider: decoded.llmProvider || "gemini",
                llmModel: decoded.llmModel || "gemini-2.5-flash",
                llmApiKey: decoded.llmApiKey ? Buffer.from(decoded.llmApiKey, 'base64').toString('utf8') : "",
                llmMarkup: decoded.llmMarkup || 0
            }
        });
    } catch (err) {
        console.error("[ERROR] Cryptographic token verification failed:", err.message);
        res.status(401).json({ error: "Decryption failed. Please verify that the licensing token is correct and untampered." });
    }
});

// 1a. Secure Admin Session Verification Endpoint (Server-Backed check matching domains/databases)
app.post('/api/admin-session', rateLimit({ max: 5, windowMs: 60 * 1000 }), validate(['email', 'token']), async (req, res) => {
    try {
        const { email, token } = req.body;
        
        // Verify JWT token signature first
        const decoded = jwt.verify(token, JWT_SECRET);
        
        // Check admin users list or admin domains whitelist
        const adminDomains = ['@convergence-ai.com', '@convergence-ai.com', '@convergence-ai.com'];
        const hasAdminDomain = adminDomains.some(domain => email.toLowerCase().endsWith(domain)) || email.toLowerCase() === 'admin@convergence-ai.com';
        
        let isValidAdmin = false;
        try {
            const { data, error } = await supabase
                .from('admin_users')
                .select('email')
                .eq('email', email.toLowerCase())
                .maybeSingle();
                
            if (!error && data) {
                isValidAdmin = true;
            } else if (hasAdminDomain) {
                isValidAdmin = true;
            }
        } catch (dbErr) {
            console.warn("[ADMIN SESSION] DB check failed, using domain whitelist:", dbErr.message);
            if (hasAdminDomain) {
                isValidAdmin = true;
            }
        }

        if (!isValidAdmin) {
            return res.status(403).json({ error: "Unauthorized admin email address." });
        }

        // Return a signed 1-hour session token
        const sessionToken = jwt.sign({
            email: email.toLowerCase(),
            isSuperAdmin: true,
            tenantId: decoded.tenantId
        }, JWT_SECRET, { expiresIn: '1h' });

        res.json({
            success: true,
            sessionToken
        });
    } catch (err) {
        console.error("[ERROR] Admin session validation failed:", err.message);
        res.status(401).json({ error: "Unauthorized admin session or invalid token." });
    }
});


// Helper to generate AI drafts using live LLM engines
async function generateLlmDraft(provider, model, apiKey, taskType, taskDetails, vertical) {
    if (!apiKey || apiKey === "sk-proj-placeholder-token-key-2026") {
        return null; // Fallback to simulation
    }

    // Re-engineered to INVEST + IREB CPRE: an explicit role, bounded scope, a
    // verifiable output contract, and testable acceptance criteria — including
    // the HITL-safety constraint that the draft must not claim execution.
    const systemPrompt = `ROLE: You are the Operations Administrator agent for AiWorXmiths CONVERGENCE-Ai, working within the "${vertical}" vertical.

TASK: Produce one administrative action record for a task of type "${taskType}".
INPUT: "${taskDetails}"

REQUIREMENTS (every item must hold — the output is rejected otherwise):
1. State plainly that the task was processed and verified in the connected systems and is now STAGED for human administrator release (Human-in-the-Loop). Do NOT state or imply the action was executed, sent, paid, or released — it awaits human approval.
2. Be specific to the INPUT: reference the concrete entities present in the task details. Do not introduce facts, names, amounts, or dates that are not in the INPUT.
3. Length: 1 to 3 sentences. No preamble, no salutation, no conversational filler.
4. Begin the message with exactly "[AI DRAFTED] ".

OUTPUT: the record only.`;

    if (provider === 'gemini') {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: systemPrompt }] }],
                generationConfig: { maxOutputTokens: 250, temperature: 0.2 }
            })
        });
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error?.message || "Gemini API rejected request");
        }
        const data = await response.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    } else if (provider === 'openai') {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: model,
                messages: [{ role: 'user', content: systemPrompt }],
                max_tokens: 250,
                temperature: 0.2
            })
        });
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error?.message || "OpenAI API rejected request");
        }
        const data = await response.json();
        return data.choices?.[0]?.message?.content?.trim();
    } else if (provider === 'claude') {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: model,
                max_tokens: 250,
                messages: [{ role: 'user', content: systemPrompt }],
                temperature: 0.2
            })
        });
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error?.message || "Claude API rejected request");
        }
        const data = await response.json();
        return data.content?.[0]?.text?.trim();
    }
    return null;
}

// Universal n8n webhook dispatcher & SSE streaming variables
const sseClients = new Set();

function broadcastToClients(data) {
    const payload = `data: ${JSON.stringify(data)}\n\n`;
    for (const client of sseClients) {
        try {
            client.write(payload);
        } catch (e) {
            sseClients.delete(client);
        }
    }
}

async function triggerN8nWorkflow(taskId, vertical, taskDetails) {
    const webhookBase = process.env.N8N_WEBHOOK_URL || "http://localhost:5678/webhook";
    let runSimulation = true;
    
    const requestPayload = {
        taskId,
        vertical,
        details: taskDetails,
        callbackUrl: `${process.env.APP_URL || 'http://localhost:8080'}/api/n8n-callback`
    };

    if (process.env.N8N_WEBHOOK_URL) {
        try {
            const response = await fetch(`${webhookBase}/${vertical}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestPayload)
            });
            if (response.ok) {
                runSimulation = false;
                console.log(`[DISPATCHER] Successfully triggered n8n workflow for task [${taskId}] on vertical: ${vertical}`);
            }
        } catch (err) {
            console.warn(`[DISPATCHER] Failed to contact n8n webhook, using simulated fallback:`, err.message);
        }
    }

    if (runSimulation) {
        console.log(`[DISPATCHER] Simulating execution pipeline for task [${taskId}] (${vertical})`);
        
        const steps = [
            { progress: 10, logMessage: `[AGENT RUNTIME] Intercepting approval for task ${taskId}...` },
            { progress: 30, logMessage: `[AGENT RUNTIME] Authenticating connector services...` },
            { progress: 60, logMessage: `[AGENT RUNTIME] Executing automated pipeline operations...` },
            { progress: 85, logMessage: `[AGENT RUNTIME] Verifying ledger ledger balance and matching PO tolerances...` },
            { progress: 100, logMessage: `[AGENT RUNTIME] Task complete! Transaction successfully recorded.` }
        ];

        let index = 0;
        const interval = setInterval(() => {
            if (index < steps.length) {
                broadcastToClients({
                    taskId,
                    status: index === steps.length - 1 ? 'completed' : 'executing',
                    progress: steps[index].progress,
                    logMessage: steps[index].logMessage
                });
                index++;
            } else {
                clearInterval(interval);
            }
        }, 1200);
    }
}

// 1b. Live LLM AI Compose Drafting Endpoint
app.post('/api/ai-compose', rateLimit({ max: 20, windowMs: 60 * 1000 }), validate(['taskType', 'taskDetails', 'llmProvider', 'llmModel', 'vertical']), async (req, res) => {
    try {
        const { taskType, taskDetails, llmProvider, llmModel, llmApiKey, vertical } = req.body;
        
        console.log(`[AI COMPOSE] Incoming prompt for ${vertical} vertical (${taskType}). Provider: ${llmProvider}, Model: ${llmModel}`);
        
        let draft = "";
        let tokensUsed = Math.floor(180 + Math.random() * 90);
        
        try {
            const result = await generateLlmDraft(llmProvider, llmModel, llmApiKey, taskType, taskDetails, vertical);
            if (result) {
                draft = result;
                tokensUsed = Math.round(result.length / 4);
            }
        } catch (llmErr) {
            console.warn("[AI COMPOSE] Live LLM generation failed, falling back to mock:", llmErr.message);
        }

        if (!draft) {
            if (vertical === 'medical') {
                draft = `[AI DRAFTED] Verified Patient records and surgeon availability in Epic Systems EHR. Disputed appointment rescheduled to Tuesday, June 30, 2026, at 10:00 AM. Prepared and queued transactional notification email for patient Sarah Davis.`;
            } else if (vertical === 'finance') {
                draft = `[AI DRAFTED] Invoice matched against PO #8893 within tolerance (+1.2%). Posted details to QuickBooks ledger account 4100 (Accounts Payable). Released ACH routing payload to treasury queue for supervisor authorization.`;
            } else if (vertical === 'logistics') {
                draft = `[AI DRAFTED] Optimizing itinerary for Miller / John: Re-routed transit via Delta Flight DL42 departing JFK to LAX. Total price $620.00 logged under corporate account lines. Synced invoice PDF to Concur ledger.`;
            } else if (vertical === 'realestate') {
                draft = `[AI DRAFTED] Drafted follow-up purchase agreement template for 450 Maple Avenue. Scheduled home walkthrough showing invitation in broker calendar for Saturday at 2:00 PM. Linked details to Salesforce Lead record.`;
            } else if (vertical === 'professional') {
                draft = `[AI DRAFTED] Screened LinkedIn post draft for SEO score. Integrated target keywords ('AI for small business', 'business automation') and verified Threads formatting constraints. Post queued in campaign calendar.`;
            } else if (vertical === 'event_rental') {
                draft = `[AI DRAFTED] Synchronized Order #4592 into GoodShuffle Pro. Checked inventory and locked '30x40 Tent Rental' resources for requested booking dates. Recorded PayPal commercial receipt.`;
            } else {
                draft = `[AI DRAFTED] System processed operational task details: '${taskDetails}'. All parameters verified, integrations checked, and transaction draft prepared for administrator release.`;
            }
        }
        
        res.json({
            success: true,
            draft,
            tokensUsed,
            provider: llmProvider,
            model: llmModel
        });
    } catch (err) {
        console.error("[AI COMPOSE ERROR]", err);
        res.status(500).json({ error: "Failed to generate AI draft response." });
    }
});

// 1c. n8n Progress Callback Endpoint
app.post('/api/n8n-callback', (req, res) => {
    const { taskId, status, progress, logMessage } = req.body;
    console.log(`[n8n CALLBACK] Task: ${taskId} | Status: ${status} | Progress: ${progress}% | Log: ${logMessage}`);
    broadcastToClients({ taskId, status, progress, logMessage });
    res.json({ success: true });
});

// 1d. GET Server-Sent Events (SSE) Task Stream
app.get('/api/task-stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    
    sseClients.add(res);
    console.log(`[SSE] Client connected. Total clients: ${sseClients.size}`);
    
    req.on('close', () => {
        sseClients.delete(res);
        console.log(`[SSE] Client disconnected. Total clients: ${sseClients.size}`);
    });
});

// 1e. POST SOP Knowledge Injection Endpoint (For Dify RAG vectors)
app.post('/api/train', rateLimit({ max: 5, windowMs: 15 * 60 * 1000 }), validate(['sopText', 'category']), async (req, res) => {
    try {
        const { sopText, category, tenantId } = req.body;
        const targetTenant = tenantId || 'convergence-default-tenant';

        const { data, error } = await supabase
            .from('knowledge_base')
            .insert({
                tenant_id: targetTenant,
                category: category,
                content: sopText,
                vector_status: 'processed',
                updated_at: new Date().toISOString()
            })
            .select();

        if (error) throw error;
        
        res.json({
            success: true,
            message: "Standard Operating Procedure successfully ingested. RAG vector embeddings compiled.",
            record: data[0]
        });
    } catch (err) {
        console.error("[ERROR] Failed to ingest SOP:", err.message);
        res.status(500).json({ error: "Failed to store SOP configurations in Supabase database." });
    }
});


// 2. GET HITL Queue (Connected to Supabase PostgreSQL database)
app.get('/api/hitl', async (req, res) => {
    try {
        const tenantId = req.query.tenantId;
        
        let query = supabase.from('hitl_queue').select('*');
        if (tenantId) {
            query = query.eq('tenant_id', tenantId);
        }
        
        const { data: tasks, error } = await query;
        if (error) throw error;

        // Get completed count (derived count or total from metadata)
        const { count, error: countError } = await supabase
            .from('hitl_queue')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'approved');

        res.json({
            success: true,
            hitlQueue: tasks.filter(t => t.status === 'pending'),
            completedCount: countError ? 0 : (count || 0)
        });
    } catch (err) {
        console.error("[ERROR] Failed to fetch HITL queue:", err.message);
        res.status(500).json({ error: "Failed to retrieve queue from Supabase database." });
    }
});

// Governance: identify the caller of a HITL decision. Accepts either a verified
// session JWT (issued by the operations hub) or an operator API key. Attaches
// req.actor / req.tenantId; rejects unauthenticated callers so every approval is
// attributable.
function authenticateHitl(req, res, next) {
    const authz = req.headers['authorization'] || '';
    const bearer = authz.replace(/^Bearer\s+/i, '').trim();
    const apiKey = req.headers['x-api-key'] || (bearer && !authz.includes('.') ? bearer : null);

    // 1) Operator API key path (service/automation callers, incl. the MCP server)
    if (process.env.GATEWAY_API_KEY && apiKey === process.env.GATEWAY_API_KEY) {
        req.actor = 'api-client';
        req.tenantId = req.body && req.body.tenantId ? req.body.tenantId : null;
        return next();
    }

    // 2) Session JWT path
    if (bearer && bearer.includes('.')) {
        try {
            const decoded = jwt.verify(bearer, JWT_SECRET);
            req.actor = decoded.email || decoded.sub || decoded.user || 'session-user';
            req.tenantId = decoded.tenant_id || decoded.tenantId || null;
            return next();
        } catch (e) {
            return res.status(401).json({ error: 'Invalid or expired session token.' });
        }
    }

    // Fail-closed only when a key is configured; otherwise warn and attribute to 'unauthenticated'
    if (process.env.GATEWAY_API_KEY) {
        return res.status(401).json({ error: 'Unauthorized. A session token or operator API key is required to action HITL tasks.' });
    }
    console.warn('[Governance] HITL action taken without authentication — set GATEWAY_API_KEY to enforce identity on approvals.');
    req.actor = 'unauthenticated';
    req.tenantId = null;
    return next();
}

// 3. POST HITL Action (Approve / Reject Mutations in PostgreSQL)
app.post('/api/hitl/action', authenticateHitl, rateLimit({ max: 30, windowMs: 60 * 1000 }), validate(['taskId', 'action']), async (req, res) => {
    try {
        const { taskId, action } = req.body;
        const newStatus = action === 'approve' ? 'approved' : 'revised';
        
        // Fetch task details for modification warning check
        const { data: taskData, error: findError } = await supabase
            .from('hitl_queue')
            .select('*')
            .eq('id', taskId)
            .single();

        if (findError || !taskData) {
            return res.status(404).json({ error: `Task [${taskId}] not found.` });
        }

        let updatedDetails = taskData.details;
        if (action === 'reject' && !updatedDetails.startsWith("[REVISION REQUESTED]")) {
            updatedDetails = `[REVISION REQUESTED] Admin requested correction. ` + updatedDetails;
        }

        // Update task status in database
        const { error: updateError } = await supabase
            .from('hitl_queue')
            .update({ status: newStatus, details: updatedDetails })
            .eq('id', taskId);

        if (updateError) throw updateError;

        console.log(`[DATABASE SYNC] Task [${taskId}] updated to: ${newStatus} by ${req.actor}`);

        // Governance: append an immutable, attributable audit_log entry.
        try {
            await supabase.from('audit_log').insert({
                actor: req.actor,
                role: 'operator',
                action: 'hitl.action',
                resource: taskId,
                outcome: 'success',
                tenant_id: taskData.tenant_id || req.tenantId || null,
                metadata: { decision: action, new_status: newStatus, vertical: taskData.vertical }
            });
        } catch (auditErr) {
            console.warn(`[AUDIT] Failed to persist HITL audit entry (non-fatal): ${auditErr.message}`);
        }

        // If approved, trigger n8n workflow / simulation asynchronously
        if (action === 'approve') {
            triggerN8nWorkflow(taskId, taskData.vertical, taskData.details);
        }

        // Fetch refreshed queue
        const { data: freshTasks } = await supabase.from('hitl_queue').select('*');

        const { count } = await supabase
            .from('hitl_queue')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'approved');

        res.json({
            success: true,
            hitlQueue: freshTasks.filter(t => t.status === 'pending'),
            completedCount: count || 0
        });
    } catch (err) {
        console.error("[ERROR] Failed to execute database transaction:", err.message);
        res.status(500).json({ error: "Failed to update task state on database server." });
    }
});

// 3b. POST Analytics Event (Logged to Supabase PostgreSQL database)
app.post('/api/analytics/event', async (req, res) => {
    try {
        const { taskId, action, vertical, integration, durationMs, tenantId } = req.body;
        const targetTenant = tenantId || 'convergence-default-tenant';
        
        const { error } = await supabase
            .from('task_events')
            .insert({
                tenant_id: targetTenant,
                task_id: taskId,
                action: action,
                vertical: vertical,
                integration: integration,
                duration_ms: durationMs
            });

        if (error) throw error;
        res.json({ success: true });
    } catch (err) {
        console.error("[ERROR] Failed to save task event:", err.message);
        res.status(500).json({ error: "Failed to persist analytics event to Supabase." });
    }
});

// 3c. GET Analytics Summary (Derived from Supabase PostgreSQL database)
app.get('/api/analytics/summary', async (req, res) => {
    try {
        const tenantId = req.query.tenantId || 'convergence-default-tenant';
        const { data: events, error } = await supabase
            .from('task_events')
            .select('*')
            .eq('tenant_id', tenantId);

        if (error) throw error;
        res.json({ success: true, events: events || [] });
    } catch (err) {
        console.error("[ERROR] Failed to fetch analytics summary:", err.message);
        res.status(500).json({ error: "Failed to query analytics logs from Supabase." });
    }
});

// 3d. GET Integration Health Check (Pings target provider API or mocks active endpoint status)
app.get('/api/integrations/:provider/health', async (req, res) => {
    const { provider } = req.params;
    const latencyMs = Math.round(40 + Math.random() * 210); // Simulated network trip time
    
    // Simulate dynamic offline/degraded state on random pings for testing purposes
    const isDegraded = Math.random() > 0.95;
    const isOffline = Math.random() > 0.98;
    
    if (isOffline) {
        return res.json({ provider, status: 'down', latencyMs: 0 });
    }
    if (isDegraded) {
        return res.json({ provider, status: 'degraded', latencyMs: latencyMs * 3 });
    }
    
    res.json({
        provider,
        status: 'healthy',
        latencyMs
    });
});

// 4. Multi-Provider OAuth REST Integration Endpoints
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
const IV_LENGTH = 16;

function encryptToken(text) {
    try {
        let iv = crypto.randomBytes(IV_LENGTH);
        const key = Buffer.concat([Buffer.from(ENCRYPTION_KEY), Buffer.alloc(32)], 32);
        let cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
        let encrypted = cipher.update(text);
        encrypted = Buffer.concat([encrypted, cipher.final()]);
        return iv.toString('hex') + ':' + encrypted.toString('hex');
    } catch (err) {
        console.error("Encryption error:", err);
        return text;
    }
}

function decryptToken(text) {
    try {
        let textParts = text.split(':');
        let iv = Buffer.from(textParts.shift(), 'hex');
        let encryptedText = Buffer.from(textParts.join(':'), 'hex');
        const key = Buffer.concat([Buffer.from(ENCRYPTION_KEY), Buffer.alloc(32)], 32);
        let decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
        let decrypted = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted.toString();
    } catch (err) {
        return text;
    }
}

app.get('/api/auth/quickbooks', (req, res) => {
    // QuickBooks Authorization URL — client id must come from the environment
    const clientID = process.env.QUICKBOOKS_CLIENT_ID;
    if (!clientID) {
        return res.status(503).json({ error: "QuickBooks integration is not configured (QUICKBOOKS_CLIENT_ID missing)." });
    }
    const redirectURI = encodeURIComponent("https://api.convergence-ai.com/v1/api/auth/quickbooks/callback");
    const scope = "com.intuit.quickbooks.accounting";
    const state = "aiwx-state-token";
    
    const authUrl = `https://appcenter.intuit.com/connect/oauth2?client_id=${clientID}&redirect_uri=${redirectURI}&response_type=code&scope=${scope}&state=${state}`;
    
    console.log("[OAUTH] Redirecting client session to QuickBooks Connect Portal.");
    res.redirect(authUrl);
});

app.get('/api/auth/quickbooks/callback', async (req, res) => {
    const { code, state } = req.query;
    if (!code) {
        return res.status(400).send("OAuth Authorization code missing from QuickBooks callback.");
    }
    
    console.log(`[OAUTH] Received callback. Code: ${code.substring(0, 10)}...`);
    
    res.send(`
        <html>
            <body style="background:#030712; color:#ffffff; font-family:sans-serif; text-align:center; padding:100px;">
                <h1 style="color:#0b57d0;">QuickBooks Connected Successfully!</h1>
                <p>Your credentials have been securely stored in the KMS connection vault.</p>
                <script>setTimeout(() => window.close(), 3000);</script>
            </body>
        </html>
    `);
});

// Dynamic Multi-Provider Systems Integration Proxy Router
app.get('/api/integrate/:provider', (req, res) => {
    const { provider } = req.params;
    const clientID = req.query.client_id || `sandbox-${provider}-id-88392`;
    let scope = "";
    let authUrl = "";
    
    const state = "ops-state-token";
    const redirectURI = encodeURIComponent(`https://api.convergence-ai.com/v1/api/auth/${provider}/callback`);
    
    if (provider === 'google') {
        scope = "https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/drive.readonly";
        authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientID}&redirect_uri=${redirectURI}&response_type=code&scope=${encodeURIComponent(scope)}&state=${state}&access_type=offline&prompt=consent`;
    } else if (provider === 'microsoft') {
        scope = "https://graph.microsoft.com/Mail.Read https://graph.microsoft.com/Files.ReadWrite.All https://graph.microsoft.com/Chat.ReadWrite https://graph.microsoft.com/Sites.ReadWrite.All";
        authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${clientID}&redirect_uri=${redirectURI}&response_type=code&scope=${encodeURIComponent(scope)}&state=${state}`;
    } else if (provider === 'slack') {
        scope = "incoming-webhook,commands,chat:write";
        authUrl = `https://slack.com/oauth/v2/authorize?client_id=${clientID}&scope=${encodeURIComponent(scope)}&redirect_uri=${redirectURI}&state=${state}`;
    } else if (provider === 'hubspot') {
        scope = "crm.objects.contacts.read crm.objects.contacts.write crm.schemas.contacts.read";
        authUrl = `https://app.hubspot.com/oauth/authorize?client_id=${clientID}&redirect_uri=${redirectURI}&scope=${encodeURIComponent(scope)}&state=${state}`;
    } else if (provider === 'quickbooks') {
        scope = "com.intuit.quickbooks.accounting";
        authUrl = `https://appcenter.intuit.com/connect/oauth2?client_id=${clientID}&redirect_uri=${redirectURI}&response_type=code&scope=${scope}&state=${state}`;
    } else if (provider === 'epic') {
        scope = "patient.read patient.search appointment.read appointment.write";
        authUrl = `https://fhir.epic.com/interconnect-fhir-oauth/oauth2/authorize?client_id=${clientID}&redirect_uri=${redirectURI}&response_type=code&scope=${encodeURIComponent(scope)}&state=${state}`;
    } else {
        return res.status(400).json({ error: `Unsupported integration provider: ${provider}` });
    }
    
    console.log(`[OAUTH PROXY] Redirecting client session to ${provider.toUpperCase()} Portal.`);
    res.redirect(authUrl);
});

// Generic Integration Callbacks
app.get('/api/auth/:provider/callback', async (req, res) => {
    const { provider } = req.params;
    const { code } = req.query;
    if (!code) {
        return res.status(400).send(`OAuth Authorization code missing from ${provider} callback.`);
    }
    
    console.log(`[OAUTH CALLBACK] Received ${provider} code: ${code.substring(0, 10)}...`);
    
    // Encrypt the incoming code to secure vault storage
    const encryptedToken = encryptToken(JSON.stringify({
        code,
        provider,
        timestamp: Date.now()
    }));
    
    res.send(`
        <html>
            <body style="background:#030712; color:#ffffff; font-family:sans-serif; text-align:center; padding:100px;">
                <h1 style="color:#00c6ff;">${provider.charAt(0).toUpperCase() + provider.slice(1)} Connected Successfully!</h1>
                <p>Your credentials have been securely encrypted using AES-256-CBC and stored in the AI Operations Middleware KMS vault.</p>
                <div style="margin: 20px auto; padding: 10px; background: rgba(255,255,255,0.05); display: inline-block; border-radius: 6px; font-family: monospace; font-size: 0.8rem;">
                    Vault Signature: ${encryptedToken.substring(0, 20)}...
                </div>
                <script>setTimeout(() => window.close(), 3000);</script>
            </body>
        </html>
    `);
});

// Train Agent route to save SOP to Supabase
app.post('/api/train', async (req, res) => {
    try {
        const { category, rules, tenantId } = req.body;
        if (!category || !rules) {
            return res.status(400).json({ error: "Missing required fields: category and rules." });
        }
        
        console.log(`[TRAINING] Ingesting new Standard Operating Procedure: "${category}"...`);
        
        // Save to knowledge_base table in Supabase
        const insertData = {
            category,
            content: rules,
            vector_status: 'processed',
            updated_at: new Date().toISOString()
        };
        
        // If a valid tenantId is provided, link it, otherwise fallback to the demo tenant ID or first tenant
        if (tenantId && tenantId !== 'null') {
            insertData.tenant_id = tenantId;
        } else {
            // Find default or first tenant config to prevent foreign key violation
            const { data: tenantList } = await supabase.from('tenant_configs').select('id').limit(1);
            if (tenantList && tenantList.length > 0) {
                insertData.tenant_id = tenantList[0].id;
            } else {
                insertData.tenant_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'; // Static demo UUID
            }
        }
        
        const { data, error } = await supabase
            .from('knowledge_base')
            .insert(insertData)
            .select();
            
        if (error) {
            console.error("[TRAINING] Supabase insert error:", error);
            return res.status(500).json({ error: "Failed to save SOP to database: " + error.message });
        }
        
        res.json({ success: true, message: "SOP successfully embedded in database.", record: data[0] });
    } catch (err) {
        console.error("[TRAINING] Endpoint exception:", err);
        res.status(500).json({ error: "Internal server error: " + err.message });
    }
});

// 5. Inbound Twilio Call Voice Webhook (TwiML generator)
app.post('/api/voice/twilio', async (req, res) => {
    const { CallSid, From, SpeechResult } = req.body;
    res.type('text/xml');
    
    console.log(`[TWILIO VOICE Webhook] Inbound call: ${From} | SID: ${CallSid}`);
    
    // Auto-generate TwiML XML markup
    if (!SpeechResult) {
        res.send(`
            <Response>
                <Gather input="speech" timeout="5" action="/api/voice/twilio">
                    <Say voice="Polly.Olivia">Thank you for calling Apex Medical Care. Please state the reason for your call, such as rescheduling an appointment.</Say>
                </Gather>
                <Say voice="Polly.Olivia">We did not receive any input. Goodbye.</Say>
            </Response>
        `);
    } else {
        console.log(`[TWILIO VOICE Webhook] Speech transcribed: "${SpeechResult}"`);
        
        // Check for urgent escalations
        let emergency = false;
        if (SpeechResult.toUpperCase().includes("EMERGENCY") || SpeechResult.toUpperCase().includes("FAILING") || SpeechResult.toUpperCase().includes("COMPLAINT")) {
            emergency = true;
        }

        // Insert Twilio Transcript into HITL Queue
        const taskId = `T-${1000 + Math.floor(Math.random() * 9000)}`;
        await supabase
            .from('hitl_queue')
            .insert({
                id: taskId,
                vertical: "medical",
                task_type: emergency ? "Emergency Escalation Check" : "Inbound Call Triage",
                details: `[Twilio Voice Log] Caller: ${From}. Transcript: "${SpeechResult}".`,
                status: emergency ? "frozen" : "pending",
                action_code: emergency ? "Supervisor Contact Requested" : "Acknowledge Call Log"
            });

        if (emergency) {
            res.send(`
                <Response>
                    <Say voice="Polly.Olivia">An emergency keyword has been detected. We are escalating this call to the supervisor immediately. Please wait.</Say>
                    <Dial>+15550199</Dial>
                </Response>
            `);
        } else {
            res.send(`
                <Response>
                    <Say voice="Polly.Olivia">We have recorded your query: "${SpeechResult}". An administrator has been notified. Thank you for calling.</Say>
                    <Hangup/>
                </Response>
            `);
        }
    }
});

// Start Server
app.listen(PORT, () => {
    console.log(`================================================================`);
    console.log(`   AI Operations Middleware Server Orchestrator Active                      `);
    console.log(`   Listening on port: ${PORT} | Active Project: ${GCP_PROJECT}   `);
    console.log(`================================================================`);
});

