import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, Cpu, CheckCircle2, XCircle, AlertTriangle, Search, ActivitySquare, Terminal } from 'lucide-react';
import type { FuzzStats, FuzzFinding } from '../types';

interface LiveDashboardProps {
  stats: FuzzStats;
  chartData: { time: string; rate: number }[];
  targetName: string;
  findings: FuzzFinding[];
  startTime: number;
  timeline: { id: string; time: string; message: string; isImportant: boolean }[];
  liveFeedEvents: any[];
  onStop: () => void;
  detectedLanguage: string;
  executionEnvironment: string;
}

const StatBox = ({ label, value, highlight = false, color = 'var(--text-primary)' }: { label: string, value: string | number, highlight?: boolean, color?: string }) => (
  <div className="stat-box">
    <div className="text-xs text-tertiary font-medium uppercase tracking-wider">{label}</div>
    <motion.div 
      key={String(value)}
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className="mono"
      style={{ fontSize: '1.25rem', fontWeight: highlight ? 600 : 400, color }}
    >
      {value}
    </motion.div>
  </div>
);

export function LiveDashboard({ stats, chartData, targetName, findings, startTime, timeline, liveFeedEvents, onStop, detectedLanguage, executionEnvironment }: LiveDashboardProps) {
  
  const getElapsed = () => {
    if (!startTime) return '00:00';
    const elapsed = Date.now() - startTime;
    const s = Math.floor(elapsed / 1000) % 60;
    const m = Math.floor(elapsed / 60000);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const feedEndRef = useRef<HTMLDivElement>(null);
  const feedContainerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (feedContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = feedContainerRef.current;
      // Only auto-scroll if user is near the bottom (within 100px) to allow scrolling up
      if (scrollHeight - scrollTop - clientHeight < 100) {
        feedContainerRef.current.scrollTop = scrollHeight;
      }
    }
  }, [liveFeedEvents]);

  return (
    <div className="flex-col" style={{ minHeight: '100vh', background: 'var(--bg-app)', color: 'var(--text-primary)' }}>
      
      {/* Header */}
      <div className="dashboard-header">
        <div className="flex items-center gap-4" style={{ flexWrap: 'wrap' }}>
          <div className="flex items-center gap-2">
            <Activity size={16} color="var(--accent-brand)" />
            <span className="font-semibold tracking-tight">Omega Fuzz</span>
          </div>
          <div style={{ width: '1px', height: '16px', background: 'var(--border-strong)' }} />
          <div className="flex items-center gap-2 mono text-sm text-secondary">
            <Terminal size={14} /> {targetName || 'unknown'}
          </div>
          <div className="badge badge-neutral">{detectedLanguage}</div>
          <div className="badge badge-neutral">{executionEnvironment}</div>
        </div>
        
        <div className="flex items-center gap-4" style={{ flexWrap: 'wrap' }}>
          <div className="flex items-center gap-2 mono text-sm">
            <span className="text-tertiary">ELAPSED</span>
            <span className="text-secondary">{getElapsed()}</span>
          </div>
          <div className="flex items-center gap-2">
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-green)', boxShadow: '0 0 8px var(--accent-green)' }} />
            <span className="text-sm font-medium text-secondary">Running</span>
          </div>
          <button 
            onClick={onStop}
            className="text-xs"
            style={{ padding: '4px 12px', background: 'var(--bg-surface-hover)', border: '1px solid var(--border-strong)', borderRadius: '4px', cursor: 'pointer', color: 'var(--text-secondary)' }}
          >
            Halt
          </button>
        </div>
      </div>

      {/* Metrics Strip */}
      <div className="dashboard-metrics">
        <StatBox label="Executions" value={stats.executed.toLocaleString()} highlight />
        <StatBox label="Exec/sec" value={stats.rate.toLocaleString()} />
        <StatBox label="Targets" value={stats.targets} />
        <StatBox label="Expected Rej" value={stats.expectedRejections} color="var(--text-secondary)" />
        <StatBox label="Findings" value={stats.findings} highlight color={stats.findings > 0 ? 'var(--accent-red)' : 'var(--text-primary)'} />
      </div>

      {/* Main Grid */}
      <div className="dashboard-grid">
        
        {/* Live Feed & Throughput */}
        <div className="flex-col gap-6" style={{ overflow: 'hidden' }}>
          
          <div className="panel flex-col" style={{ flex: 2, overflow: 'hidden' }}>
             <div className="flex items-center gap-2 text-sm font-medium text-secondary" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
               <ActivitySquare size={16} /> Live Execution Feed
             </div>
             <div ref={feedContainerRef} style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <AnimatePresence initial={false}>
                  {liveFeedEvents.map((evt) => {
                    const isSuccess = evt.outcome === 'SUCCESS';
                    const isExpected = evt.outcome === 'EXPECTED_REJECTION';
                    const isException = evt.outcome === 'UNEXPECTED_EXCEPTION';
                    
                    return (
                      <motion.div
                        key={evt.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mono flex-col justify-center"
                        style={{
                          padding: isException ? '16px' : '8px 12px',
                          background: isException ? 'rgba(239, 68, 68, 0.05)' : 'var(--bg-surface-hover)',
                          border: `1px solid ${isException ? 'var(--accent-red)' : 'var(--border-subtle)'}`,
                          borderRadius: '6px',
                          fontSize: '13px',
                          gap: '12px'
                        }}
                      >
                        <div className="flex items-center gap-4" style={{ overflow: 'hidden' }}>
                          <div style={{ width: '80px', flexShrink: 0, color: isException ? 'var(--accent-red)' : isExpected ? 'var(--text-tertiary)' : 'var(--accent-green)', fontWeight: isException ? 600 : 400 }}>
                            {isException ? 'CRASH' : isExpected ? 'REJECTED' : 'PASS'}
                          </div>
                          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>
                            {typeof evt.inputData === 'object' ? JSON.stringify(evt.inputData) : String(evt.inputData)}
                          </div>
                        </div>

                        {isException && (
                          <div className="flex-col gap-2" style={{ paddingLeft: '96px', fontSize: '12px' }}>
                            <div className="flex gap-2">
                              <span className="text-tertiary uppercase tracking-wider" style={{ fontSize: '10px' }}>Exception</span>
                              <span style={{ color: 'var(--text-primary)' }}>{evt.exceptionType || 'Unknown'}</span>
                            </div>
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
                <div ref={feedEndRef} />
             </div>
          </div>

          <div className="panel flex-col" style={{ flex: 1, minHeight: '180px' }}>
             <div className="flex items-center gap-2 text-sm font-medium text-secondary" style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
               <Activity size={16} /> Throughput (exec/sec)
             </div>
             <div style={{ flex: 1, padding: '16px', display: 'flex', alignItems: 'flex-end', gap: '4px' }}>
               {chartData.map((d, i) => (
                 <div key={i} style={{ 
                   flex: 1, 
                   background: 'var(--accent-blue)', 
                   height: `${Math.min(100, (d.rate / (Math.max(...chartData.map(c => c.rate), 100))) * 100)}%`,
                   opacity: 0.8,
                   minHeight: '2px',
                   borderRadius: '2px 2px 0 0'
                 }} />
               ))}
             </div>
          </div>

        </div>

        {/* Timeline */}
        <div className="panel flex-col" style={{ overflow: 'hidden' }}>
          <div className="flex items-center gap-2 text-sm font-medium text-secondary" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
            <Search size={16} /> Timeline
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
            <div className="flex-col gap-6">
              {timeline.map((t, idx) => (
                <motion.div 
                  key={t.id} 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex gap-4 relative"
                >
                  {idx !== timeline.length - 1 && (
                    <div style={{ position: 'absolute', left: '5px', top: '24px', bottom: '-24px', width: '1px', background: 'var(--border-subtle)' }} />
                  )}
                  <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: t.isImportant ? 'var(--accent-red)' : 'var(--bg-surface-active)', border: '2px solid var(--bg-surface)', zIndex: 1, marginTop: '4px', flexShrink: 0 }} />
                  <div className="flex-col gap-1">
                    <div className="text-sm font-medium" style={{ color: t.isImportant ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                      {t.message}
                    </div>
                    <div className="text-xs text-tertiary mono">{t.time}</div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
