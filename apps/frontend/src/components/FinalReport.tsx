import { useState } from 'react';
import { motion } from 'framer-motion';
import type { FuzzStats, FuzzFinding, CampaignHistoryEntry, FuzzEvent } from '../types';
import { Download, FileText, CheckCircle, Activity, FileJson, AlertCircle, RotateCcw, Plus, ArrowLeft, Zap, Play } from 'lucide-react';
import { FindingInspector } from './FindingInspector';
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

export function FinalReport({ stats, targetName, findings, durationMs, detectedLanguage, events, onNewCampaign, onRunAgain }: FinalReportProps) {
  const [replayTarget, setReplayTarget] = useState<any | null>(null);

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
  );
}
