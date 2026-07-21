import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Code2, Play, Activity, Settings2 } from 'lucide-react';

interface LandingProps {
  onStart: (code: string, maxInputs: number) => void;
}

export function Landing({ onStart }: LandingProps) {
  const [code, setCode] = useState(
`def process_transaction(tx):
    if not tx.get("id"):
        raise ValueError("Missing ID")
    if tx.get("amount", 0) < 0:
        raise ValueError("Invalid Amount")
    return {"status": "success", "data": tx}`
  );
  
  const [detectedLang, setDetectedLang] = useState('Python');
  const [maxInputs, setMaxInputs] = useState<number>(150);
  
  useEffect(() => {
      if (code.includes('def ') || code.includes('import ') && !code.includes('const') && !code.includes('=>')) {
          setDetectedLang('Python');
      } else {
          setDetectedLang('JavaScript');
      }
  }, [code]);

  const handleInputLimitChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = parseInt(e.target.value);
    if (isNaN(val)) val = 25;
    setMaxInputs(val);
  };

  const enforceBounds = () => {
    if (maxInputs < 25) setMaxInputs(25);
    if (maxInputs > 250) setMaxInputs(250);
  };

  const estimatedSeconds = (maxInputs / 15).toFixed(1);

  return (
    <div className="flex-col items-center justify-center" style={{ minHeight: '100vh', padding: '2rem' }}>
      
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="flex-col items-center gap-2"
        style={{ marginBottom: '2.5rem' }}
      >
        <div className="flex items-center gap-3">
          <Activity size={24} color="var(--accent-brand)" />
          <h1 style={{ fontSize: '1.5rem', fontWeight: 600, letterSpacing: '-0.02em', margin: 0 }}>Omega Fuzz</h1>
        </div>
        <p className="text-secondary text-sm">Engine ready. Waiting for target source.</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="panel flex-col"
        style={{
          width: '100%',
          maxWidth: '800px',
          overflow: 'hidden',
          background: 'var(--bg-surface-hover)'
        }}
      >
        <div className="flex justify-between items-center" style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-surface)' }}>
          <div className="flex items-center gap-2">
            <Code2 size={16} className="text-tertiary" />
            <span className="mono text-secondary">target.src</span>
          </div>
          <div className="badge badge-neutral">
            {detectedLang}
          </div>
        </div>
        
        <textarea
          value={code}
          onChange={(e) => setCode(e.target.value)}
          spellCheck={false}
          style={{
            width: '100%',
            height: '320px',
            background: 'transparent',
            border: 'none',
            color: 'var(--text-primary)',
            padding: '16px',
            fontFamily: 'var(--font-mono)',
            fontSize: '14px',
            lineHeight: 1.6,
            resize: 'none',
            outline: 'none'
          }}
        />

        {/* Configuration Panel */}
        <div style={{ 
          padding: '16px 20px', 
          background: 'var(--bg-surface)', 
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <div className="flex items-center gap-2 text-secondary text-sm font-medium">
            <Settings2 size={16} /> Campaign Configuration
          </div>
          
          <div className="flex items-center gap-6">
            <div className="flex-col gap-1 flex-1">
              <div className="flex justify-between text-xs text-tertiary mb-1">
                <span>Input Volume</span>
                <span className="mono">{maxInputs} / 250</span>
              </div>
              <input 
                type="range" 
                min="25" 
                max="250" 
                value={maxInputs} 
                onChange={handleInputLimitChange}
                style={{ width: '100%', cursor: 'pointer', accentColor: 'var(--text-primary)' }}
              />
            </div>
            
            <div className="flex items-center gap-2">
              <input 
                type="number"
                value={maxInputs}
                onChange={handleInputLimitChange}
                onBlur={enforceBounds}
                min="25"
                max="250"
                className="mono"
                style={{
                  width: '70px',
                  background: 'var(--bg-app)',
                  border: '1px solid var(--border-strong)',
                  color: 'var(--text-primary)',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  fontSize: '14px',
                  textAlign: 'right'
                }}
              />
              <span className="text-xs text-tertiary">inputs</span>
            </div>

            <div style={{ height: '32px', width: '1px', background: 'var(--border-subtle)' }} />

            <div className="flex-col gap-1 min-w-[120px]">
              <div className="text-xs text-tertiary">Est. Duration</div>
              <div className="text-sm mono text-secondary">~{estimatedSeconds}s</div>
            </div>

            <div className="flex-1" />

            <button
              onClick={() => onStart(code, maxInputs)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'var(--text-primary)',
                color: 'var(--bg-app)',
                border: 'none',
                padding: '8px 24px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.875rem',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'transform 0.1s ease'
              }}
              onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.97)'}
              onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
            >
              <Play size={14} fill="currentColor" />
              Initialize Engine
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
