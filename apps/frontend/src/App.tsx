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
  
  const [campaignId, setCampaignId] = useState<string>('');
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
    if ((appState !== 'ANALYSIS' && appState !== 'LIVE') || !campaignId) return;

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const baseUrl = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL : '';
    eventSourceRef.current = new EventSource(`${baseUrl}/api/stream?campaignId=${encodeURIComponent(campaignId)}`);
    
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
              addTimelineEvent(`Language detected: ${p.configuration?.target || 'unknown'}`);
            }
            else if (p.type === 'TARGET_DISCOVERED') {
              setTargetName(p.targetId);
              setStats(s => ({ ...s, targets: s.targets + 1 }));
              addTimelineEvent(`Target discovered: ${p.targetId}`);
            }
            else if (p.type === 'SEEDS_GENERATED') {
              setSeedSamples(p.seeds?.slice(0, 5) || []);
              addTimelineEvent(`Interesting seed synthesized (${p.seeds?.length || 0} total)`);
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
              if (p.outcome === 'SUCCESS') setStats(s => ({ ...s, rate: s.rate }));
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
              if (p.durationMs) setDurationMs(p.durationMs);
              setAppState('COMPLETE');
              if (eventSourceRef.current) {
                eventSourceRef.current.close();
                eventSourceRef.current = null;
              }
            }
            else if (p.type === 'CAMPAIGN_ERROR') {
              addTimelineEvent(`ERROR: ${p.error}`, true);
              setAppState('COMPLETE');
              if (eventSourceRef.current) {
                eventSourceRef.current.close();
                eventSourceRef.current = null;
              }
            }
          });
        }
      } catch (err) {
        console.error("SSE Parse error", err);
      }
    };

    eventSourceRef.current.onerror = () => {
      setAppState('COMPLETE');
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [appState, campaignId]);



  const handleFuzz = async (code: string, maxInputs: number) => {
  console.log("BUTTON CLICKED");

  setAppState("ANALYSIS");

  console.log("API URL:", import.meta.env.VITE_API_URL);

  try {
    const apiUrl = import.meta.env.VITE_API_URL
      ? `${import.meta.env.VITE_API_URL}/api/fuzz`
      : "/api/fuzz";

    console.log("Posting to:", apiUrl);

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        code,
        maxInputs
      })
    });

    console.log("Response:", response.status);

    const data = await response.json();

    console.log("Data:", data);

    setCampaignId(data.campaignId);
  } catch (err) {
    console.error(err);
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
