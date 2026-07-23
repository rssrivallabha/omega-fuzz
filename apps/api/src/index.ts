import express from 'express';
import cors from 'cors';
import { EventEmitter } from 'events';
import { CampaignEvent } from '@omega-fuzz/canonical-model';

export const campaignEvents = new EventEmitter();
const app = express();
app.use(cors());
app.use(express.json());

// Internal buffer to allow batching
const eventBuffer: any[] = [];
let batchTimeout: NodeJS.Timeout | null = null;

// The orchestrator emits this internally
campaignEvents.on('internal_event', (event: any) => {
    eventBuffer.push(event);
    if (!batchTimeout) {
        batchTimeout = setTimeout(() => {
            campaignEvents.emit('batched_events', [...eventBuffer]);
            eventBuffer.length = 0;
            batchTimeout = null;
        }, 50); // 50ms batching window
    }
});

app.get('/api/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // Send initial ping
  res.write(':\n\n');

  const onBatchedEvents = (events: any[]) => {
     res.write(`data: ${JSON.stringify({ type: 'BATCH', events })}\n\n`);
  };

  campaignEvents.on('batched_events', onBatchedEvents);

  req.on('close', () => {
    campaignEvents.off('batched_events', onBatchedEvents);
  });
});

app.post('/api/fuzz', (req, res) => {
  const { code, maxInputs } = req.body;
  if (!code) {
    return res.status(400).json({ error: 'Code is required' });
  }

  // Force allow unsafe local execution for the test environment
  process.env.OMEGA_ALLOW_UNSAFE_LOCAL_EXECUTION = 'true';

  const limit = typeof maxInputs === 'number' ? Math.max(25, Math.min(250, maxInputs)) : 150;

  // Set up SSE headers on the POST response
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const localEmitter = new EventEmitter();
  const eventBuffer: any[] = [];
  let batchTimeout: NodeJS.Timeout | null = null;

  localEmitter.on('internal_event', (event: any) => {
    eventBuffer.push(event);
    if (!batchTimeout) {
      batchTimeout = setTimeout(() => {
        res.write(`data: ${JSON.stringify({ type: 'BATCH', events: [...eventBuffer] })}\n\n`);
        if (typeof (res as any).flush === 'function') (res as any).flush();
        eventBuffer.length = 0;
        batchTimeout = null;
      }, 50);
    }
  });

  // Trigger the orchestrator
  import('@omega-fuzz/orchestrator').then(({ startCampaign }) => {
    startCampaign(code, localEmitter, limit)
      .then(() => {
        setTimeout(() => res.end(), 200); // Give time for final batch to flush
      })
      .catch((err) => {
        console.error(err);
        res.end();
      });
  });
});

if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  app.listen(3001, () => {
    console.log('SSE API running on http://localhost:3001');
  });
}

export default app;
