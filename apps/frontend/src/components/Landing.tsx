import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Shield, Code2, Play } from 'lucide-react';

interface LandingProps {
  onStart: (code: string) => void;
}

export function Landing({ onStart }: LandingProps) {
  const [code, setCode] = useState(
`const processOrder = (order) => {
  if (!order.id) throw new Error("Missing ID");
  if (order.total < 0) throw new Error("Invalid Total");
  return { status: "success", data: order };
};`
  );
  
  const [detectedLang, setDetectedLang] = useState('JavaScript');
  
  useEffect(() => {
      if (code.includes('def ') || code.includes('import ') && !code.includes('const') && !code.includes('=>')) {
          setDetectedLang('Python');
      } else {
          setDetectedLang('JavaScript / TypeScript');
      }
  }, [code]);

  return (
    <div className="landing-container" style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        position: 'relative',
        zIndex: 1
    }}>
      {/* Aesthetic Cyber Elements */}
      <div style={{
          position: 'absolute',
          top: '20%',
          left: '10%',
          width: '300px',
          height: '300px',
          background: 'var(--accent-cyan-glow)',
          filter: 'blur(100px)',
          borderRadius: '50%',
          zIndex: -1
      }} />
      <div style={{
          position: 'absolute',
          bottom: '10%',
          right: '15%',
          width: '250px',
          height: '250px',
          background: 'var(--primary-glow)',
          filter: 'blur(100px)',
          borderRadius: '50%',
          zIndex: -1
      }} />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ textAlign: 'center', maxWidth: '800px', marginBottom: '3rem' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginBottom: '1rem' }}>
            <Shield size={48} color="var(--accent-cyan)" />
            <h1 style={{ fontSize: '3.5rem', fontWeight: 800, letterSpacing: '-0.05em', margin: 0, background: 'linear-gradient(to right, #fff, #a1a1aa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                OMEGA FUZZ
            </h1>
        </div>
        <p style={{ fontSize: '1.25rem', color: '#a1a1aa', fontWeight: 300, lineHeight: 1.6 }}>
          Automated multi-language target discovery and continuous fuzzing engine.
        </p>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2 }}
        style={{
            width: '100%',
            maxWidth: '900px',
            background: 'var(--glass-bg)',
            border: '1px solid var(--glass-border)',
            borderRadius: 'var(--radius-lg)',
            padding: '2px',
            backdropFilter: 'blur(20px)',
            boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
            overflow: 'hidden'
        }}
      >
        <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 20px',
            background: 'rgba(0,0,0,0.4)',
            borderBottom: '1px solid var(--glass-border)',
            fontFamily: 'monospace'
        }}>
            <div style={{ display: 'flex', gap: '8px' }}>
                <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#ef4444' }} />
                <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#eab308' }} />
                <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#22c55e' }} />
            </div>
            <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px', 
                fontSize: '12px', 
                color: 'var(--accent-cyan)',
                background: 'var(--accent-cyan-glow)',
                padding: '4px 12px',
                borderRadius: '999px',
                fontWeight: 600
            }}>
                <Code2 size={14} />
                DETECTED: {detectedLang.toUpperCase()}
            </div>
        </div>
        <textarea
          value={code}
          onChange={(e) => setCode(e.target.value)}
          style={{
            width: '100%',
            height: '300px',
            background: 'transparent',
            border: 'none',
            padding: '24px',
            color: '#e4e4e7',
            fontFamily: '"Fira Code", monospace',
            fontSize: '15px',
            resize: 'none',
            outline: 'none',
            lineHeight: 1.6
          }}
          spellCheck={false}
        />
        <div style={{ padding: '20px', background: 'rgba(0,0,0,0.2)', borderTop: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={() => onStart(code)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'linear-gradient(135deg, var(--accent-cyan), #3b82f6)',
                color: '#fff',
                border: 'none',
                padding: '14px 32px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '1.1rem',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 4px 15px rgba(6, 182, 212, 0.4)',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'none'}
            >
              <Play size={20} />
              INITIATE FUZZING SEQUENCE
            </button>
        </div>
      </motion.div>
    </div>
  );
}
