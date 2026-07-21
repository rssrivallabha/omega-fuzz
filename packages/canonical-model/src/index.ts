// ==========================================
// TERMINAL OUTCOMES
// ==========================================
export type TerminalOutcome =
  | 'SUCCESS'
  | 'EXPECTED_REJECTION'
  | 'UNEXPECTED_EXCEPTION'
  | 'PROCESS_CRASH'
  | 'SANITIZER_FINDING'
  | 'ASSERTION_FAILURE'
  | 'TIMEOUT'
  | 'MEMORY_LIMIT'
  | 'OUTPUT_LIMIT'
  | 'SECURITY_VIOLATION'
  | 'COMPILATION_ERROR'
  | 'DEPENDENCY_ERROR'
  | 'HARNESS_ERROR'
  | 'SERIALIZATION_ERROR'
  | 'PLATFORM_ERROR'
  | 'INCONCLUSIVE';

// ==========================================
// CANONICAL SERIALIZATION
// ==========================================
export type SerializedInput = 
  | { $type: 'float'; value: 'NaN' | 'Infinity' | '-Infinity' }
  | { $type: 'bigint'; value: string }
  | { $type: 'bytes'; encoding: 'base64'; value: string }
  | { $type: 'undefined' }
  | { $type: 'circular_reference'; ref: string }
  | { $type: 'object'; value: Record<string, SerializedInput> }
  | { $type: 'array'; value: SerializedInput[] }
  | string 
  | number 
  | boolean 
  | null;

export type CanonicalValue = any; // Representing native runtime values mapped from SerializedInput

// ==========================================
// RAW EXECUTION RESULTS (EVIDENCE)
// ==========================================
export interface RawExecutionResult {
  exitCode: number | null;
  terminationSignal: string | null;
  stdout: string;
  stderr: string;
  wallClockDurationMs: number;
  peakMemoryBytes?: number;
  exceptionType?: string;
  exceptionMessage?: string;
  fullStackTrace?: string;
  timeoutStatus: boolean;
  oomStatus: boolean;
  outputLimitStatus: boolean;
  sandboxPolicyViolation: boolean;
  coverageData?: any;
  sanitizerOutput?: string;
}

export interface ValidationClassification {
  classification:
    | 'EXPECTED_REJECTION'
    | 'LIKELY_EXPECTED_REJECTION'
    | 'NOT_VALIDATION'
    | 'INCONCLUSIVE';
  confidence: number;
  reason: string;
  evidence: ClassificationEvidence[];
}

export interface ClassificationEvidence {
  type: 'AST_MATCH' | 'EXPLICIT_RAISE' | 'TYPE_GUARD' | 'DOCUMENTATION' | 'STACK_TRACE';
  description: string;
  sourceLocation?: string;
}

export interface NormalizedStackTrace {
  frames: string[];
  topMeaningfulFrame?: string;
  rootSourceLocation?: string;
}

export interface NormalizedCrash {
  exceptionType: string;
  normalizedMessage: string;
  stackTrace: NormalizedStackTrace;
}

export interface SanitizerFinding {
  category: string;
  description: string;
  memoryAddress?: string;
  stackTrace: NormalizedStackTrace;
}

// ==========================================
// NORMALIZED FINDINGS
// ==========================================
export interface FindingFingerprint {
  outcomeCategory: TerminalOutcome;
  exceptionType?: string;
  normalizedMessage?: string;
  crashSignal?: string;
  sanitizerCategory?: string;
  rootSourceLocation?: string;
  topMeaningfulStackFrame?: string;
}

export interface Finding {
  id: string; // The canonical ID
  fingerprint: FindingFingerprint;
  outcome: TerminalOutcome;
  severity: 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  confidence: 'CONFIRMED' | 'HIGH_CONFIDENCE' | 'PROBABLE' | 'FLAKY' | 'INCONCLUSIVE' | 'NOT_A_BUG';
  
  targetFunction: string;
  language: string;
  runtime: string;
  
  discoveryTime: string; // ISO-8601
  discoveryStrategy: string;
  
  // Duplication tracking (never overwrites terminal outcome)
  isDuplicate: boolean;
  duplicateOf?: string;
  duplicateCount: number;
  
  // Reproduction tracking
  isReproducible: boolean;
  reproductionAttempts: number;
  reproductionSuccesses: number;
  reproductionRate: number;
  
  // Minimization tracking
  isMinimized: boolean;
  originalInput: SerializedInput;
  minimizedInput?: SerializedInput;
  originalSize: number;
  minimizedSize?: number;
  reductionPercentage?: number;

  // Artifacts
  exception?: string;
  normalizedStackTrace?: NormalizedStackTrace;
  crashSignal?: string;
  sanitizerEvidence?: SanitizerFinding;
  executionDurationMs: number;
  memoryUsageBytes?: number;
  
  // Context
  justification: string;
  securityRelevance?: string;
}

// ==========================================
// CANONICAL REPORT SCHEMA
// ==========================================
export interface CanonicalReport {
  schema_version: string;
  campaign_id: string;
  generated_at: string; // ISO-8601
  
  target: {
    language: string;
    language_confidence: number;
    runtime: string;
    runtime_version: string;
    targets: string[];
  };
  
  configuration: {
    automated: boolean;
    seed: number;
    timeout_ms: number;
    memory_limit_mb: number;
    workers: number;
  };
  
  summary: {
    generated: number;
    executed: number;
    successes: number;
    expected_rejections: number;
    unexpected_exceptions: number;
    process_crashes: number;
    sanitizer_findings: number;
    assertion_failures: number;
    timeouts: number;
    memory_limits: number;
    output_limits: number;
    security_violations: number;
    compilation_errors: number;
    dependency_errors: number;
    harness_errors: number;
    serialization_errors: number;
    platform_errors: number;
    inconclusive: number;
    
    duplicates: number;
    unique_findings: number;
  };
  
  coverage: {
    available: boolean;
    line_percent?: number;
    branch_percent?: number;
    edge_count?: number;
  };
  
  findings: Finding[];
  timeline: CampaignEvent[];
}

export type EventPayload = 
  | { type: 'CAMPAIGN_STARTED', configuration: any }
  | { type: 'TARGET_DISCOVERED', targetId: string, signature: string }
  | { type: 'NEW_FINDING', findingId: string, fingerprint: FindingFingerprint, outcome: TerminalOutcome }
  | { type: 'CAMPAIGN_PROGRESS', executed: number, durationMs: number }
  | { type: 'CAMPAIGN_COMPLETED', summary: any }
  | { type: 'EXECUTION_COMPLETED', inputId: string, inputData: any, outcome: TerminalOutcome }
  | { type: 'NEW_PATH_DISCOVERED', blockId: string, description: string };

export interface CampaignEvent {
  schemaVersion: '1.0.0';
  eventId: string;
  timestamp: string;
  payload: EventPayload;
}
