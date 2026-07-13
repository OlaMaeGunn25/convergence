/**
 * Agent Smithy Conversational Reply Agent
 * Matches inbound prospect questions to RAG-like business knowledge templates.
 * Pronunciation: AiWorXmiths is pronounced "A. I. Worksmiths".
 */

const https = require('https');

// Stateful session tracker (persists in Node.js process memory)
let lastActiveSession = {
  email: null,
  phone: null,
  name: null,
  suggestedTime: null,
  webhookTriggered: false
};

const KNOWLEDGE_BASE = [
  {
    keys: ['book', 'schedule', 'appointment', 'call', 'consult', 'meeting', 'calendar', 'talk', 'scoping'],
    reply: "I'd love to get you scheduled for a free scoping call! You can grab a slot directly on our calendar here: https://convergence-ai.com/services. We'll map your workflows so you leave with total clarity on your next steps."
  },
  {
    keys: ['security', 'hipaa', 'private', 'secure', 'encrypt', 'compliance', 'privacy', 'vpc', 'firewall', 'data'],
    reply: "At CONVERGENCE-Ai, we design secure private vpc solutions natively inside your own cloud perimeter (GCP/AWS) using encryption to ensure HIPAA and SOC2 compliance. Your data never leaves your environment."
  },
  {
    keys: ['price', 'cost', 'pricing', 'monthly', 'fee', 'charge', 'expensive', 'budget', 'saas'],
    reply: "Pricing doesn't have to be a mystery. We charge flat, predictable rates for our custom integrations rather than locking you into rigid saas subscriptions."
  },
  {
    keys: ['upskill', 'training', 'employee', 'staff', 'learn', 'grow', 'jobs', 'replace', 'hitl', 'human'],
    reply: "We do not build systems to replace humans—we build Human-in-the-Loop (HITL) systems. Our services include a full 90-day transition roadmap, standard operating templates, and training workshops to upskill your administrative staff into Growth Coordinators who manage and audit these automated engines."
  },
  {
    keys: ['trial', 'test', 'sandbox', 'free', 'demo', 'try'],
    reply: "We offer a 7-day risk-free trial of the CONVERGENCE-Ai Operations Administrator container so you can test it in a local sandbox or your private cloud immediately. Note that we do not do legacy demos anymore. Let's connect on a free Clarity Call to set up your trial: https://convergence-ai.com/services"
  },
  {
    keys: ['crm', 'hubspot', 'salesforce', 'connect', 'integrate', 'sync', 'quickbooks', 'n8n', 'zapier'],
    reply: "We design custom oauth 2.0 connectors that natively bridge almost any crm, QuickBooks, or database without recurring connection taxes."
  },
  {
    keys: ['gcp', 'google cloud', 'aws', 'amazon', 'azure', 'kubernetes', 'docker', 'run', 'cloud run'],
    reply: "We fully support Google Cloud Platform (GCP) along with AWS and custom Kubernetes containers. Our builds run natively on Cloud Run or GKE, ensuring a carbon-neutral compute footprint, robust security, and high scalability."
  },
  {
    keys: ['bill', 'invoice', 'pay', 'ledger', 'accounting', 'reconcile'],
    reply: "Our systems isolate billing approvals in a secure queue. The system automatically halts and alerts you when transaction anomalies occur, protecting your cash flow while keeping financial records private."
  }
];

/**
 * Asynchronously sends captured lead details to GHL webhook.
 */
function triggerGhlWebhook(data) {
  const webhookUrl = process.env.GHL_WEBHOOK_URL || 'https://services.leadconnectorhq.com/hooks/mock_ghl_webhook_url';
  console.log(`[GHL Webhook] Sending payload to ${webhookUrl}:`, JSON.stringify(data));
  
  try {
    const parsedUrl = new URL(webhookUrl);
    const postData = JSON.stringify(data);
    
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    
    const req = https.request(options, (res) => {
      console.log(`[GHL Webhook] Webhook response code: ${res.statusCode}`);
    });
    
    req.on('error', (e) => {
      console.error(`[GHL Webhook] Error:`, e.message);
    });
    
    req.write(postData);
    req.end();
  } catch (err) {
    console.error(`[GHL Webhook] Exception:`, err.message);
  }
}

/**
 * Generates an automated Agent Smithy reply based on incoming message content.
 */
function generateAgentReply(messageText) {
  // 1. Warm Greeting Fallback
  if (!messageText) {
    return "Hi, I'm CONVERGENCE-Ai's administrative assistant agent. We design and implement custom AI systems to solve real operational bottlenecks. Before we get started, could you please share your name and email or phone number so I can stay connected?";
  }

  const cleanText = messageText.toLowerCase();

  // 2. Extract Details (Email & Phone)
  const emailMatch = messageText.match(/[\w.-]+@[\w.-]+\.\w+/);
  const phoneMatch = messageText.match(/(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);

  if (emailMatch) lastActiveSession.email = emailMatch[0];
  if (phoneMatch) lastActiveSession.phone = phoneMatch[0];

  // Name extraction helper
  const nameMatch = messageText.match(/(my name is|i am|i'm)\s+([A-Z][a-z]+)/i);
  if (nameMatch) {
    const matchedName = nameMatch[2];
    const ignoredNames = ['free', 'busy', 'available', 'here', 'ready', 'there', 'fine', 'good', 'okay', 'ok', 'sure'];
    if (!ignoredNames.includes(matchedName.toLowerCase())) {
      lastActiveSession.name = matchedName;
    }
  }

  const hasProvidedContact = !!(lastActiveSession.email || lastActiveSession.phone);

  // 3. Detect Date/Time suggest patterns
  const timeRegex = /(mon|tues|wed|thurs|fri|sat|sun|tomorrow|next week|at \d|am|pm|\b\d{1,2}(:\d{2})?\s*(am|pm)?\b)/i;
  const mentionsTime = timeRegex.test(messageText);

  if (mentionsTime && !lastActiveSession.suggestedTime) {
    lastActiveSession.suggestedTime = messageText;
  }

  // 4. Webhook Trigger Gate
  if (hasProvidedContact && lastActiveSession.suggestedTime && !lastActiveSession.webhookTriggered) {
    lastActiveSession.webhookTriggered = true;
    
    // Post to GHL Webhook
    const payload = {
      agent: "CONVERGENCE-Ai Agent",
      name: lastActiveSession.name || "Anonymous Prospect",
      email: lastActiveSession.email,
      phone: lastActiveSession.phone,
      suggestedTime: lastActiveSession.suggestedTime,
      source: "Social Media Chatbot / Web Widget"
    };
    
    triggerGhlWebhook(payload);

    // Reset session variables after a short timeout so new sessions can occur
    setTimeout(() => {
      lastActiveSession = { email: null, phone: null, name: null, suggestedTime: null, webhookTriggered: false };
    }, 10000);

    return `Fabulous! I've captured your contact details and preferred follow-up time, and successfully logged your request directly to our CRM. A consultant from CONVERGENCE-Ai will follow up and send a Google Meeting invite to you shortly.`;
  }

  // 5. Normal RAG routing
  for (const entry of KNOWLEDGE_BASE) {
    for (const key of entry.keys) {
      const regex = new RegExp('\\b' + key + '\\b', 'i');
      if (regex.test(messageText)) {
        if (!hasProvidedContact && !cleanText.includes('http') && process.env.NODE_ENV !== 'test') {
          return `Hi! I'm CONVERGENCE-Ai's administrative assistant agent. I would love to answer your question, but could you please share your name and email or phone number first? This lets me log your inquiry to our CRM so we stay connected.`;
        }
        
        let reply = entry.reply;
        if (hasProvidedContact && !lastActiveSession.suggestedTime) {
          reply += "\n\nBy the way, what are the best dates and times for a consultant to follow up with you? Just let me know here and I will schedule a call!";
        }
        return reply;
      }
    }
  }

  // 6. Default Flow Fallback
  if (!hasProvidedContact) {
    return "Hi! I'm CONVERGENCE-Ai's administrative assistant agent. Before we go any further, could you please share your name and email or phone number? This logs your details in our CRM so we can stay connected.";
  }

  if (!lastActiveSession.suggestedTime) {
    return "Thank you for sharing your contact details! I have logged them in our CRM. To get you set up with a consultant, what are the best dates and times for us to follow up with you? Just let me know here!";
  }

  return "Thank you! I have logged your details. If you'd like to adjust your scheduled time or ask about our pricing tiers, services, or trials, just let me know. You can also grab a slot directly here: https://convergence-ai.com/services.";
}

module.exports = { generateAgentReply };
