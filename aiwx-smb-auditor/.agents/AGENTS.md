# Workspace System Rules - SMB External Audit Engine

## 🛡️ Scouring & Internet Search Heuristics

* **Rule-01: Name Cross-Referencing**
  Always extract and cross-reference any executive, attorney, or owner names found on the audited website when executing internet searches in `scourer.js` to ensure a thorough search effort.
  - Scan the scraped HTML and markdown for patterns (e.g. `[Name], Esq.`, `Attorney [Name]`, `Meet [Name]`, or roles like `Founder`, `Owner`, `Partner`, `Managing Partner`, `CEO`).
  - Pass these names into the scourer search query (using `OR` clauses) alongside the business name and domain to pull associated regulatory filings and recent public mentions.

## 🔌 Social Media Agent API Integration

The social media agent is located at `C:\Users\dahao\.gemini\antigravity\scratch\aiwx-social-media-agent`. Credentials and API settings are documented in detail in the sibling workspace system rules at [AGENTS.md](file:///c:/Users/dahao/.gemini/antigravity/scratch/aiwx-social-media-agent/.agents/AGENTS.md). Refer to that file for Meta, LinkedIn, Google Analytics 4, and headless browser session cookie parameters.

