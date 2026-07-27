import express from 'express';
import cors from 'cors';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { spawnSync } from 'child_process';
import { startCampaign } from '@omega-fuzz/orchestrator';
// ============================================================================
// EVENT BUS ABSTRACTION (Message Broker Design for Scalability)
// ============================================================================
export interface EventBus {
  publish(campaignId: string, event: any): void;
  subscribe(campaignId: string, callback: (event: any) => void): () => void;
}

export class InMemoryEventBus implements EventBus {
  private emitter = new EventEmitter();
  constructor() {
    this.emitter.setMaxListeners(500);
  }
  publish(campaignId: string, event: any): void {
    this.emitter.emit(`campaign:${campaignId}`, event);
  }
  subscribe(campaignId: string, callback: (event: any) => void): () => void {
    const channel = `campaign:${campaignId}`;
    this.emitter.on(channel, callback);
    return () => this.emitter.off(channel, callback);
  }
}

// Global EventBus instance (Ready for RedisPubSubEventBus in multi-node worker setups)
export const globalEventBus: EventBus = new InMemoryEventBus();

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

interface CampaignRecord {
  id: string;
  status: 'RUNNING' | 'COMPLETED' | 'ERROR';
  events: any[];
  report: any | null;
  error: string | null;
  startTime: number;
  endTime?: number;
}

const campaignRegistry = new Map<string, CampaignRecord>();

// ============================================================================
// AUTOMATIC CAMPAIGN RETENTION CLEANUP
// ============================================================================
const CAMPAIGN_RETENTION_MS = parseInt(process.env.CAMPAIGN_RETENTION_MS || '3600000', 10); // Default 1 hour
setInterval(() => {
  const now = Date.now();
  let cleaned = 0;
  for (const [id, record] of campaignRegistry.entries()) {
    if ((record.status !== 'RUNNING') && (now - record.startTime > CAMPAIGN_RETENTION_MS)) {
      campaignRegistry.delete(id);
      cleaned++;
    }
  }
  if (cleaned > 0) {
    console.log(`[${new Date().toISOString()}] [INFO] Auto-cleaned ${cleaned} expired campaigns from registry.`);
  }
}, 120000);

// ============================================================================
// HEALTH ENDPOINT & MONITORING (/health)
// ============================================================================
app.get('/health', (req, res) => {
  const memory = process.memoryUsage();
  res.status(200).json({
    status: 'ok',
    service: 'omega-fuzz-backend',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    activeCampaigns: Array.from(campaignRegistry.values()).filter(c => c.status === 'RUNNING').length,
    totalCampaigns: campaignRegistry.size,
    memoryUsage: {
      rssMb: Math.round(memory.rss / 1024 / 1024),
      heapUsedMb: Math.round(memory.heapUsed / 1024 / 1024),
      heapTotalMb: Math.round(memory.heapTotal / 1024 / 1024)
    },
    environment: process.env.NODE_ENV || 'production',
    allowUnsafeExecution: process.env.OMEGA_ALLOW_UNSAFE_LOCAL_EXECUTION === 'true'
  });
});

// ============================================================================
// REAL-TIME SSE TELEMETRY STREAM (/api/stream)
// ============================================================================
app.get('/api/stream', (req, res) => {
  const campaignId = req.query.campaignId as string;
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  if (typeof (res as any).flush === 'function') (res as any).flush();

  res.write(':\n\n'); // SSE Keep-alive comment ping

  if (!campaignId || !campaignRegistry.has(campaignId)) {
    res.write(`data: ${JSON.stringify({ type: 'BATCH', events: [{ payload: { type: 'CAMPAIGN_ERROR', error: 'Campaign not found or expired in container registry' } }] })}\n\n`);
    return res.end();
  }

  const record = campaignRegistry.get(campaignId)!;

  // Replay historical telemetry accumulated since campaign initialization
  if (record.events.length > 0) {
    res.write(`data: ${JSON.stringify({ type: 'BATCH', events: [...record.events] })}\n\n`);
    if (typeof (res as any).flush === 'function') (res as any).flush();
  }

  if (record.status === 'COMPLETED' || record.status === 'ERROR') {
    return setTimeout(() => res.end(), 100);
  }

  const eventBuffer: any[] = [];
  let batchTimeout: NodeJS.Timeout | null = null;

  const flushBuffer = () => {
    if (!res.writableEnded && eventBuffer.length > 0) {
      res.write(`data: ${JSON.stringify({ type: 'BATCH', events: [...eventBuffer] })}\n\n`);
      if (typeof (res as any).flush === 'function') (res as any).flush();
      eventBuffer.length = 0;
    }
  };

  const unsubscribe = globalEventBus.subscribe(campaignId, (event: any) => {
    eventBuffer.push(event);
    if (!batchTimeout) {
      batchTimeout = setTimeout(() => {
        flushBuffer();
        batchTimeout = null;
      }, 50);
    }

    if (event?.payload?.type === 'CAMPAIGN_COMPLETED' || event?.payload?.type === 'CAMPAIGN_ERROR') {
      if (batchTimeout) {
        clearTimeout(batchTimeout);
        batchTimeout = null;
      }
      flushBuffer();
      setTimeout(() => {
        if (!res.writableEnded) res.end();
      }, 200);
    }
  });

  req.on('close', () => {
    if (batchTimeout) clearTimeout(batchTimeout);
    unsubscribe();
  });
});

// ============================================================================
// CAMPAIGN CREATION LIFECYCLE (POST /api/fuzz -> Instant 202 Accepted)
// ============================================================================
app.post('/api/fuzz', (req, res) => {
  console.log(`[${new Date().toISOString()}] [DEBUG] Request received on /api/fuzz`);
  const { code, maxInputs } = req.body;
  if (!code) {
    return res.status(400).json({ error: 'Code is required' });
  }

  process.env.OMEGA_ALLOW_UNSAFE_LOCAL_EXECUTION = 'true';
  const limit = typeof maxInputs === 'number' ? Math.max(25, Math.min(250, maxInputs)) : 150;
  const campaignId = uuidv4();

  const record: CampaignRecord = {
    id: campaignId,
    status: 'RUNNING',
    events: [],
    report: null,
    error: null,
    startTime: Date.now()
  };
  campaignRegistry.set(campaignId, record);

  console.log(`[${new Date().toISOString()}] [INFO] Campaign ${campaignId} initialized. Returning immediate 202 Accepted.`);
  res.status(202).json({ status: 'ACCEPTED', campaignId, message: 'Campaign is executing on persistent worker.' });

  // Asynchronous Worker Campaign Execution
  const localEmitter = new EventEmitter();
  localEmitter.on('internal_event', (event: any) => {
    record.events.push(event);
    globalEventBus.publish(campaignId, event);
  });

        startCampaign(code, localEmitter, limit)
    
    .then((report) => {
      record.status = 'COMPLETED';
      record.report = report;
      record.endTime = Date.now();
      const completeEvent = {
        schemaVersion: '1.0.0',
        eventId: uuidv4(),
        timestamp: new Date().toISOString(),
        payload: { type: 'CAMPAIGN_COMPLETED', durationMs: record.endTime - record.startTime, campaignId }
      };
      record.events.push(completeEvent);
      globalEventBus.publish(campaignId, completeEvent);
      console.log(`[${new Date().toISOString()}] [INFO] Campaign ${campaignId} completed successfully in ${record.endTime - record.startTime}ms`);
    })
    .catch((err: any) => {
      record.status = 'ERROR';
      record.error = err?.message || String(err);
      record.endTime = Date.now();
      const errorEvent = {
        schemaVersion: '1.0.0',
        eventId: uuidv4(),
        timestamp: new Date().toISOString(),
        payload: { type: 'CAMPAIGN_ERROR', error: record.error, campaignId }
      };
      record.events.push(errorEvent);
      globalEventBus.publish(campaignId, errorEvent);
      console.error(`[${new Date().toISOString()}] [ERROR] Campaign ${campaignId} failed: ${record.error}`);
    });
});

// ============================================================================
// CANONICAL REPORT RETRIEVAL (/api/report/:id)
// ============================================================================
app.get('/api/report/:id', (req, res) => {
  const campaignId = req.params.id;
  if (!campaignRegistry.has(campaignId)) {
    return res.status(404).json({ error: 'Campaign not found or has been purged.' });
  }
  const record = campaignRegistry.get(campaignId)!;
  if (record.status === 'RUNNING') {
    return res.status(202).json({ status: 'RUNNING', message: 'Campaign is actively running.' });
  }
  if (record.status === 'ERROR') {
    return res.status(500).json({ status: 'ERROR', error: record.error });
  }
  return res.status(200).json(record.report);
});

// ============================================================================
// ENVIRONMENT VALIDATION & PERSISTENT SERVER STARTUP
// ============================================================================
const validateEnvironment = () => {
  console.log(`[${new Date().toISOString()}] [INFO] Performing startup toolchain validation...`);
  const pythonCheck = spawnSync('python', ['--version'], { encoding: 'utf8', timeout: 5000 });
  const python3Check = spawnSync('python3', ['--version'], { encoding: 'utf8', timeout: 5000 });
  const nodeCheck = spawnSync('node', ['--version'], { encoding: 'utf8', timeout: 5000 });
  
  if (nodeCheck.error && nodeCheck.status !== 0) {
    console.warn(`[${new Date().toISOString()}] [WARN] Node executable not detected on PATH.`);
  } else {
    console.log(`[${new Date().toISOString()}] [INFO] Node runtime detected: ${nodeCheck.stdout?.trim() || 'OK'}`);
  }

  if (python3Check.status === 0 || pythonCheck.status === 0) {
    const pyVer = python3Check.stdout?.trim() || python3Check.stderr?.trim() || pythonCheck.stdout?.trim() || pythonCheck.stderr?.trim();
    console.log(`[${new Date().toISOString()}] [INFO] Python runtime detected: ${pyVer}`);
  } else {
    console.warn(`[${new Date().toISOString()}] [WARN] Python toolchain not found on PATH. Python AST parsing may fallback or fail.`);
  }

  process.env.OMEGA_ALLOW_UNSAFE_LOCAL_EXECUTION = 'true';
  console.log(`[${new Date().toISOString()}] [INFO] Environment validation complete. OMEGA_ALLOW_UNSAFE_LOCAL_EXECUTION enabled.`);
};

validateEnvironment();

const PORT = parseInt(process.env.PORT || '3001', 10);
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`[${new Date().toISOString()}] [INFO] Omega Fuzz Compute Service running persistently on http://0.0.0.0:${PORT}`);
});

// ============================================================================
// GRACEFUL SHUTDOWN HANDLING
// ============================================================================
const handleShutdown = (signal: string) => {
  console.log(`[${new Date().toISOString()}] [INFO] Received ${signal}. Initiating graceful shutdown...`);
  server.close(() => {
    console.log(`[${new Date().toISOString()}] [INFO] HTTP server closed cleanly.`);
    process.exit(0);
  });
  setTimeout(() => {
    console.error(`[${new Date().toISOString()}] [ERROR] Forced shutdown after 10-second timeout.`);
    process.exit(1);
  }, 10000).unref();
};

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

export default app;
