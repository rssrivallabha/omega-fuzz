import { useState, useEffect, useRef, useCallback } from 'react';
import { AnimatePresence } from 'framer-motion';
import type { AppState, FuzzStats, FuzzEvent, FuzzFinding, CampaignHistoryEntry } from './types';
import { Landing } from './components/Landing';
import { Analysis } from './components/Analysis';
import { LiveDashboard } from './components/LiveDashboard';
import { FinalReport } from './components/FinalReport';
import { ArchiveSidebar } from './components/ArchiveSidebar';
import { MouseGlow } from './components/MouseGlow';
import './index.css';

const INITIAL_STATS: FuzzStats = { executed: 0, rate: 0, findings: 0, targets: 0, expectedRejections: 0, unexpectedExceptions: 0, timeouts: 0 };

export default function App() {
  const [appState, setAppState] = useState<AppState>('LANDING');
  
  const [events, setEvents] = useState<FuzzEvent[]>([]);
  const [timeline, setTimeline] = useState<{ id: string; time: string; message: string; isImportant: boolean }[]>([]);
  const [findings, setFindings] = useState<FuzzFinding[]>([]);
  const [stats, setStats] = useState<FuzzStats>({ ...INITIAL_STATS });
  const [chartData, setChartData] = useState<{ time: string; rate: number }[]>([]);
  
  const [targetName, setTargetName] = useState<string>('');
  const [detectedLanguage, setDetectedLanguage] = useState<string>('unknown');
  const [seedSamples, setSeedSamples] = useState<any[]>([]);
  const [executionEnvironment, setExecutionEnvironment] = useState<string>('unknown');
  
  const [campaignId, setCampaignId] = useState<string>('');
  const [startTime, setStartTime] = useState<number>(0);
  const [durationMs, setDurationMs] = useState<number>(0);
  const [liveFeedEvents, setLiveFeedEvents] = useState<any[]>([]);
  
  // Campaign history (persisted to localStorage)
  const [campaignHistory, setCampaignHistory] = useState<CampaignHistoryEntry[]>(() => {
    try {
      const saved = localStorage.getItem('omega_fuzz_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  
  // Store the last submitted code for "Run Again"
  const [lastSubmittedCode, setLastSubmittedCode] = useState<string>('');
  const [lastMaxInputs, setLastMaxInputs] = useState<number>(150);

  const eventSourceRef = useRef<EventSource | null>(null);

  const getTimelineTime = () => {
    const now = new Date();
    return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
  };

  const addTimelineEvent = useCallback((msg: string, isImportant: boolean = false) => {
    setTimeline(prev => [{ id: Math.random().toString(), time: getTimelineTime(), message: msg, isImportant }, ...prev].slice(0, 50));
  }, []);

  // Full state reset for new campaigns
  const resetCampaignState = useCallback(() => {
    setEvents([]);
    setTimeline([]);
    setFindings([]);
    setStats({ ...INITIAL_STATS });
    setChartData([]);
    setTargetName('');
    setDetectedLanguage('unknown');
    setSeedSamples([]);
    setExecutionEnvironment('unknown');
    setCampaignId('');
    setStartTime(0);
    setDurationMs(0);
    setLiveFeedEvents([]);
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  // Save completed campaign to history
  const saveCampaignToHistory = useCallback(() => {
    if (!campaignId) return;
    const entry: CampaignHistoryEntry = {
      id: campaignId,
      code: lastSubmittedCode,
      language: detectedLanguage,
      targetName: targetName,
      timestamp: new Date().toISOString(),
      durationMs: durationMs,
      executions: stats.executed,
      findingsCount: findings.length,
      status: 'COMPLETED',
      findings: [...findings],
      stats: { ...stats },
      events: [...events]
    };
    setCampaignHistory(prev => {
      const next = [entry, ...prev.filter(e => e.id !== entry.id)].slice(0, 50);
      try {
        localStorage.setItem('omega_fuzz_history', JSON.stringify(next));
      } catch (e) {
        console.warn('Could not save campaign history to localStorage:', e);
      }
      return next;
    });
  }, [campaignId, lastSubmittedCode, detectedLanguage, targetName, durationMs, stats, findings, events]);

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
              setExecutionEnvironment(p.configuration?.executionBackend || 'Local Process');
              addTimelineEvent(`Language detected: ${p.configuration?.target || 'unknown'}`);
            }
            else if (p.type === 'TARGET_DISCOVERED') {
              setTargetName(p.targetId);
              setStats(s => ({ ...s, targets: s.targets + 1 }));
              addTimelineEvent(`Target discovered: ${p.targetId}`);
            }
            else if (p.type === 'SEEDS_GENERATED') {
              setSeedSamples(p.seeds?.slice(0, 5) || []);
              addTimelineEvent(`Seeds synthesized (${p.seeds?.length || 0} total)`);
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
                reproducible: p.isReproducible ?? false,
                message: p.exceptionMessage || p.fingerprint?.normalizedMessage || '',
                inputData: p.inputData,
                discoveryStrategy: p.discoveryStrategy || 'Unknown',
                trace: p.fingerprint?.trace || p.trace || [],
                targetFunction: p.targetFunction || '',
                severity: p.severity || 'Unavailable',
                confidence: typeof p.confidence === 'number' ? p.confidence : undefined
              };
              setFindings(prev => [finding, ...prev]);
              addTimelineEvent(`Unexpected exception discovered: ${finding.type}`, true);
            }
            else if (p.type === 'EXECUTION_COMPLETED') {
              if (p.outcome === 'EXPECTED_REJECTION') setStats(s => ({ ...s, expectedRejections: s.expectedRejections + 1 }));
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
  }, [appState, campaignId, addTimelineEvent]);

  // Save to history when campaign completes
  useEffect(() => {
    if (appState === 'COMPLETE' && campaignId) {
      saveCampaignToHistory();
    }
  }, [appState, campaignId, saveCampaignToHistory]);

  const handleFuzz = async (code: string, maxInputs: number) => {
    // Reset all state for clean campaign
    resetCampaignState();
    
    setLastSubmittedCode(code);
    setLastMaxInputs(maxInputs);
    setStartTime(Date.now());
    setAppState('ANALYSIS');

    try {
      const apiUrl = import.meta.env.VITE_API_URL
        ? `${import.meta.env.VITE_API_URL}/api/fuzz`
        : '/api/fuzz';

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, maxInputs })
      });

      const data = await response.json();
      setCampaignId(data.campaignId);
    } catch (err) {
      console.error(err);
      setAppState('COMPLETE');
    }
  };

  const handleNewCampaign = () => {
    resetCampaignState();
    setAppState('LANDING');
  };

  const handleRunAgain = () => {
    if (lastSubmittedCode) {
      handleFuzz(lastSubmittedCode, lastMaxInputs);
    }
  };

  const handleViewHistoryCampaign = (entry: CampaignHistoryEntry) => {
    resetCampaignState();
    setStats(entry.stats);
    setFindings(entry.findings);
    setTargetName(entry.targetName);
    setDetectedLanguage(entry.language);
    setDurationMs(entry.durationMs);
    setCampaignId(entry.id);
    setLastSubmittedCode(entry.code);
    if (entry.events) setEvents(entry.events);
    setAppState('COMPLETE');
  };

  const handleUpdateHistory = (newHistory: CampaignHistoryEntry[]) => {
    setCampaignHistory(newHistory);
    try {
      localStorage.setItem('omega_fuzz_history', JSON.stringify(newHistory));
    } catch (e) {
      console.warn('Could not save updated history:', e);
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', width: '100%', position: 'relative' }}>
      <MouseGlow />
      <ArchiveSidebar 
        history={campaignHistory}
        onSelectCampaign={handleViewHistoryCampaign}
        onUpdateHistory={handleUpdateHistory}
        currentCampaignId={campaignId}
      />
      <div style={{ flex: 1, overflowX: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <AnimatePresence mode="wait">
          {appState === 'LANDING' && (
            <Landing key="landing" onStart={handleFuzz} initialCode={lastSubmittedCode} />
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
              executionEnvironment={executionEnvironment}
            />
          )}

          {appState === 'COMPLETE' && (
            <FinalReport 
              key="complete"
              stats={stats}
              targetName={targetName}
              findings={findings}
              durationMs={durationMs}
              detectedLanguage={detectedLanguage}
              campaignHistory={campaignHistory}
              events={events}
              onNewCampaign={handleNewCampaign}
              onRunAgain={handleRunAgain}
              onViewCampaign={handleViewHistoryCampaign}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
