import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Variants } from 'framer-motion';
import { Check, CircleDashed, Cpu } from 'lucide-react';
import type { FuzzEvent } from '../types';

interface AnalysisProps {
  events: FuzzEvent[];
  onComplete: () => void;
}

const containerVariant: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const itemVariant: Variants = {
  hidden: { opacity: 0, x: -10 },
  show: { opacity: 1, x: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
};

export function Analysis({ events, onComplete }: AnalysisProps) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timer1 = setTimeout(() => setStep(1), 600);
    const timer2 = setTimeout(() => setStep(2), 1200);

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
      const t = setTimeout(() => onComplete(), 800);
      return () => clearTimeout(t);
    }
  }, [step, onComplete]);

  const steps = [
    { label: 'Initializing Orchestrator' },
    { label: 'Applying Language Heuristics' },
    { label: 'Constructing AST & Discovering Targets' },
    { label: 'Synthesizing Fuzz Constraints' },
    { label: 'Spawning Isolated Execution Context' }
  ];

  return (
    <motion.div 
      className="flex-col items-center justify-center" 
      style={{ minHeight: '100vh', padding: 'var(--space-8)', background: 'var(--bg-app)', position: 'relative', zIndex: 1 }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, filter: 'blur(5px)' }}
      transition={{ duration: 0.4 }}
    >
      <div style={{ maxWidth: '600px', width: '100%' }}>
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ marginBottom: '3rem', textAlign: 'center' }}
        >
          <div style={{ display: 'inline-flex', padding: '16px', background: 'var(--bg-surface-active)', borderRadius: '50%', marginBottom: '1.5rem' }}>
            <Cpu size={32} className="text-secondary" />
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 500, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
            System Preparation
          </h2>
        </motion.div>

        <motion.div 
          className="panel"
          style={{ padding: '32px 40px', background: 'var(--bg-surface)' }}
          variants={containerVariant}
          initial="hidden"
          animate="show"
        >
          <div className="flex-col gap-6">
            {steps.map((s, idx) => {
              const isCompleted = step > idx;
              const isActive = step === idx;
              const isPending = step < idx;

              return (
                <motion.div 
                  key={idx} 
                  variants={itemVariant}
                  className="flex items-center gap-4"
                  style={{ opacity: isPending ? 0.4 : 1 }}
                >
                  <div style={{ width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {isCompleted ? (
                      <Check size={18} className="text-brand" />
                    ) : isActive ? (
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                      >
                        <CircleDashed size={18} className="text-tertiary" />
                      </motion.div>
                    ) : (
                      <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--border-strong)' }} />
                    )}
                  </div>
                  
                  <div style={{
                    fontSize: '14px', 
                    fontWeight: 500,
                    color: isCompleted ? 'var(--text-primary)' : isActive ? 'var(--text-secondary)' : 'var(--text-tertiary)',
                    letterSpacing: '-0.01em'
                  }}>
                    {s.label}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
