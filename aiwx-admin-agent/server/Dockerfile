# Stage 1: Build & Dependency Installation
FROM node:20-alpine AS builder
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm ci --only=production

# Stage 2: Hardened Runtime
FROM node:20-alpine
WORKDIR /usr/src/app

# Copy built dependencies and server files
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY package.json ./
COPY index.js ./

# Set environment and expose port
ENV PORT=8080
ENV NODE_ENV=production
EXPOSE 8080

# Use a non-root user for security
USER node

# Health check endpoint verification (using native node fetch)
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://localhost:8080/api/status').then(res => res.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

# Boot server
CMD [ "node", "index.js" ]
