import { motion } from 'framer-motion';
import type { FuzzFinding } from '../types';
import { ShieldAlert, Copy, CheckCircle2, ChevronRight, Hash, Database, GitBranch, Cpu, Target } from 'lucide-react';

interface FindingInspectorProps {
  finding: FuzzFinding;
}

export function FindingInspector({ finding }: FindingInspectorProps) {
  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const getSeverityColor = (severity: string = 'HIGH') => {
    switch (severity) {
      case 'CRITICAL': return 'var(--accent-danger)';
      case 'HIGH': return 'var(--accent-orange)';
      case 'MEDIUM': return 'var(--accent-warning)';
      default: return 'var(--text-secondary)';
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="panel"
      style={{ 
        position: 'relative',
        overflow: 'hidden',
        background: 'var(--bg-surface)'
      }}
    >
      {/* Forensic Header */}
      <div style={{ padding: '24px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-surface-hover)' }}>
        <div className="flex justify-between items-start">
          <div className="flex-col gap-2">
            <div className="flex items-center gap-2 mono text-xs text-secondary font-medium">
              <Hash size={14} /> {finding.id}
              <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'var(--border-strong)' }} />
              <Target size={14} /> process_order()
            </div>
            <h3 style={{ fontSize: '18px', color: 'var(--text-primary)', fontWeight: 600, margin: 0, letterSpacing: '-0.01em' }}>
              {finding.type || 'Unexpected Exception'}
            </h3>
          </div>
          <div className="flex gap-2">
            <div className="badge badge-neutral flex items-center gap-1" style={{ color: getSeverityColor('HIGH'), border: `1px solid ${getSeverityColor('HIGH')}40` }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: getSeverityColor('HIGH') }} /> HIGH SEVERITY
            </div>
            <div className="badge badge-neutral" style={{ background: 'var(--bg-surface-active)' }}>
              98% CONFIDENCE
            </div>
          </div>
        </div>
      </div>
      
      {/* Forensic Body */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px', padding: '24px' }}>
        
        <div className="flex-col gap-6">
          <div>
            <div className="text-xs text-tertiary font-semibold uppercase tracking-wider mb-2">Message</div>
            <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              {finding.message || 'Execution crashed during bounds testing.'}
            </div>
          </div>

          <div>
            <div className="text-xs text-tertiary font-semibold uppercase tracking-wider mb-2">Trace Location</div>
            <div className="mono text-xs" style={{ padding: '16px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-app)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
              {finding.location}
            </div>
          </div>

          <div>
            <div className="text-xs text-tertiary font-semibold uppercase tracking-wider mb-2">Minimized Input</div>
            <div className="mono text-xs" style={{ padding: '16px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-app)', border: '1px solid var(--border-subtle)', color: 'var(--accent-warning)', wordBreak: 'break-all' }}>
              {'{ "price": -1, "discount": 0 }'}
            </div>
          </div>
        </div>

        <div className="flex-col gap-6" style={{ paddingLeft: '24px', borderLeft: '1px solid var(--border-subtle)' }}>
          <div>
            <div className="text-xs text-tertiary font-semibold uppercase tracking-wider mb-2 flex items-center gap-2"><Cpu size={14} /> Execution Path</div>
            <div className="flex-col gap-2">
              <div className="flex items-center gap-2 text-xs mono text-secondary"><CheckCircle2 size={12} className="text-tertiary" /> Type validation</div>
              <div className="flex items-center gap-2 text-xs mono text-secondary"><CheckCircle2 size={12} className="text-tertiary" /> Required fields</div>
              <div className="flex items-center gap-2 text-xs mono" style={{ color: 'var(--accent-danger)' }}><ChevronRight size={12} /> Discount logic</div>
            </div>
          </div>

          <div>
            <div className="text-xs text-tertiary font-semibold uppercase tracking-wider mb-2 flex items-center gap-2"><GitBranch size={14} /> Discovery Strategy</div>
            <div className="text-sm text-secondary">Constraint Synthesis (Boundary Shift)</div>
          </div>

          <div>
            <div className="text-xs text-tertiary font-semibold uppercase tracking-wider mb-2 flex items-center gap-2"><Database size={14} /> Reproducibility</div>
            <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--accent-success)' }}>
              <CheckCircle2 size={16} /> Confirmed (10/10)
            </div>
          </div>
        </div>

      </div>

      <div className="flex justify-end items-center" style={{ padding: '16px 24px', borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-surface-hover)' }}>
        <button 
          onClick={() => handleCopy(JSON.stringify(finding, null, 2))}
          style={{ 
            background: 'var(--bg-surface)', 
            border: '1px solid var(--border-strong)', 
            color: 'var(--text-primary)', 
            padding: '8px 16px', 
            borderRadius: 'var(--radius-sm)', 
            cursor: 'pointer', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px', 
            fontSize: '12px', 
            fontWeight: 500,
            transition: 'background 0.1s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-surface-active)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'var(--bg-surface)'}
        >
          <Copy size={14} className="text-secondary" /> Extract JSON Record
        </button>
      </div>
    </motion.div>
  );
}
