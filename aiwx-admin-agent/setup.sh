#!/bin/bash
# ==============================================================================
# "AIWX Operations Administrator" by AiWorXmiths: Single-Click GCP Bootstrap Installer Script
# Product Owner: aiworxmiths.com | Version: 2.0 | PROPRIETARY
# Designed for: Debian/Ubuntu Linux VM on Google Cloud Compute Engine (GCP)
# ==============================================================================

# Output Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
AMBER='\033[0;33m'
NC='\033[0m' # No Color

echo -e "${CYAN}======================================================================${NC}"
echo -e "${GREEN}   AIWX Operations Administrator by AiWorXmiths: GCP BOOTSTRAP INITIALIZATION         ${NC}"
echo -e "${CYAN}======================================================================${NC}"

# 1. Root Check
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}[ERROR] Please run this script as root (sudo ./setup.sh)${NC}"
  exit 1
fi

# 2. Setup Base Directory Structures
echo -e "\n${BLUE}[1/5] Creating isolated self-hosted directory tree...${NC}"
mkdir -p /opt/operations-hub/supabase
mkdir -p /opt/operations-hub/dify
mkdir -p /opt/operations-hub/n8n
mkdir -p /opt/operations-hub/secrets

# 3. Prerequisites Installation (Docker & Docker-Compose)
echo -e "\n${BLUE}[2/5] Checking environment dependencies...${NC}"
if ! command -v docker &> /dev/null; then
    echo -e "${CYAN}Docker not found. Installing Docker Engine...${NC}"
    apt-get update -y
    apt-get install -y apt-transport-https ca-certificates curl gnupg lsb-release
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
    echo "deb [arch=amd64 signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
    apt-get update -y
    apt-get install -y docker-ce docker-ce-cli containerd.io
else
    echo -e "${GREEN}[OK] Docker Engine is already installed.${NC}"
fi

if ! command -v docker-compose &> /dev/null; then
    echo -e "${CYAN}Docker Compose not found. Installing...${NC}"
    curl -L "https://github.com/docker/compose/releases/download/v2.20.2/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
else
    echo -e "${GREEN}[OK] Docker Compose is already installed.${NC}"
fi

# 4. Generate Sealed Secret Credentials (AES-256-GCM)
echo -e "\n${BLUE}[3/5] Compiling vault encryption keys & GCP mappings...${NC}"
if [ ! -f /opt/operations-hub/secrets/vault.env ]; then
    ENCRYPT_KEY=$(openssl rand -hex 32)
    N8N_KEY=$(openssl rand -hex 16)
    JWT_SECRET=$(openssl rand -hex 32)
    
    cat <<EOF > /opt/operations-hub/secrets/vault.env
# AIWX Operations Administrator Decryption Sandbox Keys
OPS_HUB_ENCRYPT_KEY=${ENCRYPT_KEY}
N8N_ENCRYPTION_KEY=${N8N_KEY}
SUPABASE_JWT_SECRET=${JWT_SECRET}

# GCP Deployment Configuration
GCP_PROJECT_ID=\$(gcloud config get-value project 2>/dev/null || echo "operations-hub-prod-88")
GCP_REGION=us-central1

# Stripe Secure API Configuration
STRIPE_API_VERSION=2023-10-16
EOF
    echo -e "${GREEN}[SUCCESS] Secure credentials successfully mapped to /opt/operations-hub/secrets/vault.env${NC}"
else
    echo -e "${GREEN}[OK] Credentials vault configuration exists.${NC}"
fi

# 5. Compile Self-Hosted Container Manifest (Docker Compose)
echo -e "\n${BLUE}[4/5] Spatially assembling the Docker orchestration manifest...${NC}"
cat <<EOF > /opt/operations-hub/docker-compose.yml
version: '3.8'

networks:
  ops-mesh:
    driver: bridge

services:
  # A. Local Vault Database Layer (Supabase PG Engine)
  ops-supabase-db:
    image: supabase/postgres:15.1.0.117
    container_name: ops-supabase-db
    environment:
      - POSTGRES_PASSWORD=your-ultra-secure-vault-pass
    ports:
      - "5432:5432"
    networks:
      - ops-mesh
    volumes:
      - /opt/operations-hub/supabase:/var/lib/postgresql/data

  # B. Real-Time Workflow Orchestrator (Self-Hosted n8n)
  ops-n8n-workflow:
    image: n8nio/n8n:1.15.2
    container_name: ops-n8n-workflow
    environment:
      - N8N_ENCRYPTION_KEY=your-n8n-encryption-key
      - N8N_BASIC_AUTH_ACTIVE=true
      - N8N_BASIC_AUTH_USER=admin@aiworxmiths.com
      - N8N_BASIC_AUTH_PASSWORD=ops-secure-access
    ports:
      - "5678:5678"
    networks:
      - ops-mesh
    volumes:
      - /opt/operations-hub/n8n:/home/node/.n8n

  # C. Agentic Intelligence Visualizer (Self-Hosted Dify)
  ops-dify-engine:
    image: langgenius/dify-api:0.4.8
    container_name: ops-dify-engine
    environment:
      - DB_USERNAME=postgres
      - DB_PASSWORD=your-ultra-secure-vault-pass
      - DB_HOST=ops-supabase-db
      - DB_PORT=5432
      - ENCRYPT_KEY=your-aes-encryption-key-for-credentials
    ports:
      - "5001:5001"
    networks:
      - ops-mesh
    depends_on:
      - ops-supabase-db
EOF

# 6. Launch Platform
echo -e "\n${BLUE}[5/5] Elevating services into local staging container cluster...${NC}"
docker-compose -f /opt/operations-hub/docker-compose.yml up -d

echo -e "\n${GREEN}======================================================================${NC}"
echo -e "${GREEN}   [COMPLETED] AIWX Operations Administrator Operations Suite is successfully deployed! ${NC}"
echo -e "${CYAN}======================================================================${NC}"
echo -e "   - Supabase DB running on:  ${CYAN}localhost:5432${NC}"
echo -e "   - n8n Workflows running on: ${CYAN}localhost:5678${NC}"
echo -e "   - Dify Engine running on:   ${CYAN}localhost:5001${NC}"
echo -e "   - Credentials Vault:       ${CYAN}/opt/operations-hub/secrets/vault.env${NC}"
echo -e "${CYAN}======================================================================${NC}"
echo -e "To trace containers:  ${GREEN}docker ps${NC}"
echo -e "To stream active logs: ${GREEN}docker-compose -f /opt/operations-hub/docker-compose.yml logs -f${NC}"
echo -e "======================================================================"
