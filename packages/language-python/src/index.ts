import { spawnSync } from 'child_process';
import * as path from 'path';
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
  NormalizedException,
  ReproductionArtifact,
  ProgramAnalysis,
  ParameterModel,
  Seed
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

let cachedPythonCommand: string | null = null;
export function getPythonCmd(): string {
  if (cachedPythonCommand) return cachedPythonCommand;
  const cmds = process.platform === 'win32' ? ['python', 'python3'] : ['python3', 'python'];
  for (const cmd of cmds) {
    try {
      const res = spawnSync(cmd, ['--version'], { encoding: 'utf-8', timeout: 2000 });
      if (res && (res.status === 0 || !res.error)) {
        cachedPythonCommand = cmd;
        return cmd;
      }
    } catch (e) {}
  }
  return process.platform === 'win32' ? 'python' : 'python3';
}

export class PythonAdapter implements LanguageAdapter {
  readonly languageId = 'python';
  readonly displayName = 'Python';
  readonly capabilities: LanguageCapabilities = {
    detection: true,
    parsing: true,
    execution: true,
    coverage: false,
    sanitizers: 'none',
    stateful_fuzzing: false
  };

  async detect(source: string): Promise<DetectionResult> {
    let score = 0;
    if (source.includes('def ')) score += 0.4;
    if (source.includes('import ') || source.includes('from ')) score += 0.2;
    if (source.includes(':') && source.includes('    ')) score += 0.2;
    if (source.includes('print(')) score += 0.1;
    if (source.includes('raise ')) score += 0.1;
    return { confidence: Math.min(score, 1.0) };
  }

  async parse(source: string): Promise<ParseResult> {
    console.log(`[${new Date().toISOString()}] [DEBUG] Python AST parser start`);
    const startTime = Date.now();
    try {
      const parserScript = path.join(__dirname, 'ast_parser.py');
      const pythonCmd = getPythonCmd();
      const result = spawnSync(pythonCmd, [parserScript], {
        input: source,
        encoding: 'utf-8',
        timeout: 10000
      });

      const execTime = Date.now() - startTime;
      console.log(`[${new Date().toISOString()}] [DEBUG] Subprocess spawnSync(python) execution time: ${execTime}ms`);
      console.log(`[${new Date().toISOString()}] [DEBUG] Subprocess spawnSync(python) exit code: ${result?.status ?? null}`);
      console.log(`[${new Date().toISOString()}] [DEBUG] Subprocess spawnSync(python) stdout: ${String(result?.stdout || '').slice(0, 500)}`);
      console.log(`[${new Date().toISOString()}] [DEBUG] Subprocess spawnSync(python) stderr: ${String(result?.stderr || result?.error?.message || '').slice(0, 500)}`);

      if (result?.error && (result.error as any).code === 'ETIMEDOUT' || execTime >= 10000) {
        console.error(`[${new Date().toISOString()}] [ERROR] Python AST parser timed out after 10000ms`);
        return { ast: { error: true, code: 'TIMEOUT_EXPIRED', message: 'Subprocess timed out after 10000ms', fallback: true }, source };
      }

      if (!result || result.error || result.status !== 0) {
        return { ast: { fallback: true }, source };
      }

      const ast = JSON.parse(result.stdout);
      if (ast.error) {
         return { ast: { fallback: true }, source };
      }
      return { ast, source };
    } catch (e: any) {
      const execTime = Date.now() - startTime;
      console.error(`[${new Date().toISOString()}] [ERROR] Python AST parser threw exception after ${execTime}ms: ${e.message || String(e)}`);
      return { ast: { error: true, code: 'EXECUTION_FAILED', message: e.message || String(e), fallback: true }, source };
    } finally {
      console.log(`[${new Date().toISOString()}] [DEBUG] Python AST parser exit`);
    }
  }

  async discoverTargets(source: string, parseResult: ParseResult): Promise<Target[]> {
    const targets: Target[] = [];
    const ast = parseResult.ast;

    if (!ast || ast.fallback) {
      // Robust regex-based discovery when Python binary is not in environment
      const defRegex = /def\s+([a-zA-Z_$][0-9a-zA-Z_$]*)\s*\(([^)]*)\)/g;
      let match;
      while ((match = defRegex.exec(source)) !== null) {
        targets.push({
          id: match[1],
          name: match[1],
          type: 'function',
          accessibility: 100,
          sourceLocation: 'regex fallback',
          astNode: {}
        });
      }
      return targets;
    }

    const traverse = (node: any) => {
      if (!node || typeof node !== 'object') return;
      
      if (node._type === 'FunctionDef' || node._type === 'AsyncFunctionDef') {
        targets.push({
          id: node.name,
          name: node.name,
          type: node._type === 'AsyncFunctionDef' ? 'function' : 'function',
          accessibility: 100,
          sourceLocation: `line ${node.lineno}`,
          astNode: node
        });
      }

      for (const key of Object.keys(node)) {
        if (key === '_type' || key === 'lineno') continue;
        const child = node[key];
        if (Array.isArray(child)) {
          child.forEach(traverse);
        } else {
          traverse(child);
        }
      }
    };

    if (ast && ast.body) {
      ast.body.forEach(traverse);
    }
    return targets;
  }

  async rankTargets(targets: Target[], analysis: ProgramAnalysis): Promise<RankedTarget[]> {
    return targets.map(t => ({
      ...t,
      rankScore: 100,
      rankReasons: ['Default ranking']
    }));
  }

  async extractSignatures(target: Target, analysis: ProgramAnalysis): Promise<FunctionSignature[]> {
    const node = target.astNode;
    const parameters: ParameterModel[] = [];

    if (node && node.args) {
      const args = node.args;
      
      const extractTypeName = (ann: any): string => {
        if (!ann) return 'any';
        if (ann._type === 'Name') return ann.id;
        return 'any';
      };

      if (args.posonlyargs) {
        args.posonlyargs.forEach((arg: any) => {
          parameters.push({
            name: arg.arg,
            primaryType: extractTypeName(arg.annotation),
            alternativeTypes: [],
            nullability: true,
            required: true,
            kind: 'POSITIONAL_ONLY'
          });
        });
      }
      
      if (args.args) {
        args.args.forEach((arg: any) => {
          parameters.push({
            name: arg.arg,
            primaryType: extractTypeName(arg.annotation),
            alternativeTypes: [],
            nullability: true,
            required: true,
            kind: 'POSITIONAL_OR_KEYWORD'
          });
        });
      }

      if (args.vararg) {
        parameters.push({
            name: args.vararg.arg,
            primaryType: 'tuple',
            alternativeTypes: [],
            nullability: false,
            required: false,
            kind: 'VAR_POSITIONAL'
        });
      }

      if (args.kwonlyargs) {
        args.kwonlyargs.forEach((arg: any) => {
           parameters.push({
            name: arg.arg,
            primaryType: extractTypeName(arg.annotation),
            alternativeTypes: [],
            nullability: true,
            required: true,
            kind: 'KEYWORD_ONLY'
          });
        });
      }

      if (args.kwarg) {
        parameters.push({
            name: args.kwarg.arg,
            primaryType: 'dict',
            alternativeTypes: [],
            nullability: false,
            required: false,
            kind: 'VAR_KEYWORD'
        });
      }
    }

    return [{
      parameters,
      returnType: node.returns && node.returns._type === 'Name' ? node.returns.id : 'any',
      isAsync: node._type === 'AsyncFunctionDef'
    }];
  }

  async inferTypes(target: Target, analysis: ProgramAnalysis): Promise<TypeInferenceResult> {
    return { inferredTypes: new Map(), confidence: 0 };
  }

  async extractConstraints(target: Target, analysis: ProgramAnalysis): Promise<ConstraintGraph> {
    const nodes: any[] = [];
    const edges: any[] = [];
    const ast = target.astNode;

    const traverse = (node: any) => {
      if (!node || typeof node !== 'object') return;
      
      if (node._type === 'If' && node.test) {
        // Look for isinstance
        if (node.test._type === 'UnaryOp' && node.test.op && node.test.op._type === 'Not' && node.test.operand && node.test.operand._type === 'Call') {
          const call = node.test.operand;
          if (call.func && call.func._type === 'Name' && call.func.id === 'isinstance') {
            if (call.args && call.args.length === 2) {
              const varName = call.args[0].id;
              const typeName = call.args[1].id;
              if (varName && typeName) {
                nodes.push({
                  id: `type_${varName}`,
                  parameterName: varName,
                  constraintType: 'type',
                  value: typeName,
                  evidence: `isinstance(${varName}, ${typeName})`
                });
              }
            }
          }
        }
        
        // Look for dictionary key requirements e.g., 'user_id' not in transaction
        if (node.test._type === 'Compare' && node.test.ops && node.test.ops[0] && node.test.ops[0]._type === 'NotIn') {
          if (node.test.left && node.test.left._type === 'Constant' && node.test.comparators && node.test.comparators[0]._type === 'Name') {
            nodes.push({
              id: `req_key_${node.test.left.value}`,
              parameterName: node.test.comparators[0].id,
              constraintType: 'required_keys',
              value: [node.test.left.value],
              evidence: `'${node.test.left.value}' not in ${node.test.comparators[0].id}`
            });
          }
        }
        
        // Boundary Extraction
        if (node.test._type === 'Compare' && node.test.ops && node.test.ops.length > 0) {
          const opType = node.test.ops[0]._type;
          if (['Lt', 'LtE', 'Gt', 'GtE', 'Eq', 'NotEq'].includes(opType)) {
            let paramName = null;
            let boundaryValue = null;
            
            if (node.test.left._type === 'Name' && node.test.comparators[0]._type === 'Constant') {
              paramName = node.test.left.id;
              boundaryValue = node.test.comparators[0].value;
            } else if (node.test.left._type === 'Constant' && node.test.comparators[0]._type === 'Name') {
              paramName = node.test.comparators[0].id;
              boundaryValue = node.test.left.value;
            }

            if (paramName && typeof boundaryValue === 'number') {
              nodes.push({
                id: `bound_${paramName}_${boundaryValue}_${Math.random().toString(36).substring(7)}`,
                parameterName: paramName,
                constraintType: 'interval',
                value: boundaryValue,
                evidence: `Boundary test found in AST`
              });
            }
          }
        }
      }

      // Explicit Raise Extraction
      if (node._type === 'Raise') {
          if (node.exc && node.exc.func && node.exc.func.id) { // raise ValueError("...")
              nodes.push({
                  id: `raise_${node.exc.func.id}_${Math.random().toString(36).substring(7)}`,
                  parameterName: 'global',
                  constraintType: 'explicit_raise',
                  value: node.exc.func.id,
                  evidence: `Explicit raise ${node.exc.func.id}`
              });
          } else if (node.exc && node.exc.id) { // raise ValueError
              nodes.push({
                  id: `raise_${node.exc.id}_${Math.random().toString(36).substring(7)}`,
                  parameterName: 'global',
                  constraintType: 'explicit_raise',
                  value: node.exc.id,
                  evidence: `Explicit raise ${node.exc.id}`
              });
          }
      }

      for (const key of Object.keys(node)) {
        if (key === '_type' || key === 'lineno') continue;
        const child = node[key];
        if (Array.isArray(child)) {
          child.forEach(traverse);
        } else {
          traverse(child);
        }
      }
    };

    if (ast) traverse(ast);
    return { nodes, edges };
  }

  async synthesizeSeeds(target: Target, constraints: ConstraintGraph): Promise<SeedCorpus> {
    const seeds: Seed[] = [];
    
    // We will generate a base dict that satisfies standard Python requirements
    // based on parameter names.
    const baseInput: any = {};
    const paramConstraints = new Map<string, any[]>();
    for (const node of constraints.nodes) {
      if (!paramConstraints.has(node.parameterName)) {
        paramConstraints.set(node.parameterName, []);
      }
      paramConstraints.get(node.parameterName)!.push(node);
    }

    const args = target.astNode && target.astNode.args && target.astNode.args.args ? target.astNode.args.args : [];

    args.forEach((arg: any) => {
      const paramName = arg.arg;
      const pConstraints = paramConstraints.get(paramName) || [];
      
      let synthesizedValue: any = 0; // default int

      pConstraints.forEach(c => {
         if (c.constraintType === 'type') {
             if (c.value === 'dict') synthesizedValue = {};
             else if (c.value === 'list') synthesizedValue = [];
             else if (c.value === 'str') synthesizedValue = "fuzz";
             else if (c.value === 'int') synthesizedValue = 42;
             else if (c.value === 'float') synthesizedValue = 3.14;
         }
         if (c.constraintType === 'required_keys') {
             if (typeof synthesizedValue !== 'object') synthesizedValue = {};
             c.value.forEach((k: string) => { synthesizedValue[k] = "fuzz"; });
         }
      });
      
      baseInput[paramName] = synthesizedValue;
    });

    // Seed 1: The fully constrained valid input
    seeds.push({ id: 'seed_valid_01', input: { value: baseInput }, source: 'SYNTHESIZED', discoveryStrategy: 'Constraint Solver' });
    
    // Seed 2: Empty collections (often causes KeyError / validation crash)
    const emptyInput: any = {};
    args.forEach((arg: any) => { emptyInput[arg.arg] = {}; });
    seeds.push({ id: 'seed_empty_01', input: { value: emptyInput }, source: 'SYNTHESIZED', discoveryStrategy: 'Dictionary Synthesis' });

    // Seed 3: Wrong types (e.g. passing strings where dict expected)
    const badInput: any = {};
    args.forEach((arg: any) => { badInput[arg.arg] = "invalid_string_type"; });
    seeds.push({ id: 'seed_bad_type_01', input: { value: badInput }, source: 'SYNTHESIZED', discoveryStrategy: 'Type Mutation' });

    // Seed 4: Complex Iterables for lists
    const listInput: any = {};
    args.forEach((arg: any) => { listInput[arg.arg] = [[], [1], ["a", "b"], [{"nested": "dict"}]]; });
    seeds.push({ id: 'seed_complex_list_01', input: { value: listInput }, source: 'SYNTHESIZED', discoveryStrategy: 'Type Mutation' });

    // Synthesize Boundaries
    for (const node of constraints.nodes) {
        if (node.constraintType === 'interval' && typeof node.value === 'number') {
            const val = node.value;
            // Generate -1, 0, 1 around the boundary, plus the boundary itself
            [val - 1, val, val + 1, 0, -1, 99, 100, 101].forEach((boundaryVal, i) => {
                const bInput = JSON.parse(JSON.stringify(baseInput));
                bInput[node.parameterName] = boundaryVal;
                seeds.push({
                    id: `seed_boundary_${node.parameterName}_${i}`,
                    input: { value: bInput },
                    source: 'SYNTHESIZED',
                    discoveryStrategy: 'Boundary Mutation'
                });
            });
        }
    }

    // Ensure we have at least something to fuzz
    if (seeds.length === 0) {
        seeds.push({ id: 'fallback', input: { value: { a: 1 } }, source: 'SYNTHESIZED', discoveryStrategy: 'Default Generation' });
    }
    
    return { seeds };
  }

  async generateHarness(target: Target, configuration: HarnessConfiguration): Promise<GeneratedHarness> {
    return {
      sourceCode: `
import sys
import json
import traceback

def _omega_reconstruct_bytes(val, target_func_name=None, param_name=None):
    if isinstance(val, dict):
        if '__omega_bytes_hex' in val and isinstance(val['__omega_bytes_hex'], str):
            try:
                return bytes.fromhex(val['__omega_bytes_hex'])
            except Exception:
                return val['__omega_bytes_hex'].encode('utf-8', 'surrogateescape')
        if '__omega_bytes_base64' in val and isinstance(val['__omega_bytes_base64'], str):
            import base64
            try:
                return base64.b64decode(val['__omega_bytes_base64'])
            except Exception:
                return val['__omega_bytes_base64'].encode('utf-8', 'surrogateescape')
        return {k: _omega_reconstruct_bytes(v, target_func_name, k) for k, v in val.items()}
    elif isinstance(val, list):
        return [_omega_reconstruct_bytes(item) for item in val]
    elif isinstance(val, str):
        if target_func_name and param_name:
            import inspect
            try:
                sig = inspect.signature(target_func_name)
                if param_name in sig.parameters and sig.parameters[param_name].annotation is bytes:
                    return val.encode('utf-8', 'surrogateescape')
            except Exception:
                pass
    return val

${(target as any).source || ''}

def main():
    for line in sys.stdin:
        line = line.strip()
        if not line: continue
        try:
            kwargs = json.loads(line)
            if isinstance(kwargs, dict):
                for k in list(kwargs.keys()):
                    kwargs[k] = _omega_reconstruct_bytes(kwargs[k], ${target.name}, k)
            result = ${target.name}(**kwargs)
            print(json.dumps({"status": "success"}))
        except Exception as e:
            tb = traceback.extract_tb(sys.exc_info()[2])
            trace_frames = [{"filename": frame.filename, "name": frame.name, "lineno": frame.lineno} for frame in tb]
            
            error_data = {
                "status": "error",
                "type": type(e).__name__,
                "message": str(e),
                "trace": trace_frames
            }
            print(json.dumps(error_data))
        
        sys.stdout.flush()

if __name__ == "__main__":
    main()
`,
      entryPoint: 'main',
      dependencies: []
    };
  }

  async serializeInput(input: CanonicalValue): Promise<SerializedInput> {
    return input; // Needs lossless serialization
  }

  async deserializeInput(input: SerializedInput): Promise<CanonicalValue> {
    return input;
  }

  async parseException(execution: RawExecutionResult): Promise<NormalizedException | null> {
    return null;
  }

  async parseCrash(execution: RawExecutionResult): Promise<NormalizedCrash | null> {
      try {
          if (!execution.stdout) return null;
          const lines = execution.stdout.split(/\r?\n/).filter(l => l.trim() !== '');
          for (const line of lines) {
              const data = JSON.parse(line);
              if (data.status === 'error') {
                  const frames = data.trace.map((f: any) => `${f.filename}:${f.lineno} in ${f.name}`);
                  return {
                      exceptionType: data.type,
                      normalizedMessage: data.message,
                      stackTrace: { frames }
                  } as any;
              }
          }
      } catch (e) {
          // Parsing error
      }
      return null;
  }

  async normalizeStackTrace(trace: string): Promise<NormalizedStackTrace> {
    return { frames: trace.split('\\n') };
  }

  async classifyValidationBehavior(execution: RawExecutionResult, analysis: ProgramAnalysis): Promise<ValidationClassification> {
    return {
      classification: 'INCONCLUSIVE',
      confidence: 0,
      reason: 'Not implemented',
      evidence: []
    };
  }

  async generateReproducer(finding: Finding): Promise<ReproductionArtifact> {
    return { reproductionSnippet: '' };
  }
}
