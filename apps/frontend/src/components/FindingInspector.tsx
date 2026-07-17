import { motion } from 'framer-motion';
import type { FuzzFinding } from '../types';
import { AlertTriangle, Copy } from 'lucide-react';

interface FindingInspectorProps {
  finding: FuzzFinding;
}

export function FindingInspector({ finding }: FindingInspectorProps) {
  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      style={{ 
        background: 'rgba(239, 68, 68, 0.05)',
        border: '1px solid rgba(239, 68, 68, 0.3)',
        borderRadius: 'var(--radius-lg)',
        padding: '24px',
        backdropFilter: 'blur(10px)',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: '#ef4444' }} />
      <div className="flex justify-between items-center" style={{ marginBottom: '1rem' }}>
        <div className="flex items-center gap-2">
          <AlertTriangle color="#ef4444" size={20} />
          <h3 style={{ fontSize: '16px', color: '#fff', fontFamily: 'monospace', fontWeight: 600 }}>{finding.type || 'UNEXPECTED_EXCEPTION'}</h3>
        </div>
        <span style={{ color: '#a1a1aa', fontFamily: 'monospace', fontSize: '12px' }}>{finding.id}</span>
      </div>
      
      <div style={{ marginBottom: '1rem' }}>
        <div style={{ marginBottom: '4px', color: '#a1a1aa', fontSize: '12px', fontFamily: 'monospace' }}>FAULT_LOCATION</div>
        <div style={{ padding: '12px', borderRadius: 'var(--radius-sm)', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)', color: '#fff', fontFamily: 'monospace', fontSize: '14px', wordBreak: 'break-all' }}>
          {finding.location}
        </div>
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <div style={{ marginBottom: '4px', color: '#a1a1aa', fontSize: '12px', fontFamily: 'monospace' }}>STACK_TRACE_MESSAGE</div>
        <div style={{ padding: '12px', borderRadius: 'var(--radius-sm)', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', fontFamily: 'monospace', fontSize: '14px' }}>
          {finding.message || 'No explicit message provided by the runtime.'}
        </div>
      </div>

      <div className="flex justify-between items-center" style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="flex items-center gap-2 mono" style={{ fontSize: '12px', color: '#10b981' }}>
          <span className="pulse-dot" style={{ background: '#10b981' }}></span> CONFIRMED_REPRODUCIBLE
        </div>
        <button 
          onClick={() => handleCopy(finding.location)}
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '6px 12px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontFamily: 'monospace' }}
        >
          <Copy size={14} /> COPY_TRACE
        </button>
      </div>
    </motion.div>
  );
}
