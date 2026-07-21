import {
  Finding,
  NormalizedCrash,
  NormalizedStackTrace,
  RawExecutionResult,
  SanitizerFinding,
  SerializedInput,
  TerminalOutcome,
  ValidationClassification,
  CanonicalValue
} from '@omega-fuzz/canonical-model';

// ==========================================
// ANALYSIS AND DISCOVERY
// ==========================================
export interface LanguageCapabilities {
  detection: boolean;
  parsing: boolean;
  execution: boolean;
  coverage: boolean;
  sanitizers: 'full' | 'partial' | 'none';
  stateful_fuzzing: boolean;
}

export interface DetectionResult {
  confidence: number;
}

export interface ParseResult {
  ast: any;
  source: string;
}

export interface Target {
  id: string;
  name: string;
  type: 'function' | 'method' | 'class';
  accessibility: number; // 0-100 score
  sourceLocation?: string;
  astNode?: any;
}

export interface ProgramAnalysis {
  parseResult: ParseResult;
  controlFlowGraph?: any;
  callGraph?: any;
}

export interface RankedTarget extends Target {
  rankScore: number;
  rankReasons: string[];
}

export interface FunctionSignature {
  parameters: ParameterModel[];
  returnType: string;
  isAsync: boolean;
}

export interface ParameterModel {
  name: string;
  primaryType: string;
  alternativeTypes: string[];
  nullability: boolean;
  required: boolean;
  defaultValue?: any;
  kind: 'POSITIONAL_ONLY' | 'POSITIONAL_OR_KEYWORD' | 'KEYWORD_ONLY' | 'VAR_POSITIONAL' | 'VAR_KEYWORD';
}

export interface TypeInferenceResult {
  inferredTypes: Map<string, string[]>;
  confidence: number;
}

export interface ConstraintGraph {
  nodes: ConstraintNode[];
  edges: ConstraintEdge[];
}

export interface ConstraintNode {
  id: string;
  parameterName: string;
  constraintType: 'interval' | 'length' | 'regex' | 'type' | 'literal' | 'collection_size' | 'required_keys' | 'explicit_raise';
  value: any;
  evidence: string; // AST source
}

export interface ConstraintEdge {
  fromId: string;
  toId: string;
  relationship: string;
}

export interface SeedCorpus {
  seeds: Seed[];
}

export interface Seed {
  id: string;
  input: CanonicalValue;
  source: 'SYNTHESIZED' | 'MUTATED' | 'EXTRACTED';
  discoveryStrategy?: string;
}

export interface HarnessConfiguration {
  targetId: string;
  timeoutMs: number;
  captureCoverage: boolean;
}

export interface GeneratedHarness {
  sourceCode: string;
  entryPoint: string;
  dependencies: string[];
}

export interface ExecutionEnvironment {
  runtime: string;
  version: string;
}

export interface CompilationResult {
  success: boolean;
  executablePath?: string;
  compilationOutput: string;
}

export interface NormalizedException {
  exceptionType: string;
  message: string;
}

export interface ReproductionArtifact {
  reproductionSnippet: string;
  reproductionCommand?: string;
}

// ==========================================
// UNIVERSAL ADAPTER CONTRACT
// ==========================================
export interface LanguageAdapter {
  readonly languageId: string;
  readonly displayName: string;
  readonly capabilities: LanguageCapabilities;

  detect(source: string): Promise<DetectionResult>;

  parse(source: string): Promise<ParseResult>;

  discoverTargets(
    source: string,
    parseResult: ParseResult
  ): Promise<Target[]>;

  rankTargets(
    targets: Target[],
    analysis: ProgramAnalysis
  ): Promise<RankedTarget[]>;

  extractSignatures(
    target: Target,
    analysis: ProgramAnalysis
  ): Promise<FunctionSignature[]>;

  inferTypes(
    target: Target,
    analysis: ProgramAnalysis
  ): Promise<TypeInferenceResult>;

  extractConstraints(
    target: Target,
    analysis: ProgramAnalysis
  ): Promise<ConstraintGraph>;

  synthesizeSeeds(
    target: Target,
    constraints: ConstraintGraph
  ): Promise<SeedCorpus>;

  generateHarness(
    target: Target,
    configuration: HarnessConfiguration
  ): Promise<GeneratedHarness>;

  compile?(
    harness: GeneratedHarness,
    environment: ExecutionEnvironment
  ): Promise<CompilationResult>;

  serializeInput(
    input: CanonicalValue
  ): Promise<SerializedInput>;

  deserializeInput(
    input: SerializedInput
  ): Promise<CanonicalValue>;

  parseException(
    execution: RawExecutionResult
  ): Promise<NormalizedException | null>;

  parseCrash(
    execution: RawExecutionResult
  ): Promise<NormalizedCrash | null>;

  parseSanitizerOutput?(
    execution: RawExecutionResult
  ): Promise<SanitizerFinding[]>;

  normalizeStackTrace(
    trace: string
  ): Promise<NormalizedStackTrace>;

  classifyValidationBehavior(
    execution: RawExecutionResult,
    analysis: ProgramAnalysis
  ): Promise<ValidationClassification>;

  generateReproducer(
    finding: Finding
  ): Promise<ReproductionArtifact>;
}
