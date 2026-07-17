import { motion, AnimatePresence } from 'framer-motion';
import type { FuzzStats, FuzzFinding } from '../types';
import { ThroughputChart } from './ThroughputChart';
import { FindingInspector } from './FindingInspector';
import { Timeline } from './Timeline';
import { ExecutionVisualizer } from './ExecutionVisualizer';
import { StopCircle } from 'lucide-react';

interface LiveDashboardProps {
  stats: FuzzStats;
  targetName: string;
  startTime: number;
  chartData: { time: string; rate: number }[];
  timeline: { id: string; time: string; message: string; isImportant: boolean }[];
  findings: FuzzFinding[];
  seedSamples: any[];
  detectedLanguage: string;
  onStop: () => void;
}

export function LiveDashboard({ stats, targetName, startTime, chartData, timeline, findings, seedSamples, detectedLanguage, onStop }: LiveDashboardProps) {
  
  const formatTime = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    return `${h.toString().padStart(2, '0')}:${(m % 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
  };

  const elapsed = formatTime(Date.now() - startTime);

  return (
    <motion.div 
      className="flex-col" 
      style={{ minHeight: '100vh', padding: '2rem 3rem', position: 'relative', zIndex: 1 }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Background glow for high budget feel */}
      <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: '80%', height: '500px', background: 'radial-gradient(ellipse at top, rgba(6, 182, 212, 0.15), transparent 70%)', zIndex: -1, pointerEvents: 'none' }} />

      {/* Header */}
      <header className="flex justify-between items-center" style={{ marginBottom: '2rem' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: 700, margin: 0, color: '#fff', letterSpacing: '-0.02em' }}>
            {targetName ? `TARGET: ${targetName}` : 'DETECTING TARGET...'}
          </h2>
          <div className="flex items-center gap-3 text-secondary mono" style={{ marginTop: '8px', fontSize: '13px' }}>
            <span style={{ color: 'var(--accent-cyan)' }}>{detectedLanguage.toUpperCase()}</span>
            <span>&middot;</span>
            <span className="text-amber">Isolated Engine Active</span>
            <span>&middot;</span>
            <span>{elapsed} ELAPSED</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-tertiary mono" style={{ background: 'rgba(34, 197, 94, 0.1)', padding: '6px 12px', borderRadius: '999px', color: '#22c55e', border: '1px solid rgba(34, 197, 94, 0.2)' }}>
            <span className="pulse-dot" style={{ backgroundColor: '#22c55e' }}></span>
            SYSTEM ONLINE
          </div>
          <button 
            onClick={onStop}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '8px 16px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontFamily: 'monospace', fontWeight: 600, transition: 'all 0.2s' }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
          >
            <StopCircle size={16} />
            HALT CAMPAIGN
          </button>
        </div>
      </header>

      {/* Execution Visualizer Side-by-Side */}
      <ExecutionVisualizer seeds={seedSamples} language={detectedLanguage} />

      {/* Metrics Strip */}
      <div 
        style={{ marginBottom: '2rem', padding: '24px 32px', background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-lg)', backdropFilter: 'blur(10px)', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '2rem' }}
      >
        <div className="flex-col">
          <span className="text-tertiary mono" style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--accent-cyan)' }}>Total Executions</span>
          <span className="mono" style={{ fontSize: '32px', color: '#fff', marginTop: '4px', fontWeight: 700 }}>
            {stats.executed.toLocaleString()}
          </span>
        </div>
        <div className="flex-col">
          <span className="text-tertiary mono" style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--accent-cyan)' }}>Throughput</span>
          <span className="mono" style={{ fontSize: '32px', color: '#fff', marginTop: '4px', fontWeight: 700 }}>
            {stats.rate.toLocaleString()} <span style={{ fontSize: '14px', color: '#a1a1aa', fontWeight: 400 }}>exec/s</span>
          </span>
        </div>
        <div className="flex-col">
          <span className="text-tertiary mono" style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--accent-cyan)' }}>Targets Discovered</span>
          <span className="mono" style={{ fontSize: '32px', color: '#fff', marginTop: '4px', fontWeight: 700 }}>
            {stats.targets}
          </span>
        </div>
        <div className="flex-col">
          <span className="text-tertiary mono" style={{ fontSize: '11px', textTransform: 'uppercase', color: stats.findings > 0 ? '#ef4444' : 'var(--accent-cyan)' }}>Anomalies Detected</span>
          <span className="mono" style={{ fontSize: '32px', color: stats.findings > 0 ? '#ef4444' : '#fff', marginTop: '4px', fontWeight: 700, textShadow: stats.findings > 0 ? '0 0 20px rgba(239,68,68,0.5)' : 'none' }}>
            {stats.findings}
          </span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem' }}>
        
        <div className="flex-col gap-6">
          {/* Throughput Chart */}
          <div style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-lg)', padding: '20px 0', height: '280px', backdropFilter: 'blur(10px)' }}>
            <div style={{ padding: '0 24px', marginBottom: '16px', fontFamily: 'monospace', color: '#a1a1aa', display: 'flex', justifyContent: 'space-between' }}>
                <span>EXECUTION_THROUGHPUT_MATRIX</span>
                <span style={{ color: 'var(--accent-cyan)' }}>LIVE</span>
            </div>
            <div style={{ height: '200px' }}>
              <ThroughputChart data={chartData} />
            </div>
          </div>

          {/* Findings Inspector */}
          {findings.length > 0 && (
            <div className="flex-col gap-4 mt-4">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ef4444', fontFamily: 'monospace', fontSize: '14px' }}>
                <span className="pulse-dot" style={{ background: '#ef4444' }}></span>
                CRITICAL DISCOVERIES ({findings.length})
              </div>
              <AnimatePresence>
                {findings.map((f) => (
                  <FindingInspector key={f.id} finding={f} />
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>

        <div className="flex-col gap-6">
          {/* Timeline */}
          <div style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-lg)', minHeight: '400px', backdropFilter: 'blur(10px)' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--glass-border)', fontFamily: 'monospace', color: '#a1a1aa' }}>
                EVENT_LOG_STREAM
            </div>
            <div style={{ padding: '20px' }}>
                <Timeline events={timeline} />
            </div>
          </div>
        </div>

      </div>
    </motion.div>
  );
}
