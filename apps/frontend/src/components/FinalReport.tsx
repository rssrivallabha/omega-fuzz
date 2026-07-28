import { useState } from 'react';
import { motion } from 'framer-motion';
import type { FuzzStats, FuzzFinding, CampaignHistoryEntry, FuzzEvent } from '../types';
import { Download, FileText, CheckCircle, Activity, FileJson, AlertCircle, RotateCcw, Plus, ArrowLeft, Clock, Zap, Search, Filter, GitCompare, Play, CheckSquare, Square } from 'lucide-react';
import { FindingInspector } from './FindingInspector';
import { CampaignComparison } from './CampaignComparison';
import { TimelineReplay } from './TimelineReplay';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface FinalReportProps {
  stats: FuzzStats;
  targetName: string;
  findings: FuzzFinding[];
  durationMs: number;
  detectedLanguage: string;
  campaignHistory: CampaignHistoryEntry[];
  events?: FuzzEvent[];
  onNewCampaign: () => void;
  onRunAgain: () => void;
  onViewCampaign: (entry: CampaignHistoryEntry) => void;
}

import type { Variants } from 'framer-motion';

const containerVariant: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.1 }
  }
};

const itemVariant: Variants = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
};

export function FinalReport({ stats, targetName, findings, durationMs, detectedLanguage, campaignHistory, events, onNewCampaign, onRunAgain, onViewCampaign }: FinalReportProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLangFilter, setSelectedLangFilter] = useState('ALL');
  const [selectedOutcomeFilter, setSelectedOutcomeFilter] = useState('ALL');
  const [selectedForCompare, setSelectedForCompare] = useState<string[]>([]);
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [replayTarget, setReplayTarget] = useState<any | null>(null);

  const toggleCompareSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedForCompare(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : (prev.length < 2 ? [...prev, id] : [prev[1], id])
    );
  };

  const filteredHistory = campaignHistory.filter(entry => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q || 
      (entry.targetName || '').toLowerCase().includes(q) || 
      (entry.language || '').toLowerCase().includes(q) || 
      entry.id.toLowerCase().includes(q) ||
      entry.findings.some(f => (f.type || '').toLowerCase().includes(q) || (f.message || '').toLowerCase().includes(q));
    
    const matchesLang = selectedLangFilter === 'ALL' || entry.language.toLowerCase() === selectedLangFilter.toLowerCase();
    
    const matchesOutcome = 
      selectedOutcomeFilter === 'ALL' || 
      (selectedOutcomeFilter === 'CRASHES' && entry.findingsCount > 0) ||
      (selectedOutcomeFilter === 'CLEAN' && entry.findingsCount === 0) ||
      (selectedOutcomeFilter === 'TIMEOUTS' && entry.stats.timeouts > 0);

    return matchesSearch && matchesLang && matchesOutcome;
  });

  const compareEntryA = campaignHistory.find(e => e.id === selectedForCompare[0]) || null;
  const compareEntryB = campaignHistory.find(e => e.id === selectedForCompare[1]) || null;

  const handleExportJSON = () => {
    const reportData = {
      target: targetName || 'unknown',
      language: detectedLanguage,
      statistics: stats,
      durationMs,
      findings,
      exportedAt: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `omega_fuzz_report_${targetName || 'campaign'}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    
    const brandColor = [59, 130, 246] as [number, number, number];
    const textColor = [24, 24, 27] as [number, number, number];
    const secondaryColor = [113, 113, 122] as [number, number, number];
    const dangerColor = [239, 68, 68] as [number, number, number];
    
    doc.setProperties({
      title: `Omega Fuzz Report - ${targetName || 'Campaign'}`,
      subject: 'Fuzzing Campaign Report',
      author: 'Omega Fuzz Engine',
      creator: 'Omega Fuzz'
    });

    let currentY = 20;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(24);
    doc.setTextColor(...textColor);
    doc.text('Omega Fuzz', 14, currentY);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(14);
    doc.setTextColor(...secondaryColor);
    doc.text('Campaign Report', 14, currentY + 8);
    
    doc.setFontSize(10);
    doc.setTextColor(...textColor);
    currentY += 24;
    doc.text(`Target: ${targetName || 'unknown'}`, 14, currentY);
    doc.text(`Language: ${detectedLanguage}`, 14, currentY + 6);
    doc.text(`Generated At: ${new Date().toISOString()}`, 14, currentY + 12);
    
    currentY += 24;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(...brandColor);
    doc.text('Campaign Statistics', 14, currentY);
    
    autoTable(doc, {
      startY: currentY + 6,
      head: [['Metric', 'Value']],
      body: [
        ['Total Executions', stats.executed.toLocaleString()],
        ['Campaign Duration', `${(durationMs / 1000).toFixed(1)}s`],
        ['Throughput', stats.rate > 0 ? `${stats.rate} exec/sec` : 'Unavailable'],
        ['Targets Discovered', stats.targets.toString()],
        ['Unique Findings', stats.findings.toString()],
        ['Expected Rejections', stats.expectedRejections.toString()]
      ],
      theme: 'grid',
      headStyles: { fillColor: [24, 24, 27], textColor: [255, 255, 255], fontStyle: 'bold' },
      styles: { fontSize: 10, cellPadding: 6 },
      alternateRowStyles: { fillColor: [250, 250, 250] }
    });

    currentY = (doc as any).lastAutoTable.finalY + 20;

    if (findings.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(...dangerColor);
      doc.text(`Findings (${findings.length})`, 14, currentY);
      currentY += 6;

      findings.forEach((finding, idx) => {
        if (currentY > 250) {
          doc.addPage();
          currentY = 20;
        }

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(...textColor);
        doc.text(`Finding ${idx + 1}: ${finding.type}`, 14, currentY);
        currentY += 6;
        
        autoTable(doc, {
          startY: currentY,
          body: [
            ['ID', finding.id],
            ['Target', finding.targetFunction || targetName || 'unknown'],
            ['Outcome', finding.outcome],
            ['Severity', finding.severity || 'Unavailable'],
            ['Message', finding.message || 'Unavailable'],
            ['Trace Location', finding.location || 'Unavailable'],
            ['Discovery Strategy', finding.discoveryStrategy || 'Unavailable'],
            ['Triggering Input', finding.inputData != null ? (typeof finding.inputData === 'object' ? JSON.stringify(finding.inputData) : String(finding.inputData)) : 'Unavailable'],
            ['Reproducible', finding.reproducible ? 'Yes' : 'Not verified']
          ],
          theme: 'grid',
          styles: { fontSize: 9, cellPadding: 5 },
          columnStyles: { 0: { fontStyle: 'bold', cellWidth: 40, fillColor: [245, 245, 245] }, 1: { cellWidth: 140 } },
          margin: { left: 14 }
        });
        
        currentY = (doc as any).lastAutoTable.finalY + 15;
      });
    } else {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(11);
      doc.setTextColor(...secondaryColor);
      doc.text('No findings detected during this campaign.', 14, currentY);
    }

    doc.save(`omega_fuzz_report_${targetName || 'campaign'}.pdf`);
  };

  return (
    <motion.div 
      className="flex-col items-center"
      style={{ padding: '3rem 1.5rem', maxWidth: '1000px', margin: '0 auto', minHeight: '100vh' }}
      variants={containerVariant}
      initial="hidden"
      animate="show"
    >
      {/* Navigation Bar */}
      <motion.div variants={itemVariant} className="report-nav" style={{ width: '100%', marginBottom: '2rem' }}>
        <div className="flex gap-3" style={{ flexWrap: 'wrap', justifyContent: 'space-between', width: '100%' }}>
          <div className="flex gap-3" style={{ flexWrap: 'wrap' }}>
            <button onClick={onNewCampaign} className="nav-btn">
              <Plus size={14} /> New Campaign
            </button>
            <button onClick={onRunAgain} className="nav-btn">
              <RotateCcw size={14} /> Run Again
            </button>
            <button onClick={onNewCampaign} className="nav-btn">
              <ArrowLeft size={14} /> Back to Editor
            </button>
          </div>
          <button 
            onClick={() => setReplayTarget({ targetName, language: detectedLanguage, durationMs, findings, events })} 
            className="panel" 
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: 'var(--bg-surface-active)', border: '1px solid var(--brand-primary, #3b82f6)', color: 'var(--brand-primary, #3b82f6)', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem', borderRadius: '6px' }}
          >
            <Play size={14} /> Replay Timeline
          </button>
        </div>
      </motion.div>

      {/* Header */}
      <motion.div variants={itemVariant} className="flex-col items-center text-center gap-4" style={{ marginBottom: '3rem' }}>
        <div style={{ display: 'inline-flex', padding: '16px', background: 'var(--bg-surface-active)', borderRadius: '50%', marginBottom: '1rem' }}>
          <CheckCircle size={40} className="text-brand" />
        </div>
        <h1 style={{ fontSize: '2rem', fontWeight: 600, letterSpacing: '-0.03em', margin: 0 }}>Campaign Concluded</h1>
        <p className="text-secondary" style={{ maxWidth: '600px', margin: '0 auto', fontSize: '1rem' }}>
          Execution completed for target <strong className="text-primary">{targetName || 'unknown'}</strong> ({detectedLanguage}).
        </p>
      </motion.div>

      {/* Summary Stats */}
      <motion.div variants={itemVariant} className="report-stats-grid" style={{ width: '100%', marginBottom: '3rem' }}>
        <div className="panel p-4" style={{ padding: '24px' }}>
          <div className="text-xs text-tertiary font-medium uppercase tracking-wider" style={{ marginBottom: '8px' }}>Duration</div>
          <div className="mono text-brand" style={{ fontSize: '1.5rem', fontWeight: 600 }}>
            {(durationMs / 1000).toFixed(1)}s
          </div>
        </div>
        <div className="panel p-4" style={{ padding: '24px' }}>
          <div className="text-xs text-tertiary font-medium uppercase tracking-wider" style={{ marginBottom: '8px' }}>Executions</div>
          <div className="mono text-brand" style={{ fontSize: '1.5rem', fontWeight: 600 }}>
            {stats.executed.toLocaleString()}
          </div>
        </div>
        <div className="panel p-4" style={{ padding: '24px' }}>
          <div className="text-xs text-tertiary font-medium uppercase tracking-wider" style={{ marginBottom: '8px' }}>Targets</div>
          <div className="mono text-brand" style={{ fontSize: '1.5rem', fontWeight: 600 }}>
            {stats.targets}
          </div>
        </div>
        <div className="panel p-4" style={{ padding: '24px', borderColor: stats.findings > 0 ? 'var(--accent-red-subtle)' : 'var(--border-subtle)' }}>
          <div className="text-xs font-medium uppercase tracking-wider" style={{ marginBottom: '8px', color: stats.findings > 0 ? 'var(--accent-red)' : 'var(--text-tertiary)' }}>Findings</div>
          <div className="mono" style={{ fontSize: '1.5rem', fontWeight: 600, color: stats.findings > 0 ? 'var(--accent-red)' : 'var(--text-primary)' }}>
            {stats.findings}
          </div>
        </div>
      </motion.div>

      {/* Findings Section */}
      <motion.div variants={itemVariant} style={{ width: '100%', marginBottom: '3rem' }}>
        <div className="flex items-center gap-3" style={{ marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border-subtle)' }}>
          <AlertCircle size={20} className={stats.findings > 0 ? 'text-red' : 'text-tertiary'} />
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>Discoveries</h2>
        </div>
        
        {findings.length === 0 ? (
          <div className="flex-col items-center justify-center panel" style={{ padding: '4rem 2rem', background: 'var(--bg-surface-hover)' }}>
            <Activity size={32} className="text-tertiary" style={{ marginBottom: '16px' }} />
            <div className="text-secondary font-medium">No findings detected.</div>
            <div className="text-tertiary text-sm" style={{ marginTop: '8px', textAlign: 'center', maxWidth: '400px' }}>The fuzzing engine completed all configured inputs without discovering unhandled exceptions.</div>
          </div>
        ) : (
          <div className="flex-col gap-4">
            {findings.map(f => (
              <FindingInspector key={f.id} finding={f} />
            ))}
          </div>
        )}
      </motion.div>

      {/* Campaign History with Filters & Search & Comparison */}
      {campaignHistory.length > 0 && (
        <motion.div variants={itemVariant} style={{ width: '100%', marginBottom: '3rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border-subtle)', flexWrap: 'wrap', gap: '1rem' }}>
            <div className="flex items-center gap-3">
              <Clock size={20} className="text-tertiary" />
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>Campaign History Archive</h2>
            </div>
            {selectedForCompare.length === 2 && (
              <button
                onClick={() => setShowCompareModal(true)}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', background: 'var(--accent-blue, #3b82f6)', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)' }}
              >
                <GitCompare size={16} /> Compare Selected (2)
              </button>
            )}
          </div>

          {/* Filter & Search Toolbar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px', background: 'var(--bg-surface-hover)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: '220px', background: 'var(--bg-surface)', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                <Search size={16} className="text-tertiary" />
                <input 
                  type="text" 
                  placeholder="Search target, finding, ID, or error message..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', outline: 'none', width: '100%', fontSize: '0.875rem' }}
                />
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', fontSize: '0.8rem' }}>
              <span className="text-tertiary font-medium" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Filter size={12} /> Language:</span>
              {['ALL', 'python', 'go', 'javascript', 'sql'].map(lang => (
                <button
                  key={lang}
                  onClick={() => setSelectedLangFilter(lang)}
                  style={{ padding: '4px 10px', borderRadius: '12px', border: '1px solid var(--border-subtle)', background: selectedLangFilter === lang ? 'var(--text-primary)' : 'var(--bg-surface)', color: selectedLangFilter === lang ? 'var(--bg-surface)' : 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}
                >
                  {lang}
                </button>
              ))}
              
              <span className="text-tertiary font-medium" style={{ marginLeft: '12px' }}>Status:</span>
              {[
                { id: 'ALL', label: 'All' },
                { id: 'CRASHES', label: 'Only Crashes' },
                { id: 'CLEAN', label: 'Only Completed (Clean)' },
                { id: 'TIMEOUTS', label: 'Only Timeouts' }
              ].map(outcome => (
                <button
                  key={outcome.id}
                  onClick={() => setSelectedOutcomeFilter(outcome.id)}
                  style={{ padding: '4px 10px', borderRadius: '12px', border: '1px solid var(--border-subtle)', background: selectedOutcomeFilter === outcome.id ? 'var(--accent-blue, #3b82f6)' : 'var(--bg-surface)', color: selectedOutcomeFilter === outcome.id ? '#fff' : 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}
                >
                  {outcome.label}
                </button>
              ))}
            </div>
          </div>

          {/* History Items Grid / List */}
          <div className="flex-col gap-2">
            {filteredHistory.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-tertiary)', fontStyle: 'italic', background: 'var(--bg-surface)', borderRadius: '6px', border: '1px dashed var(--border-subtle)' }}>
                No historical campaigns match your selected search criteria.
              </div>
            ) : (
              filteredHistory.map(entry => {
                const isSelected = selectedForCompare.includes(entry.id);
                return (
                  <div
                    key={entry.id}
                    onClick={() => onViewCampaign(entry)}
                    className="panel"
                    style={{ 
                      display: 'flex', alignItems: 'center', gap: '16px', padding: '16px 20px', 
                      cursor: 'pointer', width: '100%', textAlign: 'left',
                      transition: 'background 0.1s', border: isSelected ? '1px solid var(--accent-blue, #3b82f6)' : '1px solid var(--border-subtle)',
                      background: isSelected ? 'rgba(59, 130, 246, 0.05)' : 'var(--bg-surface)'
                    }}
                    onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = 'var(--bg-surface-hover)'; }}
                    onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'var(--bg-surface)'; }}
                  >
                    <div onClick={(e) => toggleCompareSelect(entry.id, e)} title="Select for compare" style={{ color: isSelected ? 'var(--accent-blue, #3b82f6)' : 'var(--text-tertiary)', display: 'flex', alignItems: 'center' }}>
                      {isSelected ? <CheckSquare size={18} /> : <Square size={18} />}
                    </div>
                    <div className="badge badge-neutral" style={{ textTransform: 'uppercase' }}>{entry.language}</div>
                    <div className="mono text-sm text-secondary" style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <strong style={{ color: 'var(--text-primary)' }}>{entry.targetName || 'unknown'}</strong>
                      {entry.findings.length > 0 && <span style={{ fontSize: '0.75rem', marginLeft: '8px', color: 'var(--text-tertiary)' }}>({entry.findings[0].type})</span>}
                    </div>
                    <div className="text-xs text-tertiary">{new Date(entry.timestamp).toLocaleTimeString()}</div>
                    <div className="mono text-xs text-secondary">{entry.executions} exec</div>
                    <div className="mono text-xs font-medium" style={{ color: entry.findingsCount > 0 ? 'var(--accent-red)' : '#10b981', minWidth: '80px', textAlign: 'right' }}>
                      {entry.findingsCount > 0 ? `${entry.findingsCount} findings` : '0 findings'}
                    </div>
                    <button 
                      onClick={(e) => { e.stopPropagation(); setReplayTarget({ targetName: entry.targetName, language: entry.language, durationMs: entry.durationMs, findings: entry.findings, events: entry.events }); }}
                      title="Replay Campaign"
                      style={{ background: 'transparent', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}
                      onMouseEnter={(e) => e.currentTarget.style.color = 'var(--brand-primary, #3b82f6)'}
                      onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-tertiary)'}
                    >
                      <Play size={16} />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {showCompareModal && (
            <CampaignComparison 
              campaignA={compareEntryA} 
              campaignB={compareEntryB} 
              onClose={() => setShowCompareModal(false)} 
            />
          )}

          {replayTarget && (
            <TimelineReplay 
              targetName={replayTarget.targetName}
              language={replayTarget.language}
              durationMs={replayTarget.durationMs}
              findings={replayTarget.findings}
              events={replayTarget.events}
              onClose={() => setReplayTarget(null)}
            />
          )}
        </motion.div>
      )}

      {/* Exports */}
      <motion.div variants={itemVariant} className="flex gap-4 justify-center" style={{ width: '100%', flexWrap: 'wrap' }}>
        <button 
          onClick={handleExportPDF}
          className="panel"
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)', transition: 'background 0.1s' }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-surface-hover)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'var(--bg-surface)'}
        >
          <FileText size={16} className="text-brand" />
          Export PDF Report
        </button>
        <button 
          onClick={handleExportJSON}
          className="panel"
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)', transition: 'background 0.1s' }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-surface-hover)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'var(--bg-surface)'}
        >
          <FileJson size={16} className="text-brand" />
          Export JSON Report
        </button>
      </motion.div>
      
    </motion.div>
  );
}
