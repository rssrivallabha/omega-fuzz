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
    const parserScript = path.join(__dirname, 'ast_parser.py');
    const result = spawnSync('python', [parserScript], {
      input: source,
      encoding: 'utf-8'
    });

    if (result.error) {
      throw new Error(`Failed to execute python parser: ${result.error.message}`);
    }

    try {
      const ast = JSON.parse(result.stdout);
      if (ast.error) {
         throw new Error(`Syntax Error: ${ast.message}`);
      }
      return { ast, source };
    } catch (e) {
      throw new Error(`Failed to parse AST output: ${result.stderr}`);
    }
  }

  async discoverTargets(source: string, parseResult: ParseResult): Promise<Target[]> {
    const targets: Target[] = [];
    const ast = parseResult.ast;

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
    const baseInput: any = {};
    
    // Group constraints by parameter
    const paramConstraints = new Map<string, any[]>();
    for (const node of constraints.nodes) {
      if (!paramConstraints.has(node.parameterName)) {
        paramConstraints.set(node.parameterName, []);
      }
      paramConstraints.get(node.parameterName)!.push(node);
    }

    // Synthesize based on constraints
    if (target.astNode && target.astNode.args && target.astNode.args.args) {
      target.astNode.args.args.forEach((arg: any) => {
        const paramName = arg.arg;
        const pConstraints = paramConstraints.get(paramName) || [];
        
        let synthesizedValue: any = null;
        
        const typeConstraint = pConstraints.find(c => c.constraintType === 'type');
        if (typeConstraint) {
          if (typeConstraint.value === 'dict') synthesizedValue = {};
          else if (typeConstraint.value === 'int') synthesizedValue = 0;
          else if (typeConstraint.value === 'str') synthesizedValue = "";
          else if (typeConstraint.value === 'list') synthesizedValue = [];
        }
        
        const reqKeys = pConstraints.filter(c => c.constraintType === 'required_keys');
        if (reqKeys.length > 0 && typeof synthesizedValue === 'object') {
          for (const req of reqKeys) {
            for (const key of req.value) {
              synthesizedValue[key] = "test"; // Basic fill
            }
          }
        }
        
        baseInput[paramName] = synthesizedValue;
      });
    }

    seeds.push({
      id: 'seed_valid_01',
      input: baseInput,
      source: 'SYNTHESIZED'
    });
    
    // Add some malformed seeds to bootstrap
    seeds.push({
      id: 'seed_malformed_01',
      input: { transaction: null },
      source: 'SYNTHESIZED'
    });
    
    return { seeds };
  }

  async generateHarness(target: Target, configuration: HarnessConfiguration): Promise<GeneratedHarness> {
    return {
      sourceCode: `
import sys
import json
import traceback

def main():
    # To be implemented with raw output constraints
    pass
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
