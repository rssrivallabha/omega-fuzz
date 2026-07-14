import express from 'express';
import cors from 'cors';
import { EventEmitter } from 'events';
import { CampaignEvent } from '@omega-fuzz/canonical-model';

export const campaignEvents = new EventEmitter();
const app = express();
app.use(cors());

// Internal buffer to allow batching
const eventBuffer: CampaignEvent[] = [];
let batchTimeout: NodeJS.Timeout | null = null;

// The orchestrator emits this internally
campaignEvents.on('internal_event', (event: CampaignEvent) => {
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

  const onBatchedEvents = (events: CampaignEvent[]) => {
     res.write(`data: ${JSON.stringify({ type: 'BATCH', events })}\n\n`);
  };

  campaignEvents.on('batched_events', onBatchedEvents);

  req.on('close', () => {
    campaignEvents.off('batched_events', onBatchedEvents);
  });
});

app.listen(3001, () => {
  console.log('SSE API running on http://localhost:3001');
});
