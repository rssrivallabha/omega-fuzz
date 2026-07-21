import { motion } from 'framer-motion';
import type { FuzzStats, FuzzFinding } from '../types';
import { Download, FileText, CheckCircle, Activity, FileJson, AlertCircle } from 'lucide-react';
import { FindingInspector } from './FindingInspector';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface FinalReportProps {
  stats: FuzzStats;
  targetName: string;
  findings: FuzzFinding[];
  durationMs: number;
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

export function FinalReport({ stats, targetName, findings, durationMs }: FinalReportProps) {
  
  const handleExportJSON = () => {
    const reportData = {
      target: targetName,
      statistics: stats,
      durationMs,
      findings,
      exportedAt: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `omega_fuzz_report_${targetName}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    
    // Theme Colors
    const brandColor = [59, 130, 246] as [number, number, number];
    const textColor = [24, 24, 27] as [number, number, number];
    const secondaryColor = [113, 113, 122] as [number, number, number];
    const dangerColor = [239, 68, 68] as [number, number, number];
    
    // Document Metadata
    doc.setProperties({
      title: `Omega Fuzz Report - ${targetName}`,
      subject: 'Fuzzing Campaign Forensic Report',
      author: 'Omega Fuzz Engine',
      creator: 'Omega Fuzz'
    });

    let currentY = 20;

    // Title & Header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(24);
    doc.setTextColor(...textColor);
    doc.text('Omega Fuzz', 14, currentY);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(14);
    doc.setTextColor(...secondaryColor);
    doc.text('Forensic Campaign Report', 14, currentY + 8);
    
    // Metadata Block
    doc.setFontSize(10);
    doc.setTextColor(...textColor);
    currentY += 24;
    doc.text(`Target Function: ${targetName}`, 14, currentY);
    doc.text(`Generated At: ${new Date().toISOString()}`, 14, currentY + 6);
    doc.text(`Environment: Docker Isolated Sandbox`, 14, currentY + 12);
    
    currentY += 24;

    // Statistics Table
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(...brandColor);
    doc.text('Campaign Statistics', 14, currentY);
    
    autoTable(doc, {
      startY: currentY + 6,
      head: [['Metric', 'Value']],
      body: [
        ['Total Executions', stats.executed.toLocaleString()],
        ['Campaign Duration (ms)', durationMs.toString()],
        ['Execution Throughput', `${stats.rate} exec/sec`],
        ['Constraint Paths Discovered', stats.targets.toString()],
        ['Unique Findings', stats.findings.toString()]
      ],
      theme: 'grid',
      headStyles: { fillColor: [24, 24, 27], textColor: [255, 255, 255], fontStyle: 'bold' },
      styles: { fontSize: 10, cellPadding: 6 },
      alternateRowStyles: { fillColor: [250, 250, 250] }
    });

    currentY = (doc as any).lastAutoTable.finalY + 20;

    // Findings Section
    if (findings.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(...dangerColor);
      doc.text(`Discoveries & Anomalies (${findings.length})`, 14, currentY);
      currentY += 6;

      findings.forEach((finding, idx) => {
        // Add new page if close to bottom
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
            ['Outcome', finding.outcome],
            ['Message', finding.message || 'N/A'],
            ['Trace Location', finding.location],
            ['Discovery Strategy', finding.discoveryStrategy || 'Mutation'],
            ['Minimized Input', typeof finding.inputData === 'object' ? JSON.stringify(finding.inputData) : String(finding.inputData || 'N/A')]
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
      doc.text('No vulnerabilities detected during this campaign.', 14, currentY);
    }

    doc.save(`omega_fuzz_report_${targetName}.pdf`);
  };

  return (
    <motion.div 
      className="flex-col items-center"
      style={{ padding: '4rem 2rem', maxWidth: '1000px', margin: '0 auto', minHeight: '100vh' }}
      variants={containerVariant}
      initial="hidden"
      animate="show"
    >
      <motion.div variants={itemVariant} className="flex-col items-center text-center gap-4" style={{ marginBottom: '4rem' }}>
        <div style={{ display: 'inline-flex', padding: '16px', background: 'var(--bg-surface-active)', borderRadius: '50%', marginBottom: '1rem' }}>
          <CheckCircle size={40} className="text-brand" />
        </div>
        <h1 style={{ fontSize: '2rem', fontWeight: 600, letterSpacing: '-0.03em', margin: 0 }}>Campaign Concluded</h1>
        <p className="text-secondary" style={{ maxWidth: '600px', margin: '0 auto', fontSize: '1.125rem' }}>
          Engine execution has halted. Forensic analysis and execution metrics have been finalized for target <strong className="text-primary">{targetName}</strong>.
        </p>
      </motion.div>

      {/* Summary Stats */}
      <motion.div variants={itemVariant} style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', width: '100%', marginBottom: '3rem' }}>
        <div className="panel p-4" style={{ padding: '24px' }}>
          <div className="text-xs text-tertiary font-medium uppercase tracking-wider mb-2">Duration</div>
          <div className="mono text-brand" style={{ fontSize: '1.5rem', fontWeight: 600 }}>
            {(durationMs / 1000).toFixed(1)}s
          </div>
        </div>
        <div className="panel p-4" style={{ padding: '24px' }}>
          <div className="text-xs text-tertiary font-medium uppercase tracking-wider mb-2">Executions</div>
          <div className="mono text-brand" style={{ fontSize: '1.5rem', fontWeight: 600 }}>
            {stats.executed.toLocaleString()}
          </div>
        </div>
        <div className="panel p-4" style={{ padding: '24px' }}>
          <div className="text-xs text-tertiary font-medium uppercase tracking-wider mb-2">Coverage</div>
          <div className="mono text-brand" style={{ fontSize: '1.5rem', fontWeight: 600 }}>
            {stats.targets} <span className="text-sm text-tertiary font-sans">paths</span>
          </div>
        </div>
        <div className="panel p-4" style={{ padding: '24px', borderColor: stats.findings > 0 ? 'var(--accent-red-subtle)' : 'var(--border-subtle)' }}>
          <div className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: stats.findings > 0 ? 'var(--accent-red)' : 'var(--text-tertiary)' }}>Anomalies</div>
          <div className="mono" style={{ fontSize: '1.5rem', fontWeight: 600, color: stats.findings > 0 ? 'var(--accent-red)' : 'var(--text-primary)' }}>
            {stats.findings}
          </div>
        </div>
      </motion.div>

      {/* Findings Section */}
      <motion.div variants={itemVariant} style={{ width: '100%', marginBottom: '4rem' }}>
        <div className="flex items-center gap-3" style={{ marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border-subtle)' }}>
          <AlertCircle size={20} className={stats.findings > 0 ? 'text-red' : 'text-tertiary'} />
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>Discoveries</h2>
        </div>
        
        {findings.length === 0 ? (
          <div className="flex-col items-center justify-center panel" style={{ padding: '4rem 2rem', background: 'var(--bg-surface-hover)' }}>
            <Activity size={32} className="text-tertiary mb-4" />
            <div className="text-secondary font-medium">No vulnerabilities detected.</div>
            <div className="text-tertiary text-sm mt-2 text-center max-w-md">The execution matrix exhausted its configured boundary and schema constraints without triggering any unhandled exceptions.</div>
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
      <motion.div variants={itemVariant} className="flex gap-4 justify-center" style={{ width: '100%' }}>
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
          Export JSON Schema
        </button>
      </motion.div>
      
    </motion.div>
  );
}
