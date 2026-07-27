# Omega Fuzz Deployment Guide: Railway Compute Backend + Vercel Frontend

Omega Fuzz is a high-performance computational fuzzing engine that requires persistent process memory, real-time Server-Sent Events (SSE) telemetry, and native compiler runtimes (`python3`, `go`, `g++`, `node`). As such, the production deployment architecture separates the static UI frontend from the containerized computational execution backend.

---

## 🏗 Canonical Production Architecture

* **Frontend (React / Vite):** Hosted on **Vercel** (Static Global Edge Delivery & High Performance SPA).
* **Backend API & Orchestrator:** Hosted on **Railway** (or Render / Fly.io / VPS) running persistently inside an Ubuntu Docker container configured with multi-language toolchains.
* **Communication Protocol:** Decoupled Async REST (`202 Accepted`) + Persistent SSE Streaming (`GET /api/stream?campaignId=:id`).

---

## 🚀 Part 1: Deploy Backend Compute Service to Railway

1. **Create Project on Railway:**
   * Go to [Railway.app](https://railway.app/) and create a new project.
   * Select **Deploy from GitHub repo** and select `rssrivallabha/omega-fuzz`.
2. **Select Dockerfile Build:**
   * Railway will automatically discover `railway.toml` and `Dockerfile` in the repository root and initiate an automated multi-language container build.
3. **Set Environment Variables in Railway:**
   In your Railway service **Variables** dashboard, ensure the following variables are defined:
   ```env
   PORT=3001
   NODE_ENV=production
   OMEGA_ALLOW_UNSAFE_LOCAL_EXECUTION=true
   CAMPAIGN_RETENTION_MS=3600000
   ```
4. **Generate Public Domain:**
   * Under **Settings -> Networking**, click **Generate Domain** (e.g., `omega-fuzz-backend.up.railway.app`).
   * Railway will immediately route incoming HTTPS requests directly to port 3001 and monitor service liveliness via the `/health` endpoint.

---

## 🌐 Part 2: Connect Vercel Frontend to Railway Backend

1. Go to your **Vercel Dashboard** for the frontend project (`omega-fuzz-api`).
2. Navigate to **Project Settings -> Environment Variables**.
3. Add the following variable pointing to your Railway backend URL:
   * **Key:** `VITE_API_URL`
   * **Value:** `https://your-railway-domain.up.railway.app` *(Do NOT include trailing slash)*
4. **Redeploy Vercel Frontend:**
   * Go to **Deployments** and click **Redeploy** on the latest build to embed the new persistent compute backend URL into the production SPA bundle.

---

## 🐳 Local Container Development (Docker Compose)

To run the full production container environment locally for development and offline fuzzing:
```bash
# Build and run persistent container service with Docker Compose
docker-compose up --build -d

# Verify Container Health
curl http://localhost:3001/health
```

### Direct Docker Run Command
```bash
docker build -t omega-fuzz-backend .
docker run -p 3001:3001 -e PORT=3001 -e NODE_ENV=production -e OMEGA_ALLOW_UNSAFE_LOCAL_EXECUTION=true omega-fuzz-backend
```

---

## 🔬 Architecture Verification & Liveliness Checks

Once deployed on Railway, verify the operational status of the compute daemon by querying the `/health` endpoint:
```bash
curl https://your-railway-domain.up.railway.app/health
```

**Expected JSON response:**
```json
{
  "status": "ok",
  "service": "omega-fuzz-backend",
  "timestamp": "2026-07-27T10:55:00.000Z",
  "uptime": 1420,
  "activeCampaigns": 0,
  "totalCampaigns": 0,
  "memoryUsage": {
    "rssMb": 85,
    "heapUsedMb": 34,
    "heapTotalMb": 48
  },
  "environment": "production",
  "allowUnsafeExecution": true
}
```
