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
    <div className="flex-col gap-2">
      <AnimatePresence initial={false}>
        {events.map((ev) => (
          <motion.div
            key={ev.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-4"
            style={{ 
              padding: '8px 0',
              borderBottom: '1px solid var(--border-subtle)',
            }}
          >
            <div className="mono text-tertiary" style={{ minWidth: '70px', fontSize: '12px' }}>
              {ev.time}
            </div>
            <div 
              className="mono"
              style={{ fontSize: '13px', color: ev.isImportant ? 'var(--text-primary)' : 'var(--text-secondary)' }}
            >
              {ev.message}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
