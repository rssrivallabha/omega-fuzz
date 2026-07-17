import { useEffect, useRef } from 'react';
import { Terminal, Database } from 'lucide-react';

interface SeedExecutedEvent {
  seedId: string;
  input: any;
  durationMs: number;
}

interface ExecutionVisualizerProps {
  seeds: SeedExecutedEvent[];
  language: string;
}

export function ExecutionVisualizer({ seeds, language }: ExecutionVisualizerProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const dataRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (terminalRef.current) terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    if (dataRef.current) dataRef.current.scrollTop = dataRef.current.scrollHeight;
  }, [seeds]);

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '20px',
      marginBottom: '2rem',
      height: '350px'
    }}>
      {/* Left Panel: Simulated Terminal/Sandbox Output */}
      <div style={{
        background: 'var(--glass-bg)',
        border: '1px solid var(--glass-border)',
        borderRadius: 'var(--radius-lg)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        <div style={{ padding: '12px 16px', background: 'rgba(0,0,0,0.4)', borderBottom: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-cyan)' }}>
          <Terminal size={16} />
          <span style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: '13px' }}>SANDBOX EXECUTION ({language.toUpperCase()})</span>
        </div>
        <div ref={terminalRef} style={{ padding: '16px', overflowY: 'auto', flex: 1, fontFamily: '"Fira Code", monospace', fontSize: '12px', color: '#a1a1aa' }}>
          {seeds.slice(-50).map((s, i) => (
            <div key={i} style={{ marginBottom: '4px' }}>
              <span style={{ color: '#3b82f6' }}>{'>'}</span> <span style={{ color: '#22c55e' }}>[EXEC]</span> target_fn({s.seedId}) ... 
              <span style={{ color: s.durationMs > 10 ? '#eab308' : '#a1a1aa' }}> {s.durationMs}ms</span>
            </div>
          ))}
          {seeds.length === 0 && <div style={{ opacity: 0.5 }}>Waiting for sandbox execution...</div>}
        </div>
      </div>

      {/* Right Panel: Data Stream (JSON Inputs) */}
      <div style={{
        background: 'var(--glass-bg)',
        border: '1px solid var(--glass-border)',
        borderRadius: 'var(--radius-lg)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        <div style={{ padding: '12px 16px', background: 'rgba(0,0,0,0.4)', borderBottom: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)' }}>
          <Database size={16} />
          <span style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: '13px' }}>SYNTHESIZED INPUT STREAM</span>
        </div>
        <div ref={dataRef} style={{ padding: '16px', overflowY: 'auto', flex: 1, fontFamily: '"Fira Code", monospace', fontSize: '12px', color: '#e4e4e7' }}>
          {seeds.slice(-50).map((s, i) => (
            <div key={i} style={{ marginBottom: '8px', borderLeft: '2px solid rgba(16, 185, 129, 0.3)', paddingLeft: '8px' }}>
              <div style={{ color: '#10b981', opacity: 0.7, fontSize: '10px' }}>SEED: {s.seedId}</div>
              <div style={{ wordBreak: 'break-all' }}>{JSON.stringify(s.input)}</div>
            </div>
          ))}
          {seeds.length === 0 && <div style={{ opacity: 0.5 }}>Waiting for seed corpus generation...</div>}
        </div>
      </div>
    </div>
  );
}
