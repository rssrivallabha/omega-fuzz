import { useState, useEffect } from 'react';
import './index.css';

// Type stubs matching canonical-model
type EventPayload = any;
interface CampaignEvent {
  schemaVersion: '1.0.0';
  eventId: string;
  timestamp: string;
  payload: EventPayload;
}

function App() {
  const [events, setEvents] = useState<CampaignEvent[]>([]);
  const [stats, setStats] = useState({
    executed: 0,
    findings: 0,
    targets: 0,
    rate: 0
  });

  useEffect(() => {
    // SSE Connection to Orchestrator API
    const es = new EventSource('http://localhost:3001/api/stream');
    
    let lastExecuted = 0;
    let lastTime = Date.now();

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'BATCH') {
          const newEvents: CampaignEvent[] = data.events;
          
          setEvents(prev => {
             const combined = [...newEvents, ...prev];
             return combined.slice(0, 100); // Keep last 100
          });

          newEvents.forEach(e => {
            const p = e.payload;
            if (p.type === 'CAMPAIGN_PROGRESS') {
              const now = Date.now();
              const deltaT = (now - lastTime) / 1000;
              const deltaE = p.executed - lastExecuted;
              
              setStats(s => ({
                ...s,
                executed: p.executed,
                rate: deltaT > 0 ? Math.round(deltaE / deltaT) : s.rate
              }));
              lastExecuted = p.executed;
              lastTime = now;
            } else if (p.type === 'NEW_FINDING') {
              setStats(s => ({ ...s, findings: s.findings + 1 }));
            } else if (p.type === 'TARGET_DISCOVERED') {
              setStats(s => ({ ...s, targets: s.targets + 1 }));
            }
          });
        }
      } catch (e) {
        console.error("Failed to parse event", e);
      }
    };

    return () => es.close();
  }, []);

  const getEventBadge = (type: string) => {
    switch (type) {
      case 'NEW_FINDING': return <span className="event-type type-new-finding">FINDING</span>;
      case 'CAMPAIGN_PROGRESS': return <span className="event-type type-progress">PROGRESS</span>;
      case 'TARGET_DISCOVERED': return <span className="event-type type-discovery">TARGET</span>;
      default: return <span className="event-type">{type}</span>;
    }
  };

  const renderEventDetails = (p: any) => {
    if (p.type === 'NEW_FINDING') {
       return (
         <div className="finding-pill">
           {p.outcome} | {p.fingerprint?.exceptionType || 'Unknown'}
         </div>
       );
    }
    if (p.type === 'CAMPAIGN_PROGRESS') {
       return <div>{p.executed.toLocaleString()} total executions</div>;
    }
    if (p.type === 'TARGET_DISCOVERED') {
       return <div>{p.targetId}</div>;
    }
    return null;
  };

  return (
    <div className="dashboard-container">
      <header>
        <div className="logo-container">
          <h1>Omega Fuzz</h1>
          <p>Next-Generation Continuous Intelligence</p>
        </div>
        <div className="status-indicator">
          <span style={{color: 'var(--accent-green)', display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
             <span style={{display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-green)', boxShadow: '0 0 8px var(--accent-green)'}}></span>
             Engine Active
          </span>
        </div>
      </header>

      <div className="stats-grid">
        <div className="stat-card">
          <h3>Total Executions</h3>
          <div className="value">{stats.executed.toLocaleString()}</div>
        </div>
        <div className="stat-card">
          <h3>Execution Rate</h3>
          <div className="value">{stats.rate.toLocaleString()} <span style={{fontSize:'1rem', color:'var(--text-muted)'}}>exec/sec</span></div>
        </div>
        <div className="stat-card">
          <h3>Unique Findings</h3>
          <div className="value danger">{stats.findings}</div>
        </div>
        <div className="stat-card">
          <h3>Discovered Targets</h3>
          <div className="value success">{stats.targets}</div>
        </div>
      </div>

      <div className="content-grid">
        <div className="panel">
          <h2>Live Event Stream</h2>
          <div className="event-list">
            {events.length === 0 ? (
              <div style={{color: 'var(--text-muted)', textAlign: 'center', padding: '2rem'}}>
                Waiting for engine events...
              </div>
            ) : (
              events.map((e, i) => (
                <div key={e.eventId || i} className="event-item">
                  <div>
                    {getEventBadge(e.payload.type)}
                    <div className="event-details">
                      {renderEventDetails(e.payload)}
                    </div>
                  </div>
                  <div style={{color: 'var(--text-muted)', fontSize: '0.75rem'}}>
                    {new Date(e.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        
        <div className="panel">
           <h2>Campaign Status</h2>
           <div style={{display: 'flex', flexDirection: 'column', gap: '1rem'}}>
             <div>
               <div style={{display:'flex', justifyContent:'space-between', marginBottom:'0.25rem'}}>
                 <span style={{color: 'var(--text-muted)', fontSize: '0.85rem'}}>Coverage Progress (Est)</span>
                 <span style={{fontSize: '0.85rem'}}>~24%</span>
               </div>
               <div style={{background: 'rgba(255,255,255,0.05)', height: '6px', borderRadius: '3px', overflow:'hidden'}}>
                 <div style={{background: 'linear-gradient(90deg, var(--accent-blue), var(--accent-purple))', width: '24%', height: '100%'}}></div>
               </div>
             </div>
             
             <div style={{marginTop: '1rem'}}>
               <h3 style={{fontSize:'0.875rem', color:'var(--text-muted)', marginBottom:'0.5rem'}}>Active Strategies</h3>
               <div style={{display:'flex', gap:'0.5rem', flexWrap:'wrap'}}>
                 <span className="finding-pill" style={{borderColor: 'var(--accent-blue)', color:'var(--accent-blue)'}}>AST Constraint Solver</span>
                 <span className="finding-pill">Random Mutation</span>
                 <span className="finding-pill">Dictionary Synthesis</span>
               </div>
             </div>
           </div>
        </div>
      </div>
    </div>
  );
}

export default App;
