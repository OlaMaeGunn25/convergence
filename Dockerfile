# =============================================================================
# CONVERGENCE-Ai — single-container production image
#
# One container runs the whole hub:
#   1. Vite production build of aiwx-admin-agent (served at /admin)
#   2. Express gateway aiwx-smb-auditor/server.js on :3003
#   3. System Chromium so aiwx-social-media-agent Puppeteer scripts run
#      headless with --no-sandbox / --disable-setuid-sandbox
#
# Build:  docker build -t convergence-ai .
# Run:    docker run --env-file .env -p 3003:3003 -v convergence-data:/data convergence-ai
# =============================================================================

# ---- Stage 1: build the admin dashboard (Vite) ------------------------------
FROM node:20-bookworm-slim AS admin-build

WORKDIR /build/aiwx-admin-agent
COPY aiwx-admin-agent/package*.json ./
RUN npm ci
COPY aiwx-admin-agent/ ./
RUN npm run build

# ---- Stage 2: runtime with Chromium -----------------------------------------
FROM node:20-bookworm-slim

# Install Chromium and every shared library headless Chrome needs, plus fonts
# so social-post screenshots render text correctly.
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    ca-certificates \
    fonts-liberation \
    fonts-noto-color-emoji \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libglib2.0-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libx11-6 \
    libxcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    xdg-utils \
    dumb-init \
    && rm -rf /var/lib/apt/lists/*

# Puppeteer must use the system Chromium instead of downloading its own copy.
ENV PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    NODE_ENV=production \
    PORT=3003 \
    CONVERGENCE_ROOT=/app

WORKDIR /app

# Install production dependencies per module (cached layers)
COPY aiwx-smb-auditor/package*.json ./aiwx-smb-auditor/
RUN cd aiwx-smb-auditor && npm install --omit=dev

COPY aiwx-social-media-agent/package*.json ./aiwx-social-media-agent/
RUN cd aiwx-social-media-agent && npm install --omit=dev

# Copy application source
COPY aiwx-smb-auditor/ ./aiwx-smb-auditor/
COPY aiwx-social-media-agent/ ./aiwx-social-media-agent/

# Bring in the compiled admin dashboard from the build stage
COPY --from=admin-build /build/aiwx-admin-agent/dist ./aiwx-admin-agent/dist

# Run as a non-root user; Chromium runs with --no-sandbox so no SUID needed.
RUN groupadd -r convergence && useradd -r -g convergence -G audio,video convergence \
    && mkdir -p /data /app/aiwx-smb-auditor/audits_cache /app/aiwx-smb-auditor/logs \
       /app/aiwx-social-media-agent/logs /app/aiwx-social-media-agent/config \
    && chown -R convergence:convergence /app /data

USER convergence

EXPOSE 3003

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://localhost:'+(process.env.PORT||3003)+'/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

# dumb-init reaps zombie Chromium processes left by crashed Puppeteer runs
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "aiwx-smb-auditor/server.js"]
