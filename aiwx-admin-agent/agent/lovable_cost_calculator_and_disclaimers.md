# Lovable.ai Specification: Dynamic Cost Calculator & Legal Disclaimers
### Platform: CONVERGENCE-Ai Deployed Suites | Class: Component Engineering Spec | Version: 1.0
#### Purpose: Copy-Pasteable Prompt Specifications for Lovable.ai, Bolt.new, or v0.dev React Generation

Use this document to direct **Lovable.ai** to build or update the Pricing and Trial sections of your product landing pages. It includes copy-pasteable legal disclaimers regarding downstream utility costs and the technical blueprints for a highly interactive React/Tailwind dynamic cost calculator.

---

## Part 1: Copy-Pasteable Legal Disclaimers (Self-Hosted Utility Costs)

Copy and paste these verbatim text blocks into your landing page footer, checkout portals, or pricing card subtexts to guarantee absolute transparency and compliance:

### 1. General Downstream Costs Disclosure (Pricing Card Subtext)
> **Direct Utility Billing Transparency**: The CONVERGENCE-Ai subscription fee ($99/mo Solo, $249/mo SMB) covers your platform core license and container activation. Dynamic server hosting, database storage, and external API calls (e.g. OpenAI model usage, Twilio telephone lines, ElevenLabs synthesis, Deepgram transcription) are billed directly to you by the respective utility providers at cost, with **0% markup from CONVERGENCE-Ai**.

### 2. Legal Disclaimers (Landing Page Footer / Terms Accordion)
> **Legal Disclaimer Regarding Downstream Operational Expenses**: 
> 
> *   **Self-Hosted Infrastructure Costs**: Client is solely responsible for establishing and maintaining their self-hosted runtime environments (e.g., Docker, AWS, Supabase PostgreSQL). Average database and hosting fees range between $15.00 and $45.00 per month depending on active user transactions and backup frequencies.
> *   **Third-Party API Usage Quotas**: Agentic actions—such as processing voice triage (Twilio voice/SMS API, ElevenLabs/Whisper TTS and STT engines) and executing reasoning pipelines (OpenAI API, Claude API)—incur direct usage-based charges billed by the respective platform owners. Actual utility costs are highly dependent on client-configured thresholds and monthly pipeline volume.
> *   **Cancellation & Code Deactivation**: Upon cancellation of your 7-day free trial or active subscription, your container license token will be cryptographically disabled on day 8. Deactivation terminates all outbound agent pipelines, webhooks, and process maps. CONVERGENCE-Ai holds zero liability for downstream service interruptions or data storage costs incurred in the client’s private environment after license termination.

---

## Part 2: Lovable.ai React Component Specification: Dynamic Cost Calculator

Copy and paste this technical specification directly into Lovable.ai to generate a premium, high-converting, and glassmorphic **Downstream Cost Estimator Calculator** component.

### 1. React/Tailwind Component Persona & Style Prompt
```text
Generate a premium, glassmorphic React component for a "Downstream Utility Cost Calculator" using Tailwind CSS. 
Apply the following styling tokens:
- Backdrop: Space Charcoal (`bg-slate-950` / `#030712`) with Slate card panels (`bg-slate-900/40` / `backdrop-blur-md`).
- Primary Highlights: Brilliant Electric Blue (`text-blue-500` / `bg-blue-600`) and glowing drop shadows.
- Accent Highlights: Sky Blue/Cyan Sparkle (`text-cyan-400` / `bg-cyan-500`).
- Typography: Space Grotesk (headings) and Inter (body).
- NO GOLD OR YELLOW elements. Any alerts should be colored in cyan/sky blue.
```

### 2. Component State Hook Schema
```typescript
interface CalculatorInputs {
  monthlyInboundCalls: number; // Slider 0 to 5,000 (step 100, default 500)
  monthlyEmailsProcessed: number; // Slider 0 to 10,000 (step 500, default 2000)
  monthlyInvoicesProcessed: number; // Slider 0 to 2,000 (step 50, default 250)
  hostingType: 'supabase_free' | 'supabase_pro' | 'aws_self_hosted'; // Select dropdown, default 'supabase_free'
}
```

### 3. Utility Cost Formula Math Constants
```javascript
// Actual wholesale utility rate coordinates (direct-to-provider, zero markups)
const RATES = {
  voice_twilio_minute: 0.013,  // $0.013/min Twilio line + carrier
  voice_elevenlabs_char: 0.00015, // ~$0.15 per 1,000 characters TTS
  voice_deepgram_min: 0.0043,  // ~$0.0043/min Whisper transcribing STT
  llm_input_1k: 0.005, // OpenAI GPT-4o input rate ($5/M tokens)
  llm_output_1k: 0.015, // OpenAI GPT-4o output rate ($15/M tokens)
  invoice_ocr_doc: 0.05, // Private local OCR compute overhead ($0.05/doc average)
};

// Fixed monthly hosting fee structures
const HOSTING_COSTS = {
  supabase_free: 0.00, // Supabase Free DB Tier
  supabase_pro: 25.00, // Supabase Pro DB Tier ($25/mo)
  aws_self_hosted: 35.00, // ECS/Docker node instance ($35/mo)
};
```

### 4. Mathematical Estimation Formulas
Use these algorithms inside the component's calculation hook:
```javascript
// 1. Voice Call Triage Estimation (Assumes average call duration is 2.5 minutes, generating 800 characters of synthesized speech)
const voiceMinutes = monthlyInboundCalls * 2.5;
const voiceCharacters = monthlyInboundCalls * 800;

const twilioCost = voiceMinutes * RATES.voice_twilio_minute;
const deepgramCost = voiceMinutes * RATES.voice_deepgram_min;
const elevenlabsCost = voiceCharacters * RATES.voice_elevenlabs_char;
const totalVoiceCost = twilioCost + deepgramCost + elevenlabsCost;

// 2. Email & Reasoning Operations (Assumes average email parses 1,000 input tokens and generates 350 output reasoning tokens)
const emailInputCost = (monthlyEmailsProcessed * 1000 * RATES.llm_input_1k) / 1000;
const emailOutputCost = (monthlyEmailsProcessed * 350 * RATES.llm_output_1k) / 1000;
const totalLlmCost = emailInputCost + emailOutputCost;

// 3. Bookkeeping / Invoice OCR Operations (Assumes average document is 1.5 pages)
const totalOcrCost = monthlyInvoicesProcessed * RATES.invoice_ocr_doc;

// 4. Hosting & Storage
const totalHostingCost = HOSTING_COSTS[hostingType];

// 5. Grand Totals
const estimatedUtilityTotal = totalVoiceCost + totalLlmCost + totalOcrCost + totalHostingCost;
const baseLicenseFee = 249.00; // or 99.00 depending on selection
const grandTotalMonthlySpend = estimatedUtilityTotal + baseLicenseFee;

// 6. Capacity Return on Investment (ROI)
// Assumes each automated task frees up an average of 4 minutes of human coordination time.
// Multiplied by a conservative administrative labor replacement value of $35/hour.
const totalTasks = monthlyInboundCalls + monthlyEmailsProcessed + monthlyInvoicesProcessed;
const hoursFreed = (totalTasks * 4) / 60;
const totalLaborValueReclaimed = hoursFreed * 35;
const netEconomicGain = totalLaborValueReclaimed - grandTotalMonthlySpend;
```

### 5. Layout Mockup Blueprint for Lovable.ai React Render
Lovable should structure the component UI with a modern, glassmorphic layout split into two columns:

#### Left Column: Operational Volume Sliders
*   **Slider A: Inbound Phone Triage Answering**: Displays monthly count. Subtext: *"Twilio Voice & ElevenLabs TTS."*
*   **Slider B: Automated Email Inquiries**: Displays monthly count. Subtext: *"RAG Intent & GPT-4o Pipelines."*
*   **Slider C: Procure-to-Pay Invoice Processing**: Displays monthly count. Subtext: *"QuickBooks Ledger Mapping & OCR."*
*   **Select Dropdown: Hosting Environment Tier**: Options:
    1.  *Supabase Cloud Starter (Free DB Node)*
    2.  *Supabase Professional Node ($25/mo)*
    3.  *Docker Cluster VM Node ($35/mo)*

#### Right Column: Estimated Monthly Spend & ROI Breakdowns
*   **Glowing Header (Electric Blue/Cyan Gradient)**: Displays **`Estimated Utility Total: $X.XX / month`** (Calculated dynamically).
*   **Sleek Line-Item Details**:
    *   *Direct twilio Voice Lines*: `$X.XX`
    *   *AI Reasoning Pipelines (Tokens)*: `$X.XX`
    *   *Document OCR Processing*: `$X.XX`
    *   *Private Cloud compute*: `$X.XX`
*   **The Upskilled ROI Spotlight Card (Cyan Border)**:
    *   Displays **`Administrative Hours Freed: XX Hours / mo`**
    *   Displays **`Reclaimed Earning Potential: $X,XXX / mo`**
    *   Displays **`Net Growth Leverage: +$X,XXX / mo`**
    *   *Subtext (Cyan alert)*: `"Empower your active office staff. By automating these routine execution pipelines, you upskill your office team into strategic growth leaders, massively expanding your active reach."`
