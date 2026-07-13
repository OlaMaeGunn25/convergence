const fs = require('fs');
const path = require('path');
const { scrapeDomain } = require('./scraper');
const { analyzeFootprint } = require('./analyzer');
const { analyzeWorkforce } = require('./workforce');
const { scourBusiness } = require('./scourer');

let FirecrawlApp;
try {
  FirecrawlApp = require('@mendable/firecrawl-js').default || require('@mendable/firecrawl-js');
} catch (e) {
  // gracefully ignore if not found
}

/**
 * Scouts local prospects in a given niche and location, runs SWOT audits,
 * and compiles deep research profiles.
 */
async function scoutLocalProspects(niche, location, apiKey) {
  if (!apiKey) {
    throw new Error('Firecrawl API Key is required for scouting.');
  }
  if (!FirecrawlApp) {
    throw new Error('Firecrawl SDK is not loaded or failed to compile.');
  }

  const app = new FirecrawlApp({ apiKey });
  const query = `"${niche}" "${location}" site:.com OR site:.org OR site:.net`;
  console.log(`[Scouting] Executing lead search on Firecrawl: ${query}`);

  let searchRes;
  try {
    searchRes = await app.search(query, { limit: 8 });
  } catch (err) {
    throw new Error(`Firecrawl search request failed: ${err.message}`);
  }

  if (!searchRes || !searchRes.data) {
    throw new Error('Firecrawl search returned empty results.');
  }

  // Extract unique domains
  const domains = [];
  const domainRegex = /^(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+)/;
  
  for (const item of searchRes.data) {
    const url = item.url || item.urlVal;
    if (url) {
      const match = url.match(domainRegex);
      if (match) {
        const domain = match[1].toLowerCase();
        
        // Exclude social networks, directories, or system sites
        const isExcluded = [
          'facebook.com', 'linkedin.com', 'instagram.com', 'yelp.com', 
          'twitter.com', 'yellowpages.com', 'threads.net', 'google.com', 
          'youtube.com', 'pinterest.com', 'wikipedia.org', 'mapquest.com'
        ].some(d => domain.includes(d));

        if (!isExcluded && !domains.includes(domain)) {
          domains.push(domain);
        }
      }
    }
  }

  console.log(`[Scouting] Found ${domains.length} candidate domains:`, domains);

  // Limit candidates to 3 for execution safety and speed
  const candidates = domains.slice(0, 3);
  const results = [];

  for (const domain of candidates) {
    try {
      console.log(`[Scouting] Starting deep audit on candidate: ${domain}`);
      
      // 1. Scrape domain
      const scrapedData = await scrapeDomain(domain, apiKey);
      
      // 2. Scour the web for regulatory filings and workforce details
      const teamNames = (scrapedData.rawTeamData || []).map(m => m.name);
      const scourerData = await scourBusiness(
        scrapedData.domain, 
        scrapedData.businessName, 
        scrapedData.vertical, 
        apiKey,
        teamNames
      );

      // 3. Perform SWOT analysis
      const pitches = analyzeFootprint(scrapedData);
      
      // 4. Formulate Workforce AI-HITL upskilling plan
      const workforceData = analyzeWorkforce(scrapedData);

      // Construct a unified deep-research profile
      results.push({
        domain: scrapedData.domain,
        businessName: scrapedData.businessName || domain,
        vertical: scrapedData.vertical || 'Professional Services',
        gaps: pitches.map(p => ({
          title: p.gapTitle,
          severity: p.severity,
          observed: p.observedGaps,
          impact: p.impactStatement,
          service: p.aiwxService,
          roi: p.estimatedRoi,
          pitch: p.copyPastePitch
        })),
        personnel: scrapedData.rawTeamData || [],
        scoured: scourerData,
        workforce: workforceData,
        rawScrape: scrapedData
      });

    } catch (err) {
      console.error(`[Scouting] Failed to compile audit for candidate ${domain}:`, err.message);
    }
  }

  return results;
}

module.exports = { scoutLocalProspects };
