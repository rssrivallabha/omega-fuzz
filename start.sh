#!/bin/bash
set -e

echo "[STARTUP] Omega Fuzz Container Compute Engine initializing..."
echo "[STARTUP] Verifying system runtimes and compilers:"
node --version
python3 --version || python --version || echo "[WARN] Python3 not found"
go version || echo "[WARN] Go not found"
gcc --version | head -n 1 || echo "[WARN] GCC not found"

echo "[STARTUP] Environment Configuration:"
echo " - PORT: ${PORT:-3001}"
echo " - NODE_ENV: ${NODE_ENV:-production}"
echo " - OMEGA_ALLOW_UNSAFE_LOCAL_EXECUTION: ${OMEGA_ALLOW_UNSAFE_LOCAL_EXECUTION:-true}"

echo "[STARTUP] Starting Persistent Express API Compute Daemon..."
cd /app/apps/api
exec npm run start
