import { useState, useEffect, useRef } from 'react';
import { AnimatePresence } from 'framer-motion';
import type { AppState, FuzzStats, FuzzEvent, FuzzFinding } from './types';
import { Landing } from './components/Landing';
import { Analysis } from './components/Analysis';
import { LiveDashboard } from './components/LiveDashboard';
import { FinalReport } from './components/FinalReport';
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
      eventSourceRef.current = new EventSource('http://localhost:3001/api/stream');
      
      let lastExecuted = 0;
      let lastTime = Date.now();

      eventSourceRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'BATCH') {
            const newEvents: FuzzEvent[] = data.events;
            setEvents(prev => [...prev, ...newEvents]); // For Analysis step dependency

            newEvents.forEach(e => {
              const p = e.payload;
              
              if (p.type === 'CAMPAIGN_STARTED') {
                setDetectedLanguage(p.configuration?.target || 'unknown');
              }
              else if (p.type === 'TARGET_DISCOVERED') {
                setTargetName(p.targetId);
                setStats(s => ({ ...s, targets: s.targets + 1 }));
                addTimelineEvent(`Discovered target: ${p.targetId}`, true);
              } 
              else if (p.type === 'SEED_EXECUTED') {
                setSeedSamples(prev => [...prev, p].slice(-50)); // keep last 50
              }
              else if (p.type === 'NEW_FINDING') {
                setStats(s => ({ ...s, findings: s.findings + 1 }));
                const finding: FuzzFinding = {
                  id: p.findingId,
                  type: p.fingerprint?.exceptionType || 'Unknown Exception',
                  location: p.fingerprint?.rootSourceLocation || 'unknown',
                  outcome: p.outcome,
                  reproducible: true,
                  message: 'Execution crashed during validation bounds testing.'
                };
                setFindings(prev => [finding, ...prev]);
                addTimelineEvent(`New Finding: ${finding.type} at ${finding.location}`, true);
              }
              else if (p.type === 'CAMPAIGN_PROGRESS') {
                const now = Date.now();
                const deltaT = (now - lastTime) / 1000;
                const deltaE = p.executed - lastExecuted;
                const rate = deltaT > 0 ? Math.round(deltaE / deltaT) : 0;
                
                setStats(s => ({ ...s, executed: p.executed, rate: rate > 0 ? rate : s.rate }));
                
                if (rate > 0) {
                  setChartData(prev => [...prev, { time: getTimelineTime(), rate }].slice(-30)); // keep last 30 ticks
                }

                lastExecuted = p.executed;
                lastTime = now;
                setDurationMs(p.durationMs);

                // Add to timeline periodically rather than every single event
                if (p.executed % 100 === 0 && p.executed > 0) {
                  addTimelineEvent(`Progress: ${p.executed.toLocaleString()} executions completed`);
                }
              }
            });
          }
        } catch (err) {
          console.error("Parse error", err);
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

  const handleFuzz = async (code: string) => {
    // Reset state
    setAppState('ANALYSIS');
    setTimeline([]);
    setFindings([]);
    setSeedSamples([]);
    setStats({ executed: 0, rate: 0, findings: 0, targets: 0, expectedRejections: 0, unexpectedExceptions: 0, timeouts: 0 });
    setChartData([]);
    setStartTime(Date.now());
    
    setAppState('ANALYSIS');
    
    try {
      await fetch('http://localhost:3001/api/fuzz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code })
      });
      addTimelineEvent('Started fuzzing campaign', true);
    } catch (err) {
      console.error("Failed to start", err);
      setAppState('LANDING'); // rollback on err
    }
  };

  return (
    <>
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
            onStop={() => setAppState('COMPLETE')}
            seedSamples={seedSamples}
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
