# CLAUDE.md - Development Rules & Guidelines

Welcome to the **SMB External Audit Engine** codebase. Please adhere strictly to the following standards and instructions.

## 🚀 Running the Project

- **Install Dependencies:** `npm install`
- **Start Development Server:** `npm start` (Runs Express backend at http://localhost:3000)
- **Start Backend with Nodemon (if installed):** `npm run dev`
- **Execute Automated Tests:** `npm test`

## 📋 Strict Architectural Principles

1. **Modularity & Separation of Concerns:**
   - **Tech Stack Analyzer (`lib/analyzer.js`):** Parses technological footprints, dependencies, hosting platforms, and maps them to a SWOT analysis. Keep this strictly isolated.
   - **Workforce Upskilling & AI Readiness (`lib/workforce.js`):** Focuses entirely on role mapping, digital literacy heatmaps, and HITL transition plans. Keep this strictly isolated.
   - **Ingestion & Fallbacks (`lib/scraper.js`):** Orchestrates domain scanning with `@mendable/firecrawl-js`.

2. **Scraper Safety & Resiliency:**
   - **DO NOT overwrite or deprecate** the Firecrawl integration logic without explicit approval.
   - Always maintain the **Premium Mock Fallback** system in `lib/scraper.js`. If `FIRECRAWL_API_KEY` is not defined in `.env` (or is invalid), the crawler must gracefully pivot to generating highly descriptive domain data structures based on the target domain URL, allowing the dashboard to function beautifully out-of-the-box.

3. **Code Safety & Quality:**
   - Ensure all network and file I/O operations are wrapped in standard `try/catch` handlers with clean logging.
   - Run unit tests (`npm test`) to verify all modules and scoring algorithms produce valid, structured JSON results before any commit or release.
   - Maintain modern JavaScript standards: use ES modules or clear CommonJS requires uniformly (defaulting to CommonJS for ease of running in standard Node.js without transpile steps).

## 🎨 Premium Visual Theme
- The user interface is a Glassmorphic obsidian dashboard utilizing dark obsidian backdrops, electric indigo shadows, glowing neon emerald details, and vibrant coral warning tones.
- Avoid external CSS libraries unless absolutely required; write elegant, clean vanilla CSS inside `/public/css/styles.css`.
