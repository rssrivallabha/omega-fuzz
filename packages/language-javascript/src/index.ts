import {
  LanguageAdapter,
  LanguageCapabilities,
  DetectionResult,
  ParseResult,
  Target,
  RankedTarget,
  FunctionSignature,
  TypeInferenceResult,
  ConstraintGraph,
  SeedCorpus,
  HarnessConfiguration,
  GeneratedHarness,
  CompilationResult,
  ReproductionArtifact,
  ProgramAnalysis
} from '@omega-fuzz/language-core';
import {
  Finding,
  SerializedInput,
  CanonicalValue,
  RawExecutionResult,
  NormalizedCrash,
  SanitizerFinding,
  NormalizedStackTrace,
  ValidationClassification
} from '@omega-fuzz/canonical-model';

export class JavaScriptAdapter implements LanguageAdapter {
  readonly languageId = 'javascript';
  readonly displayName = 'JavaScript / TypeScript';
  readonly capabilities: LanguageCapabilities = {
    detection: true,
    parsing: true,
    execution: false,
    coverage: false,
    sanitizers: 'none',
    stateful_fuzzing: false
  };

  async detect(source: string): Promise<DetectionResult> {
    let score = 0;
    if (source.includes('const ') || source.includes('let ')) score += 0.4;
    if (source.includes('function ') || source.includes('=>')) score += 0.3;
    if (source.includes('import ') || source.includes('require(')) score += 0.2;
    return { confidence: Math.min(score, 1.0) };
  }

  async parse(source: string): Promise<ParseResult> {
    return { ast: {}, sourceCode: source, syntaxErrors: [] } as any;
  }

  async discoverTargets(source: string, parseResult: ParseResult): Promise<Target[]> {
    const targets: Target[] = [];
    // Basic regex to find function names
    const functionRegex = /function\s+([a-zA-Z_$][0-9a-zA-Z_$]*)\s*\(([^)]*)\)/g;
    let match;
    while ((match = functionRegex.exec(source)) !== null) {
      targets.push({
        id: match[1],
        name: match[1],
        startLine: 1,
        endLine: 10,
        signature: match[0]
      } as any);
    }
    
    // Check for const func = (...) =>
    const arrowRegex = /const\s+([a-zA-Z_$][0-9a-zA-Z_$]*)\s*=\s*(?:async\s*)?\(([^)]*)\)\s*=>/g;
    while ((match = arrowRegex.exec(source)) !== null) {
      targets.push({
        id: match[1],
        name: match[1],
        startLine: 1,
        endLine: 10,
        signature: match[0]
      } as any);
    }

    return targets;
  }

  async rankTargets(targets: Target[], analysis: ProgramAnalysis): Promise<RankedTarget[]> {
    return targets.map(t => ({ ...t, rankScore: 1.0, rankReasons: [] } as any));
  }

  async extractSignatures(target: Target, analysis: ProgramAnalysis): Promise<FunctionSignature[]> {
    return [];
  }

  async inferTypes(target: Target, analysis: ProgramAnalysis): Promise<TypeInferenceResult> {
    return {} as any;
  }

  async extractConstraints(target: Target, analysis: ProgramAnalysis): Promise<ConstraintGraph> {
    // Generate dummy constraints for JS
    return {
       nodes: [{ id: 'arg1', type: 'object', metadata: {} }],
       edges: []
    } as any;
  }

  async synthesizeSeeds(target: Target, constraints: ConstraintGraph): Promise<SeedCorpus> {
    return {
      seeds: [
        { id: '1', input: { value: {} } },
        { id: '2', input: { value: { id: 1, name: "test" } } },
        { id: '3', input: { value: null } },
        { id: '4', input: { value: "string" } },
        { id: '5', input: { value: [] } }
      ]
    } as any;
  }

  async generateHarness(target: Target, configuration: HarnessConfiguration): Promise<GeneratedHarness> {
    const sourceCode = (target as any).source || '';
    
    const harnessCode = `
${sourceCode}

const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

rl.on('line', (line) => {
  if (!line.trim()) return;
  try {
    const input = JSON.parse(line);
    const result = typeof ${target.name} === 'function' ? ${target.name}(input) : null;
    console.log(JSON.stringify({ status: "success" }));
  } catch (e) {
    console.log(JSON.stringify({
      status: "error",
      type: e.name || "Error",
      message: e.message || String(e),
      trace: e.stack ? e.stack.split('\\n').map(l => l.trim()) : []
    }));
  }
});
`;
    return {
      sourceCode: harnessCode,
      language: 'javascript',
      entryPoint: 'main',
      dependencies: []
    } as any;
  }

  async serializeInput(input: CanonicalValue): Promise<SerializedInput> {
    return "{}" as any;
  }

  async deserializeInput(input: SerializedInput): Promise<CanonicalValue> {
    return { value: null } as any;
  }

  async parseException(execution: RawExecutionResult): Promise<any> {
    return null;
  }

  async parseCrash(execution: RawExecutionResult): Promise<NormalizedCrash | null> {
    if (!execution.stdout) return null;
    const lines = execution.stdout.split('\\n');
    for (const line of lines) {
      if (line.includes('"status":"error"')) {
        try {
          const parsed = JSON.parse(line);
          return {
            exceptionType: parsed.type,
            normalizedMessage: parsed.message,
            stackTrace: {
              frames: parsed.trace.slice(1).map((f: string) => f) // skip the error message line
            } as any
          } as any;
        } catch (e) {
          return null;
        }
      }
    }
    return null;
  }

  async normalizeStackTrace(trace: string): Promise<NormalizedStackTrace> {
    return { frames: [] };
  }

  async classifyValidationBehavior(execution: RawExecutionResult, analysis: ProgramAnalysis): Promise<ValidationClassification> {
    return { classification: 'NOT_VALIDATION', confidence: 1.0, reason: '', evidence: [] };
  }

  async generateReproducer(finding: Finding): Promise<ReproductionArtifact> {
    return { sourceCode: '', language: 'javascript', requiredDependencies: [] } as any;
  }
}

