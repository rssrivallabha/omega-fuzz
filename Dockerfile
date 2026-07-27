# Multi-language runtime container for Omega Fuzz Backend (Railway / Render / Fly.io / VPS)
FROM ubuntu:22.04

# Prevent interactive prompts during apt install
ENV DEBIAN_FRONTEND=noninteractive

# Install Node.js 20, Python 3, Golang, build-essential (C/C++), and utilities
RUN apt-get update && apt-get install -y \
    curl \
    python3 \
    python3-pip \
    golang \
    build-essential \
    sqlite3 \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy root manifests and configuration
COPY package*.json turbo.json ./
COPY apps/api ./apps/api
COPY apps/orchestrator ./apps/orchestrator
COPY packages/fuzz-engine ./packages/fuzz-engine
COPY apps/worker ./apps/worker
COPY packages ./packages

# Install dependencies and build backend packages
RUN npm install
RUN npm run build -- --filter=api...

# Configure environment variables
ENV NODE_ENV=production
ENV PORT=3001
ENV OMEGA_ALLOW_UNSAFE_LOCAL_EXECUTION=true

# Expose API port
EXPOSE $PORT

# Start the Express API server
WORKDIR /app/apps/api
CMD ["npm", "run", "start"]
