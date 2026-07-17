import { motion, AnimatePresence } from 'framer-motion';

interface TimelineEvent {
  id: string;
  time: string;
  message: string;
  isImportant: boolean;
}

interface TimelineProps {
  events: TimelineEvent[];
}

export function Timeline({ events }: TimelineProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <AnimatePresence initial={false}>
        {events.map((ev) => (
          <motion.div
            key={ev.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-4"
            style={{ 
              padding: '8px 0',
              borderBottom: '1px solid rgba(255,255,255,0.05)',
            }}
          >
            <div style={{ minWidth: '70px', fontSize: '12px', fontFamily: 'monospace', color: '#71717a' }}>
              {ev.time}
            </div>
            <div 
              style={{ fontSize: '13px', fontFamily: 'monospace', color: ev.isImportant ? '#fff' : '#a1a1aa' }}
            >
              {ev.message}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
