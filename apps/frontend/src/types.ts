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
  type: string; // e.g. "ValueError"
  location: string;
  outcome: string; // e.g. "UNEXPECTED_EXCEPTION"
  reproducible: boolean;
  message?: string;
  inputData?: any;
  discoveryStrategy?: string;
  trace?: string[];
}

export type AppState = 'LANDING' | 'ANALYSIS' | 'LIVE' | 'COMPLETE';
