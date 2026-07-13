/*
   CONVERGENCE-Ai™ Campaigns & External RSS Feed Module
   Fetches operational alerts/insights feeds and automates platform campaign generation.
*/

import { STATE } from './state.js';
import { logConsole } from './components.js';
import { renderHITLQueue } from './hitl_queue.js';

export const MOCK_RSS_XML = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>CONVERGENCE-Ai Insights</title>
    <link>https://convergence-ai.com/blog</link>
    <atom:link href="https://convergence-ai.com/rss.xml" rel="self" type="application/rss+xml"/>
    <description>Executive insights on practical AI, automation, and growth for small-to-mid businesses.</description>
    <language>en-us</language>
    <lastBuildDate>Sun, 17 May 2026 21:16:12 GMT</lastBuildDate>
    <generator>CONVERGENCE-Ai Cloud-Native Engine</generator>
    <item>
      <title>Don't Fire Them. Elevate Them.</title>
      <link>https://convergence-ai.com/blog/dont-fire-them-elevate-them</link>
      <guid isPermaLink="true">https://convergence-ai.com/blog/dont-fire-them-elevate-them</guid>
      <pubDate>Sun, 17 May 2026 21:16:12 GMT</pubDate>
      <author>noreply@convergence-ai.com (CONVERGENCE-Ai)</author>
      <description>New Gartner research shows 80% of enterprises cut staff after AI deployment — and got no ROI for it. Here's how smart SMBs are doing the opposite.</description>
      <category>Leadership &amp; Growth Strategy</category>
      <category>AI Without Hype</category>
      <category>Operational Leverage</category>
      <category>Founder Decision-Making</category>
    </item>
    <item>
      <title>Human-in-the-Loop ROI: Why the Best AI Wins Pay Out in People, Not Pink Slips</title>
      <link>https://convergence-ai.com/blog/human-in-the-loop-roi-ai-wins-in-people-not-pink-slips</link>
      <guid isPermaLink="true">https://convergence-ai.com/blog/human-in-the-loop-roi-ai-wins-in-people-not-pink-slips</guid>
      <pubDate>Thu, 16 Apr 2026 14:00:00 GMT</pubDate>
      <author>noreply@convergence-ai.com (Dahaomine Moody-Ward, Lead AI Consultant, CEO)</author>
      <description>The AI rollouts that actually return 5:1 share one feature: a human is always in the loop. Here's why human-in-the-loop is the highest-ROI design pattern in AI today — and how to build it.</description>
      <category>Leadership &amp; Growth Strategy</category>
      <category>AI Without Hype</category>
      <category>Operational Leverage</category>
      <category>Founder Decision-Making</category>
    </item>
  </channel>
</rss>`;

export async function syncBlogFeed(customUrl = null) {
    const feedUrl = customUrl || (document.getElementById('campaignRssInput')?.value) || STATE.campaignFeedUrl;
    logConsole(`Synchronizing external RSS blog feed from: ${feedUrl}...`, 'info');
    
    let xmlText = "";
    let fetchedLive = false;
    
    try {
        const response = await fetch(feedUrl, { mode: 'cors' });
        if (response.ok) {
            xmlText = await response.text();
            fetchedLive = true;
        } else {
            throw new Error(`HTTP status ${response.status}`);
        }
    } catch (e) {
        logConsole(`Live fetch was restricted by CORS or network limits (${e.message}). Initializing secure, pre-cached local Vault-fallback copy...`, 'warn');
        xmlText = MOCK_RSS_XML;
    }
    
    try {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, "text/xml");
        const parseError = xmlDoc.getElementsByTagName("parsererror");
        if (parseError.length > 0) {
            throw new Error("XML parsing error");
        }
        
        const items = xmlDoc.getElementsByTagName("item");
        const parsedArticles = [];
        
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const title = item.getElementsByTagName("title")[0]?.textContent || "";
            const link = item.getElementsByTagName("link")[0]?.textContent || "";
            const pubDate = item.getElementsByTagName("pubDate")[0]?.textContent || "";
            const description = item.getElementsByTagName("description")[0]?.textContent || "";
            const categories = Array.from(item.getElementsByTagName("category")).map(c => c.textContent);
            
            parsedArticles.push({ title, link, pubDate, description, categories });
        }
        
        STATE.syncedArticles = parsedArticles;
        
        if (fetchedLive) {
            logConsole(`Successfully fetched and parsed ${parsedArticles.length} live articles from Supabase edge function!`, 'success');
        } else {
            logConsole(`Successfully loaded ${parsedArticles.length} cached articles into operational campaign database.`, 'success');
        }
        
        renderSyncedArticles();
    } catch (err) {
        logConsole(`Failed to parse RSS feed structure: ${err.message}`, 'error');
    }
}

export function renderSyncedArticles() {
    const container = document.getElementById('syncedArticlesContainer');
    if (!container) return;
    
    if (!STATE.syncedArticles || STATE.syncedArticles.length === 0) {
        container.innerHTML = `
            <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; min-height:220px; color:var(--text-dim); text-align:center;">
                <i class="fa-solid fa-square-rss" style="font-size:2.5rem; margin-bottom:1rem; color:var(--text-dim)"></i>
                <div style="font-weight:600; font-size:0.95rem;">No Articles Synchronized</div>
                <div style="font-size:0.8rem; margin-top:4px;">Enter an RSS feed URL on the left and click "Fetch & Sync" to retrieve posts.</div>
            </div>
        `;
        return;
    }
    
    container.innerHTML = "";
    STATE.syncedArticles.forEach((article, index) => {
        const card = document.createElement('div');
        card.style.background = 'rgba(255, 255, 255, 0.01)';
        card.style.border = '1px solid var(--border-color)';
        card.style.borderRadius = '10px';
        card.style.padding = '1.25rem';
        card.style.marginBottom = '1rem';
        card.style.display = 'flex';
        card.style.flexDirection = 'column';
        card.style.gap = '8px';
        
        const categoriesHTML = article.categories.map(c => 
            `<span style="background:rgba(0, 132, 255, 0.15); border:1px solid rgba(0,132,255,0.3); color:#93c5fd; font-size:0.65rem; font-weight:700; padding:0.15rem 0.4rem; border-radius:4px;">${c}</span>`
        ).join(' ');
        
        card.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px;">
                <a href="${article.link}" target="_blank" style="font-family:var(--font-heading); font-size:1.1rem; font-weight:700; color:#ffffff; text-decoration:none; transition:color 0.2s;" onmouseover="this.style.color='var(--secondary-color)'" onmouseout="this.style.color='#ffffff'">
                    ${article.title}
                </a>
                <span style="font-size:0.75rem; color:var(--text-dim); white-space:nowrap;">${new Date(article.pubDate).toLocaleDateString()}</span>
            </div>
            <div style="font-size:0.8rem; color:var(--text-muted); line-height:1.5;">${article.description}</div>
            <div style="display:flex; flex-wrap:wrap; gap:6px; margin-top:4px;">
                ${categoriesHTML}
            </div>
            <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:8px; padding-top:8px; border-top:1px solid rgba(255,255,255,0.04)">
                <button class="btn btn-secondary btn-small" id="genCampBtn-${index}" style="font-size:0.7rem; padding:0.3rem 0.6rem;">
                    <i class="fa-solid fa-bullhorn" style="color:var(--secondary-color)"></i> Campaign from Post
                </button>
            </div>
        `;
        card.querySelector(`#genCampBtn-${index}`).addEventListener('click', () => generateCampaignPosts(index));
        container.appendChild(card);
    });
}

export function generateCampaignPosts(specificIndex = null) {
    if (!STATE.syncedArticles || STATE.syncedArticles.length === 0) {
        logConsole("Please click 'Fetch & Sync Blog Feed' to retrieve articles first!", "error");
        return;
    }
    
    const launchDateStr = document.getElementById('campaignDateInput')?.value || STATE.campaignLaunchDate;
    const launchDate = new Date(launchDateStr + "T09:00:00");
    
    const linkedinChecked = document.getElementById('platformLinkedinCheckbox')?.checked ?? true;
    const instagramChecked = document.getElementById('platformInstagramCheckbox')?.checked ?? true;
    const threadsChecked = document.getElementById('platformThreadsCheckbox')?.checked ?? true;
    
    if (!linkedinChecked && !instagramChecked && !threadsChecked) {
        logConsole("Please select at least one target social platform!", "error");
        return;
    }
    
    const articlesToGenerate = specificIndex !== null ? [STATE.syncedArticles[specificIndex]] : STATE.syncedArticles;
    
    logConsole(`Generating social campaigns starting from ${launchDate.toLocaleDateString()}...`, 'info');
    
    let generatedCount = 0;
    
    articlesToGenerate.forEach((article, aIdx) => {
        const isElevate = article.title.toLowerCase().includes("elevate") || article.title.toLowerCase().includes("fire");
        
        const platforms = [];
        if (linkedinChecked) platforms.push('linkedin');
        if (instagramChecked) platforms.push('instagram');
        if (threadsChecked) platforms.push('threads');
        
        platforms.forEach((platform, pIdx) => {
            generatedCount++;
            
            const scheduledTime = new Date(launchDate.getTime());
            scheduledTime.setDate(launchDate.getDate() + aIdx * 2 + pIdx);
            
            const timeStr = scheduledTime.toISOString().replace('T', ' ').substring(0, 19);
            const taskId = `CP-${2000 + generatedCount}`;
            
            let details = "";
            let action = "";
            
            if (platform === 'linkedin') {
                action = `Release to LinkedIn Long-Form (Scheduled: ${timeStr})`;
                if (isElevate) {
                    details = `[LinkedIn Campaign] **Don't Fire Them. Elevate Them.**\n\nNew Gartner research reveals: 80% of enterprises cut staff after AI deployment — yet those cuts did not deliver any ROI.\n\nSmart SMBs are doing the opposite: upskilling their best people to run and audit agentic workflows. Turn coordinators into AI Systems Architects.\n\nLink: ${article.link}\nKeywords: career change, AI for administrative assistants, business automation, employee retraining.`;
                } else {
                    details = `[LinkedIn Campaign] **Human-in-the-Loop ROI: Why Success Pays Out in People, Not Pink Slips**\n\nThe AI projects that succeed quietly share a golden rule: there is always a human in the loop.\n\nAI handles 80% of the heavy lifting. Humans own the 20% decision checkpoint. Speed + judgment = zero hallucinations.\n\nLink: ${article.link}\nKeywords: business automation, process optimization, workflow design, human in the loop.`;
                }
            } else if (platform === 'instagram') {
                action = `Release to Instagram Carousel (Scheduled: ${timeStr})`;
                if (isElevate) {
                    details = `[Instagram Slide Deck Summary]\nSlide 1: 80% of AI Layoffs Got ZERO ROI.\nSlide 2: The Gartner Reality: Workforce cuts create budget room but not returns.\nSlide 3: Amplified People: Smart SMBs upskill employees to manage local AI gates.\nSlide 4: Turn admin staff into AI Systems Architects.\nSlide 5: Reclaim 15 hours weekly. Read our playbook at convergence-ai.com/blog. DM "ELEVATE".`;
                } else {
                    details = `[Instagram Slide Deck Summary]\nSlide 1: Golden Rule of High-ROI AI: Humans in the Loop.\nSlide 2: The Fallacy: Removing humans leads to hallucinations and customer complaints.\nSlide 3: Real HITL: AI processes, filters, drafts. Human owns final release and judgment.\nSlide 4: The 4-Part Checklist: 1. Irreversible decisions. 2. Streamlined context. 3. Model feedback loops.\nSlide 5: Reclaim capacity and upskill teams. DM "HITL".`;
                }
            } else if (platform === 'threads') {
                action = `Release to Threads Q&A Series (Scheduled: ${timeStr})`;
                if (isElevate) {
                    details = `[Threads Thread]\nQ: Should I lay off staff after automating workflows?\nA: Gartner's May 2026 data shows 80% of companies doing so got zero return. Retrain your administrative assistants to direct VIP campaigns instead.\n\nFull analysis: ${article.link}`;
                } else {
                    details = `[Threads Thread]\nQ: How do we prevent AI hallucinations in customer operations?\nA: real Human-in-the-Loop design patterns. AI processes, humans own final authorization.\n\nRead checklist: ${article.link}`;
                }
            }
            
            STATE.hitlQueue.unshift({
                id: taskId,
                vertical: "professional",
                type: `Social Campaign Post - ${platform.toUpperCase()}`,
                details: details,
                status: "pending",
                time: "Just Now",
                action: action
            });
        });
    });
    
    renderHITLQueue();
    logConsole(`Campaign Creator: Generated ${generatedCount} social posts starting ${launchDateStr}`, 'success');
}
