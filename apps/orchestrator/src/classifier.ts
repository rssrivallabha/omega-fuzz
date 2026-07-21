import {
  RawExecutionResult,
  ValidationClassification,
  ClassificationEvidence
} from '@omega-fuzz/canonical-model';
import { ProgramAnalysis } from '@omega-fuzz/language-core';

export class ExceptionParser {
  parsePythonException(stderr: string): { type: string, message: string } | null {
    if (!stderr) return null;
    
    // Look for the last line that matches typical Python exception format (Type: Message)
    const lines = stderr.trim().split('\n');
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim();
      const match = line.match(/^([a-zA-Z0-9_.]+Exception|[a-zA-Z0-9_.]+Error):\s*(.*)$/);
      if (match) {
        return {
          type: match[1],
          message: match[2]
        };
      }
    }
    
    return null;
  }
}

import { ConstraintGraph } from '@omega-fuzz/language-core';

export class ValidationClassifier {
  classify(
    execution: RawExecutionResult, 
    analysis: ProgramAnalysis,
    constraints?: ConstraintGraph
  ): ValidationClassification {
    const defaultResult: ValidationClassification = {
      classification: 'INCONCLUSIVE',
      confidence: 0,
      reason: 'No evidence found',
      evidence: []
    };

    if (!execution.stderr) {
      if (execution.exitCode === 0) {
        return {
          classification: 'NOT_VALIDATION',
          confidence: 100,
          reason: 'Clean exit',
          evidence: []
        };
      }
      return defaultResult;
    }

    const parser = new ExceptionParser();
    const exception = parser.parsePythonException(execution.stderr);
    
    if (!exception) {
      return defaultResult;
    }

    // Cross-reference with AST explicit raises
    const isExplicitlyRaised = constraints?.nodes.some(n => 
        n.constraintType === 'explicit_raise' && n.value === exception.type
    );

    if (isExplicitlyRaised) {
        return {
            classification: 'EXPECTED_REJECTION',
            confidence: 100,
            reason: `Explicitly coded validation exception (${exception.type}) detected via AST`,
            evidence: [{
                type: 'EXPLICIT_RAISE',
                description: `Exception ${exception.type} is explicitly raised in the source code.`
            }]
        };
    }

    // Heuristics for EXPECTED_REJECTION
    if (exception.type === 'TypeError' || exception.type === 'ValueError') {
       const evidence: ClassificationEvidence[] = [{
           type: 'EXPLICIT_RAISE',
           description: `Observed standard validation exception: ${exception.type}`
       }];

       // In a full implementation, we'd cross-reference stack traces with AST `raise` nodes.
       return {
         classification: 'EXPECTED_REJECTION',
         confidence: 70, // Without AST cross-reference, confidence is lower
         reason: `Standard validation exception type (${exception.type}) detected`,
         evidence
       };
    }

    // Default to unexpected exception for everything else
    return {
      classification: 'INCONCLUSIVE',
      confidence: 50,
      reason: `Unhandled exception type: ${exception.type}`,
      evidence: []
    };
  }
}
