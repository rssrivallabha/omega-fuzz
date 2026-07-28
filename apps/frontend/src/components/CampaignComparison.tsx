import { motion, AnimatePresence } from 'framer-motion';
import type { CampaignHistoryEntry, FuzzFinding } from '../types';
import { X, GitCompare, AlertTriangle, CheckCircle2, Zap, ShieldAlert } from 'lucide-react';

interface CampaignComparisonProps {
  campaignA: CampaignHistoryEntry | null;
  campaignB: CampaignHistoryEntry | null;
  onClose: () => void;
}

export function CampaignComparison({ campaignA, campaignB, onClose }: CampaignComparisonProps) {
  if (!campaignA || !campaignB) return null;

  const getSeverityCounts = (findings: FuzzFinding[]) => {
    const counts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, OTHER: 0 };
    findings.forEach(f => {
      const sev = (f.severity || '').toUpperCase();
      if (sev in counts) {
        counts[sev as keyof typeof counts]++;
      } else {
        counts.OTHER++;
      }
    });
    return counts;
  };

  const sevA = getSeverityCounts(campaignA.findings);
  const sevB = getSeverityCounts(campaignB.findings);

  const getCrashTypes = (findings: FuzzFinding[]) => {
    const types = new Set(findings.map(f => f.type || 'Unknown'));
    return Array.from(types).join(', ') || 'None (Clean)';
  };

  const rows = [
    { label: 'Campaign ID', a: campaignA.id.slice(0, 8) + '...', b: campaignB.id.slice(0, 8) + '...' },
    { label: 'Target Name', a: campaignA.targetName || 'unknown', b: campaignB.targetName || 'unknown' },
    { label: 'Language', a: campaignA.language, b: campaignB.language },
    { label: 'Status', a: campaignA.status, b: campaignB.status },
    { label: 'Execution Duration', a: `${(campaignA.durationMs / 1000).toFixed(2)}s`, b: `${(campaignB.durationMs / 1000).toFixed(2)}s` },
    { label: 'Total Executions', a: campaignA.executions.toLocaleString(), b: campaignB.executions.toLocaleString(), isNumeric: true, valA: campaignA.executions, valB: campaignB.executions },
    { label: 'Throughput Rate', a: `${campaignA.stats.rate} /sec`, b: `${campaignB.stats.rate} /sec`, isNumeric: true, valA: campaignA.stats.rate, valB: campaignB.stats.rate },
    { label: 'Unique Findings', a: campaignA.findingsCount.toString(), b: campaignB.findingsCount.toString(), isDanger: true, valA: campaignA.findingsCount, valB: campaignB.findingsCount },
    { label: 'Expected Rejections', a: campaignA.stats.expectedRejections.toString(), b: campaignB.stats.expectedRejections.toString() },
    { label: 'Timeouts / Unresponsive', a: campaignA.stats.timeouts.toString(), b: campaignB.stats.timeouts.toString() },
    { 
      label: 'Severity Distribution', 
      a: `Crit: ${sevA.CRITICAL} | High: ${sevA.HIGH} | Med: ${sevA.MEDIUM}`, 
      b: `Crit: ${sevB.CRITICAL} | High: ${sevB.HIGH} | Med: ${sevB.MEDIUM}` 
    },
    { label: 'Unique Crash Types', a: getCrashTypes(campaignA.findings), b: getCrashTypes(campaignB.findings) },
  ];

  return (
    <AnimatePresence>
      <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(4px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="panel"
          style={{ width: '100%', maxWidth: '900px', maxHeight: '90vh', overflowY: 'auto', background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', padding: '24px' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <GitCompare size={24} className="text-brand" />
              <div>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>Side-by-Side Campaign Comparison</h3>
                <span className="text-xs text-tertiary">Analyzing divergence in AST discovery, execution metrics, and crash behavior</span>
              </div>
            </div>
            <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' }}>
              <X size={20} />
            </button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border-strong)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '12px', width: '25%' }}>Comparison Metric</th>
                  <th style={{ padding: '12px', width: '37.5%', background: 'rgba(255,255,255,0.02)' }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Campaign A</div>
                    <div className="text-xs text-tertiary mono">{campaignA.targetName || 'unknown'} ({new Date(campaignA.timestamp).toLocaleTimeString()})</div>
                  </th>
                  <th style={{ padding: '12px', width: '37.5%', background: 'rgba(255,255,255,0.02)' }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Campaign B</div>
                    <div className="text-xs text-tertiary mono">{campaignB.targetName || 'unknown'} ({new Date(campaignB.timestamp).toLocaleTimeString()})</div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => {
                  const isDiff = row.a !== row.b;
                  let highlightA = 'var(--text-primary)';
                  let highlightB = 'var(--text-primary)';

                  if (row.isDanger && row.valA !== undefined && row.valB !== undefined) {
                    if (row.valA > row.valB) highlightA = 'var(--accent-red)';
                    if (row.valB > row.valA) highlightB = 'var(--accent-red)';
                  } else if (row.isNumeric && row.valA !== undefined && row.valB !== undefined) {
                    if (row.valA > row.valB) highlightA = 'var(--accent-blue, #3b82f6)';
                    if (row.valB > row.valA) highlightB = 'var(--accent-blue, #3b82f6)';
                  }

                  return (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle)', backgroundColor: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                      <td style={{ padding: '12px', fontWeight: 500, color: 'var(--text-secondary)' }}>{row.label}</td>
                      <td style={{ padding: '12px', color: highlightA, fontWeight: isDiff ? 600 : 400 }} className="mono">{row.a}</td>
                      <td style={{ padding: '12px', color: highlightB, fontWeight: isDiff ? 600 : 400 }} className="mono">{row.b}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={onClose} className="panel" style={{ padding: '10px 20px', cursor: 'pointer', background: 'var(--bg-surface-active)', border: '1px solid var(--border-strong)', color: 'var(--text-primary)', fontWeight: 500 }}>
              Close Comparison
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
