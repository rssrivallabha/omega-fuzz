import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import type { Variants } from 'framer-motion';
import { Check, CircleDashed, ShieldAlert } from 'lucide-react';
import type { FuzzEvent } from '../types';

interface AnalysisProps {
  events: FuzzEvent[];
  onComplete: () => void;
}

const containerVariant = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.15 }
  }
};

const itemVariant: Variants = {
  hidden: { opacity: 0, x: -20 },
  show: { opacity: 1, x: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
};

export function Analysis({ events, onComplete }: AnalysisProps) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timer1 = setTimeout(() => setStep(1), 800);
    const timer2 = setTimeout(() => setStep(2), 1500);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, []);

  useEffect(() => {
    const hasTarget = events.some(e => e.payload.type === 'TARGET_DISCOVERED');
    if (hasTarget && step < 3) setStep(3);

    const hasProgress = events.some(e => e.payload.type === 'CAMPAIGN_PROGRESS');
    const isCompleted = events.some(e => e.payload.type === 'CAMPAIGN_COMPLETED' || e.payload.type === 'CAMPAIGN_ERROR');
    if ((hasProgress || isCompleted) && step < 5) {
      setStep(5);
    }
  }, [events, step]);

  useEffect(() => {
    if (step === 5) {
      const t = setTimeout(() => onComplete(), 1000);
      return () => clearTimeout(t);
    }
  }, [step, onComplete]);

  const steps = [
    { label: 'INITIALIZE_ORCHESTRATOR' },
    { label: 'LANGUAGE_HEURISTICS_DETECTION' },
    { label: 'CONSTRUCT_AST_AND_DISCOVER_TARGETS' },
    { label: 'SYNTHESIZE_CONSTRAINTS' },
    { label: 'SPAWN_ISOLATED_EXECUTION_CONTEXT' }
  ];

  return (
    <motion.div 
      className="flex-col items-center justify-center" 
      style={{ minHeight: '100vh', padding: 'var(--space-8)', background: 'var(--bg-app)', position: 'relative', zIndex: 1 }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, filter: 'blur(10px)' }}
      transition={{ duration: 0.5 }}
    >
      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '400px', height: '400px', background: 'radial-gradient(circle, rgba(59, 130, 246, 0.15), transparent 70%)', zIndex: -1, pointerEvents: 'none' }} />

      <div style={{ maxWidth: '700px', width: '100%' }}>
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ marginBottom: '3rem', textAlign: 'center' }}
        >
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
            <div style={{ padding: '1rem', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '50%', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
              <ShieldAlert size={32} color="#3b82f6" />
            </div>
          </div>
          <h2 style={{ fontSize: '24px', fontWeight: 700, color: '#fff', letterSpacing: '0.1em', fontFamily: 'monospace' }}>SYSTEM_ANALYSIS</h2>
          <p style={{ marginTop: '8px', color: '#a1a1aa', fontFamily: 'monospace' }}>
            Preparing end-to-end canonical execution pipeline
          </p>
        </motion.div>

        <motion.div 
          variants={containerVariant}
          initial="hidden"
          animate="show"
          style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-lg)', padding: '2rem 3rem', backdropFilter: 'blur(20px)', boxShadow: '0 20px 40px rgba(0,0,0,0.4)' }}
        >
          {steps.map((s, idx) => {
            const isCompleted = step > idx;
            const isActive = step === idx;
            const isPending = step < idx;

            return (
              <motion.div 
                key={idx} 
                variants={itemVariant}
                className="flex items-center gap-4" 
                style={{ 
                  padding: '1rem 0',
                  borderBottom: idx === steps.length - 1 ? 'none' : '1px solid rgba(255,255,255,0.05)',
                  opacity: isPending ? 0.3 : 1,
                  transition: 'opacity 0.3s'
                }}
              >
                <div style={{ width: '24px', display: 'flex', justifyContent: 'center' }}>
                  {isCompleted ? (
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                      <Check size={18} color="#10b981" />
                    </motion.div>
                  ) : isActive ? (
                    <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2, ease: "linear" }}>
                      <CircleDashed size={18} color="#3b82f6" />
                    </motion.div>
                  ) : (
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'rgba(255,255,255,0.2)' }} />
                  )}
                </div>
                <div style={{ fontFamily: 'monospace', fontSize: '14px', color: isActive ? '#fff' : '#a1a1aa', fontWeight: isActive ? 600 : 400, letterSpacing: '0.05em' }}>
                  {s.label}
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </motion.div>
  );
}
