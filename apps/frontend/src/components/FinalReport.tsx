import { motion } from 'framer-motion';
import type { FuzzStats, FuzzFinding } from '../types';
import { Download, FileText, CheckCircle } from 'lucide-react';
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
    transition: { staggerChildren: 0.1, delayChildren: 0.2 }
  }
};

const itemVariant: Variants = {
  hidden: { opacity: 0, y: 20 },
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
    
    // Header
    doc.setFontSize(22);
    doc.setTextColor(30, 41, 59);
    doc.text('Omega Fuzz: Forensic Report', 14, 22);
    
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Target: ${targetName}`, 14, 30);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 36);

    // Stats Table
    autoTable(doc, {
      startY: 45,
      head: [['Metric', 'Value']],
      body: [
        ['Total Executions', stats.executed.toLocaleString()],
        ['Throughput', `${stats.rate} exec/s`],
        ['Targets Discovered', stats.targets.toString()],
        ['Unique Findings (Anomalies)', stats.findings.toString()],
        ['Campaign Duration', `${(durationMs / 1000).toFixed(1)}s`]
      ],
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42] }
    });

    // Findings
    let finalY = (doc as any).lastAutoTable.finalY || 45;
    
    doc.setFontSize(16);
    doc.setTextColor(30, 41, 59);
    doc.text('Discovered Anomalies', 14, finalY + 15);
    
    if (findings.length === 0) {
      doc.setFontSize(11);
      doc.text('No anomalies detected during this campaign.', 14, finalY + 25);
    } else {
      const findingsData = findings.map(f => [
        f.type || 'Unknown',
        f.location || 'Unknown',
        f.message || 'No message'
      ]);
      
      autoTable(doc, {
        startY: finalY + 20,
        head: [['Exception Type', 'Location', 'Message']],
        body: findingsData,
        theme: 'striped',
        headStyles: { fillColor: [220, 38, 38] },
        styles: { cellWidth: 'wrap' },
        columnStyles: {
          0: { cellWidth: 40 },
          1: { cellWidth: 50 },
          2: { cellWidth: 'auto' }
        }
      });
    }

    doc.save(`omega_fuzz_report_${targetName}.pdf`);
  };

  return (
    <motion.div 
      className="flex-col items-center" 
      style={{ minHeight: '100vh', padding: '4rem 2rem', background: 'var(--bg-app)', position: 'relative', zIndex: 1 }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8 }}
    >
      <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', height: '400px', background: 'radial-gradient(ellipse at top, rgba(16, 185, 129, 0.1), transparent 60%)', zIndex: -1, pointerEvents: 'none' }} />

      <motion.div 
        style={{ maxWidth: '900px', width: '100%' }}
        variants={containerVariant}
        initial="hidden"
        animate="show"
      >
        
        <motion.div variants={itemVariant} className="flex justify-between items-center" style={{ marginBottom: '3rem' }}>
          <div>
            <div className="flex items-center gap-2 mono" style={{ marginBottom: '8px', color: '#10b981', fontSize: '14px', background: 'rgba(16, 185, 129, 0.1)', padding: '6px 12px', borderRadius: '999px', display: 'inline-flex' }}>
              <CheckCircle size={16} /> CAMPAIGN_COMPLETE
            </div>
            <h1 style={{ fontSize: '2.5rem', fontWeight: 800, color: '#fff', letterSpacing: '-0.03em', margin: 0 }}>
              Forensic Report
            </h1>
            <div style={{ color: 'var(--accent-cyan)', fontFamily: 'monospace', fontSize: '14px', marginTop: '8px' }}>TARGET: {targetName}</div>
          </div>
          
          <div className="flex gap-4">
            <button 
              onClick={handleExportJSON}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', padding: '10px 20px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontFamily: 'monospace', fontWeight: 600, transition: 'all 0.2s' }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
            >
               <FileText size={16} /> EXPORT JSON
            </button>
            <button 
              onClick={handleExportPDF}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'linear-gradient(135deg, var(--accent-cyan), #3b82f6)', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontFamily: 'monospace', fontWeight: 600, transition: 'all 0.2s', boxShadow: '0 4px 15px rgba(6, 182, 212, 0.3)' }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'none'}
            >
               <Download size={16} /> EXPORT PDF
            </button>
          </div>
        </motion.div>

        <motion.div variants={itemVariant} style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-lg)', padding: '2rem', marginBottom: '3rem', backdropFilter: 'blur(10px)', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2rem' }}>
          <div className="flex-col">
            <span className="text-tertiary mono" style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--accent-cyan)' }}>Total Executions</span>
            <span className="mono text-primary" style={{ fontSize: '2.5rem', fontWeight: 700, marginTop: '8px' }}>{stats.executed.toLocaleString()}</span>
          </div>
          <div className="flex-col">
            <span className="text-tertiary mono" style={{ fontSize: '12px', textTransform: 'uppercase', color: stats.findings > 0 ? '#ef4444' : 'var(--accent-cyan)' }}>Unique Findings</span>
            <span className="mono" style={{ fontSize: '2.5rem', fontWeight: 700, marginTop: '8px', color: stats.findings > 0 ? '#ef4444' : '#fff' }}>{stats.findings}</span>
          </div>
          <div className="flex-col">
            <span className="text-tertiary mono" style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--accent-cyan)' }}>Duration</span>
            <span className="mono text-primary" style={{ fontSize: '2.5rem', fontWeight: 700, marginTop: '8px' }}>{(durationMs / 1000).toFixed(1)}s</span>
          </div>
        </motion.div>

        <motion.div variants={itemVariant}>
          <h2 className="mono text-secondary" style={{ fontSize: '14px', textTransform: 'uppercase', marginBottom: '1rem', color: '#a1a1aa' }}>Discovered Defects</h2>
          {findings.length === 0 ? (
            <div style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-lg)', padding: '4rem 2rem', textAlign: 'center', color: '#a1a1aa', fontFamily: 'monospace', backdropFilter: 'blur(10px)' }}>
              NO_ANOMALIES_DETECTED
            </div>
          ) : (
            <div className="flex-col gap-4">
              {findings.map(f => (
                <FindingInspector key={f.id} finding={f} />
              ))}
            </div>
          )}
        </motion.div>

      </motion.div>
    </motion.div>
  );
}
