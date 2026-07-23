import { useState, useEffect, useRef } from 'react';
import { AnimatePresence } from 'framer-motion';
import type { AppState, FuzzStats, FuzzEvent, FuzzFinding } from './types';
import { Landing } from './components/Landing';
import { Analysis } from './components/Analysis';
import { LiveDashboard } from './components/LiveDashboard';
import { FinalReport } from './components/FinalReport';
import { MouseGlow } from './components/MouseGlow';
import './index.css';

export default function App() {
  const [appState, setAppState] = useState<AppState>('LANDING');
  
  const [events, setEvents] = useState<FuzzEvent[]>([]);
  const [timeline, setTimeline] = useState<{ id: string; time: string; message: string; isImportant: boolean }[]>([]);
  const [findings, setFindings] = useState<FuzzFinding[]>([]);
  const [stats, setStats] = useState<FuzzStats>({ executed: 0, rate: 0, findings: 0, targets: 0, expectedRejections: 0, unexpectedExceptions: 0, timeouts: 0 });
  const [chartData, setChartData] = useState<{ time: string; rate: number }[]>([]);
  
  const [targetName, setTargetName] = useState<string>('');
  const [detectedLanguage, setDetectedLanguage] = useState<string>('unknown');
  const [seedSamples, setSeedSamples] = useState<any[]>([]);
  
  const [startTime, setStartTime] = useState<number>(0);
  const [durationMs, setDurationMs] = useState<number>(0);
  const [liveFeedEvents, setLiveFeedEvents] = useState<any[]>([]);

  const eventSourceRef = useRef<EventSource | null>(null);

  // Format time util for timeline
  const getTimelineTime = () => {
    const now = new Date();
    return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
  };

  const addTimelineEvent = (msg: string, isImportant: boolean = false) => {
    setTimeline(prev => [{ id: Math.random().toString(), time: getTimelineTime(), message: msg, isImportant }, ...prev].slice(0, 50));
  };

  useEffect(() => {
    if (appState !== 'ANALYSIS' && appState !== 'LIVE') return;

    if (!eventSourceRef.current) {
      eventSourceRef.current = new EventSource(
        import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api/stream` : '/api/stream'
      );
      
      let lastExecuted = 0;
      let lastTime = Date.now();

      eventSourceRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'BATCH') {
            const newEvents: FuzzEvent[] = data.events;
            setEvents(prev => [...prev, ...newEvents]);

            newEvents.forEach(e => {
              const p = e.payload;
              
              if (p.type === 'CAMPAIGN_STARTED') {
                setDetectedLanguage(p.configuration?.target || 'unknown');
                addTimelineEvent(`Language detected`);
              }
              else if (p.type === 'TARGET_DISCOVERED') {
                setTargetName(p.targetId);
                setStats(s => ({ ...s, targets: s.targets + 1 }));
                addTimelineEvent(`Target discovered`);
              }
              else if (p.type === 'SEEDS_GENERATED') {
                setSeedSamples(p.seeds?.slice(0, 5) || []);
                addTimelineEvent(`Interesting seed synthesized`);
              }
              else if (p.type === 'CAMPAIGN_PROGRESS') {
                setStats(prev => {
                  const now = Date.now();
                  const dt = (now - lastTime) / 1000;
                  const deltaExec = p.executed - lastExecuted;
                  const currentRate = dt > 0 ? Math.floor(deltaExec / dt) : 0;
                  
                  if (dt > 1) { 
                    setChartData(cd => [...cd, { time: getTimelineTime(), rate: currentRate }].slice(-30));
                    lastTime = now;
                    lastExecuted = p.executed;
                  }

                  return {
                    ...prev,
                    executed: p.executed,
                    rate: currentRate > 0 ? currentRate : prev.rate
                  };
                });
                if (p.durationMs) setDurationMs(p.durationMs);
              }
              else if (p.type === 'NEW_FINDING') {
                setStats(s => ({ ...s, findings: s.findings + 1 }));
                const finding: FuzzFinding = {
                  id: p.findingId || Math.random().toString(),
                  type: p.fingerprint?.exceptionType || 'Unknown Exception',
                  location: p.fingerprint?.rootSourceLocation || 'unknown',
                  outcome: p.outcome || 'ERROR',
                  reproducible: p.isReproducible ?? true,
                  message: p.fingerprint?.normalizedMessage || 'Execution crashed during bounds testing.',
                  inputData: p.inputData,
                  discoveryStrategy: p.discoveryStrategy || 'Mutation Strategy',
                  trace: p.fingerprint?.trace || []
                };
                setFindings(prev => [finding, ...prev]);
                addTimelineEvent(`Unexpected exception discovered: ${finding.type}`, true);
              }
              else if (p.type === 'EXECUTION_COMPLETED') {
                if (p.outcome === 'SUCCESS') setStats(s => ({ ...s, rate: s.rate })); // minimal op
                else if (p.outcome === 'EXPECTED_REJECTION') setStats(s => ({ ...s, expectedRejections: s.expectedRejections + 1 }));
                else if (p.outcome === 'UNEXPECTED_EXCEPTION') setStats(s => ({ ...s, unexpectedExceptions: s.unexpectedExceptions + 1 }));
                
                setLiveFeedEvents(prev => [{ id: Math.random().toString(), ...p }, ...prev].slice(0, 50));
              }
              else if (p.type === 'NEW_PATH_DISCOVERED') {
                addTimelineEvent(`New execution path discovered`, true);
                setLiveFeedEvents(prev => [{ id: Math.random().toString(), ...p }, ...prev].slice(0, 50));
              }
              else if (p.type === 'CAMPAIGN_COMPLETED') {
                addTimelineEvent('Campaign completed successfully');
                setDurationMs(p.durationMs || 0);
              }
              else if (p.type === 'CAMPAIGN_ERROR') {
                addTimelineEvent(`ERROR: ${p.error}`, true);
              }
            });
          }
        } catch (err) {
          console.error("SSE Parse error", err);
        }
      };

      eventSourceRef.current.onerror = () => {
        // Assume stream close == complete
        setAppState('COMPLETE');
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
          eventSourceRef.current = null;
        }
      };
    }
  }, [appState]);

  const handleFuzz = async (code: string, maxInputs: number) => {
    // Reset state
    setAppState('ANALYSIS');
    setTimeline([]);
    setFindings([]);
    setSeedSamples([]);
    setLiveFeedEvents([]);
    setStats({ executed: 0, rate: 0, findings: 0, targets: 0, expectedRejections: 0, unexpectedExceptions: 0, timeouts: 0 });
    setChartData([]);
    setStartTime(Date.now());
    
    try {
      const apiUrl = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api/fuzz` : '/api/fuzz';
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, maxInputs })
      });

      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      
      let lastExecuted = 0;
      let lastTime = Date.now();

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          setAppState('COMPLETE');
          break;
        }
        
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() || '';

        for (const part of parts) {
          if (part.startsWith('data: ')) {
            try {
              const data = JSON.parse(part.slice(6));
              if (data.type === 'BATCH') {
                const newEvents: FuzzEvent[] = data.events;
                setEvents(prev => [...prev, ...newEvents]);
    
                newEvents.forEach(e => {
                  const p = e.payload;
                  if (p.type === 'CAMPAIGN_STARTED') {
                    setDetectedLanguage(p.configuration?.target || 'unknown');
                    addTimelineEvent(`Language detected`);
                  } else if (p.type === 'TARGET_DISCOVERED') {
                    setTargetName(p.targetId);
                    setStats(s => ({ ...s, targets: s.targets + 1 }));
                    addTimelineEvent(`Target discovered`);
                  } else if (p.type === 'SEEDS_GENERATED') {
                    setSeedSamples(p.seeds?.slice(0, 5) || []);
                    addTimelineEvent(`Interesting seed synthesized`);
                  } else if (p.type === 'CAMPAIGN_PROGRESS') {
                    setStats(prev => {
                      const now = Date.now();
                      const dt = (now - lastTime) / 1000;
                      const deltaExec = p.executed - lastExecuted;
                      const currentRate = dt > 0 ? Math.floor(deltaExec / dt) : 0;
                      
                      if (dt > 1) { 
                        setChartData(cd => [...cd, { time: getTimelineTime(), rate: currentRate }].slice(-30));
                        lastTime = now;
                        lastExecuted = p.executed;
                      }
                      return { ...prev, executed: p.executed, rate: currentRate > 0 ? currentRate : prev.rate };
                    });
                    if (p.durationMs) setDurationMs(p.durationMs);
                  } else if (p.type === 'NEW_FINDING') {
                    setStats(s => ({ ...s, findings: s.findings + 1 }));
                    const finding: FuzzFinding = {
                      id: p.findingId || Math.random().toString(),
                      type: p.fingerprint?.exceptionType || 'Unknown Exception',
                      location: p.fingerprint?.rootSourceLocation || 'unknown',
                      outcome: p.outcome || 'ERROR',
                      reproducible: p.isReproducible ?? true,
                      message: p.fingerprint?.normalizedMessage || 'Execution crashed during bounds testing.',
                      inputData: p.inputData,
                      discoveryStrategy: p.discoveryStrategy || 'Mutation Strategy',
                      trace: p.fingerprint?.trace || []
                    };
                    setFindings(prev => [finding, ...prev]);
                    addTimelineEvent(`Unexpected exception discovered: ${finding.type}`, true);
                  } else if (p.type === 'EXECUTION_COMPLETED') {
                    if (p.outcome === 'SUCCESS') setStats(s => ({ ...s, rate: s.rate }));
                    else if (p.outcome === 'EXPECTED_REJECTION') setStats(s => ({ ...s, expectedRejections: s.expectedRejections + 1 }));
                    else if (p.outcome === 'UNEXPECTED_EXCEPTION') setStats(s => ({ ...s, unexpectedExceptions: s.unexpectedExceptions + 1 }));
                    
                    setLiveFeedEvents(prev => [{ id: Math.random().toString(), ...p }, ...prev].slice(0, 50));
                  } else if (p.type === 'NEW_PATH_DISCOVERED') {
                    addTimelineEvent(`New execution path discovered`, true);
                    setLiveFeedEvents(prev => [{ id: Math.random().toString(), ...p }, ...prev].slice(0, 50));
                  } else if (p.type === 'CAMPAIGN_COMPLETED') {
                    addTimelineEvent('Campaign completed successfully');
                    setDurationMs(p.durationMs || 0);
                  } else if (p.type === 'CAMPAIGN_ERROR') {
                    addTimelineEvent(`ERROR: ${p.error}`, true);
                  }
                });
              }
            } catch (err) {
              console.error("Parse error", err);
            }
          }
        }
      }
    } catch (err) {
      console.error("Failed to start", err);
      setAppState('LANDING'); // rollback on err
    }
  };

  return (
    <>
      <MouseGlow />
      <AnimatePresence mode="wait">
        {appState === 'LANDING' && (
          <Landing key="landing" onStart={handleFuzz} />
        )}
        
        {appState === 'ANALYSIS' && (
          <Analysis key="analysis" events={events} onComplete={() => setAppState('LIVE')} />
        )}

        {appState === 'LIVE' && (
          <LiveDashboard 
            key="live"
            stats={stats} 
            chartData={chartData}
            targetName={targetName}
            findings={findings}
            startTime={startTime}
            timeline={timeline}
            liveFeedEvents={liveFeedEvents}
            onStop={() => setAppState('COMPLETE')}
            detectedLanguage={detectedLanguage}
          />
        )}

        {appState === 'COMPLETE' && (
          <FinalReport 
            key="complete"
            stats={stats}
            targetName={targetName}
            findings={findings}
            durationMs={durationMs}
          />
        )}
      </AnimatePresence>
    </>
  );
}
