import { useState } from 'react';
import { motion } from 'framer-motion';
import type { FuzzFinding } from '../types';
import { Copy, CheckCircle2, ChevronRight, Hash, Cpu, GitBranch, Database, Target, AlertTriangle } from 'lucide-react';

interface FindingInspectorProps {
  finding: FuzzFinding;
}

export function FindingInspector({ finding }: FindingInspectorProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const severityLabel = finding.severity || 'Unavailable';
  const getSeverityColor = (sev: string) => {
    switch (sev.toUpperCase()) {
      case 'CRITICAL': return 'var(--accent-red)';
      case 'HIGH': return 'var(--accent-amber)';
      case 'MEDIUM': return 'var(--accent-blue)';
      case 'LOW': return 'var(--accent-green)';
      default: return 'var(--text-tertiary)';
    }
  };

  const confidenceLabel = typeof finding.confidence === 'number'
    ? `${finding.confidence}%`
    : 'Unavailable';

  const inputDisplay = finding.inputData != null
    ? (typeof finding.inputData === 'object' ? JSON.stringify(finding.inputData) : String(finding.inputData))
    : 'Unavailable';

  const traceFrames = Array.isArray(finding.trace) && finding.trace.length > 0
    ? finding.trace
    : null;

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
      {/* Header */}
      <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-surface-hover)' }}>
        <div className="finding-header">
          <div className="flex-col gap-2">
            <div className="flex items-center gap-2 mono text-xs text-secondary" style={{ flexWrap: 'wrap' }}>
              <Hash size={14} /> {finding.id}
              {finding.targetFunction && (
                <>
                  <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'var(--border-strong)' }} />
                  <Target size={14} /> {finding.targetFunction}()
                </>
              )}
            </div>
            <h3 style={{ fontSize: '18px', color: 'var(--text-primary)', fontWeight: 600, margin: 0, letterSpacing: '-0.01em' }}>
              {finding.type || 'Unknown Exception'}
            </h3>
          </div>
          <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
            <div className="badge badge-neutral flex items-center gap-1" style={{ color: getSeverityColor(severityLabel), border: `1px solid ${getSeverityColor(severityLabel)}40` }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: getSeverityColor(severityLabel) }} />
              {severityLabel.toUpperCase()}
            </div>
            <div className="badge badge-neutral" style={{ background: 'var(--bg-surface-active)' }}>
              {confidenceLabel !== 'Unavailable' ? `${confidenceLabel} confidence` : 'Confidence: Unavailable'}
            </div>
          </div>
        </div>
      </div>
      
      {/* Body */}
      <div className="finding-body" style={{ padding: '24px' }}>
        
        <div className="flex-col gap-6">
          <div>
            <div className="text-xs text-tertiary font-semibold uppercase tracking-wider" style={{ marginBottom: '8px' }}>Message</div>
            <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              {finding.message || 'Unavailable'}
            </div>
          </div>

          <div>
            <div className="text-xs text-tertiary font-semibold uppercase tracking-wider" style={{ marginBottom: '8px' }}>Trace Location</div>
            <div className="mono text-xs" style={{ padding: '16px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-app)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
              {finding.location || 'Unavailable'}
            </div>
          </div>

          <div>
            <div className="text-xs text-tertiary font-semibold uppercase tracking-wider" style={{ marginBottom: '8px' }}>Triggering Input</div>
            <div className="mono text-xs" style={{ padding: '16px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-app)', border: '1px solid var(--border-subtle)', color: 'var(--accent-amber)', wordBreak: 'break-all' }}>
              {inputDisplay}
            </div>
          </div>
        </div>

        <div className="finding-meta" style={{ paddingLeft: '24px', borderLeft: '1px solid var(--border-subtle)' }}>
          <div>
            <div className="text-xs text-tertiary font-semibold uppercase tracking-wider flex items-center gap-2" style={{ marginBottom: '8px' }}><Cpu size={14} /> Execution Trace</div>
            <div className="flex-col gap-2">
              {traceFrames ? traceFrames.map((frame, i) => (
                <div key={i} className="flex items-center gap-2 text-xs mono text-secondary">
                  {i === traceFrames.length - 1 
                    ? <ChevronRight size={12} style={{ color: 'var(--accent-red)' }} />
                    : <CheckCircle2 size={12} className="text-tertiary" />
                  }
                  <span style={{ wordBreak: 'break-all' }}>{frame}</span>
                </div>
              )) : (
                <div className="text-xs text-tertiary mono">Unavailable</div>
              )}
            </div>
          </div>

          <div>
            <div className="text-xs text-tertiary font-semibold uppercase tracking-wider flex items-center gap-2" style={{ marginBottom: '8px' }}><GitBranch size={14} /> Discovery Strategy</div>
            <div className="text-sm text-secondary">{finding.discoveryStrategy || 'Unavailable'}</div>
          </div>

          <div>
            <div className="text-xs text-tertiary font-semibold uppercase tracking-wider flex items-center gap-2" style={{ marginBottom: '8px' }}><Database size={14} /> Reproducibility</div>
            <div className="flex items-center gap-2 text-sm" style={{ color: finding.reproducible ? 'var(--accent-green)' : 'var(--text-tertiary)' }}>
              {finding.reproducible 
                ? <><CheckCircle2 size={16} /> Confirmed</>
                : <><AlertTriangle size={16} /> Not verified</>
              }
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
          <Copy size={14} className="text-secondary" />
          {copied ? 'Copied!' : 'Extract JSON Record'}
        </button>
      </div>
    </motion.div>
  );
}
