export interface FuzzStats {
  executed: number;
  rate: number;
  findings: number;
  targets: number;
  expectedRejections: number;
  unexpectedExceptions: number;
  timeouts: number;
}

export interface FuzzEvent {
  eventId: string;
  timestamp: string;
  payload: any;
}

export interface FuzzFinding {
  id: string;
  type: string;
  location: string;
  outcome: string;
  reproducible: boolean;
  message?: string;
  inputData?: any;
  discoveryStrategy?: string;
  trace?: string[];
  targetFunction?: string;
  severity?: string;
  confidence?: number;
}

export type AppState = 'LANDING' | 'ANALYSIS' | 'LIVE' | 'COMPLETE';

export interface CampaignHistoryEntry {
  id: string;
  code: string;
  language: string;
  targetName: string;
  timestamp: string;
  durationMs: number;
  executions: number;
  findingsCount: number;
  status: 'COMPLETED' | 'ERROR';
  findings: FuzzFinding[];
  stats: FuzzStats;
  events?: FuzzEvent[];
  isPinned?: boolean;
  isFavorite?: boolean;
}
