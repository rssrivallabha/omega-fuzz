import {
  RawExecutionResult,
  ValidationClassification,
  ClassificationEvidence,
  NormalizedCrash
} from '@omega-fuzz/canonical-model';
import { ProgramAnalysis, ConstraintGraph } from '@omega-fuzz/language-core';

export class ExceptionParser {
  parseException(execution: RawExecutionResult, normalizedCrash?: NormalizedCrash | null): { type: string, message: string } | null {
    if (normalizedCrash && normalizedCrash.exceptionType) {
      return {
        type: normalizedCrash.exceptionType,
        message: normalizedCrash.normalizedMessage || ''
      };
    }
    if (execution.stdout) {
      const lines = execution.stdout.split(/\r?\n/);
      for (const line of lines) {
        if (line.includes('"status":"error"') || (line.includes('"status":') && line.includes('"error"'))) {
          try {
            const data = JSON.parse(line.trim());
            if (data.status === 'error' && (data.type || data.message)) {
              return {
                type: data.type || 'Error',
                message: data.message || ''
              };
            }
          } catch(e) {}
        }
      }
    }
    if (execution.stderr) {
      const lines = execution.stderr.trim().split(/\r?\n/);
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
    }
    return null;
  }
}

const EXPECTED_DOMAIN_REJECTIONS = new Set([
  'TypeError',
  'ValueError',
  'KeyError',
  'IndexError',
  'AttributeError',
  'UnicodeDecodeError',
  'XMLSyntaxError',
  'ParseError',
  'JSONDecodeError',
  'OperationalError',
  'ProgrammingError',
  'SyntaxError',
  'RangeError',
  'URIError',
  'sqlite3.OperationalError',
  'sqlite3.ProgrammingError',
  'xml.etree.ElementTree.ParseError',
  'json.decoder.JSONDecodeError'
]);

export class ValidationClassifier {
  classify(
    execution: RawExecutionResult, 
    analysis: ProgramAnalysis,
    constraints?: ConstraintGraph,
    normalizedCrash?: NormalizedCrash | null
  ): ValidationClassification {
    const defaultResult: ValidationClassification = {
      classification: 'INCONCLUSIVE',
      confidence: 0,
      reason: 'No evidence found',
      evidence: []
    };

    const parser = new ExceptionParser();
    const exception = parser.parseException(execution, normalizedCrash);

    if (!exception) {
      if (execution.exitCode === 0) {
        return {
          classification: 'NOT_VALIDATION',
          confidence: 100,
          reason: 'Clean exit with no exception output',
          evidence: []
        };
      }
      return defaultResult;
    }

    // Check against explicit raises in AST
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

    // Check against standard domain validation and parsing rejections
    const shortType = exception.type.split('.').pop() || exception.type;
    if (EXPECTED_DOMAIN_REJECTIONS.has(exception.type) || EXPECTED_DOMAIN_REJECTIONS.has(shortType)) {
        return {
          classification: 'EXPECTED_REJECTION',
          confidence: 95,
          reason: `Domain validation/syntax exception (${exception.type}) properly rejected malformed input`,
          evidence: [{
              type: 'EXPLICIT_RAISE',
              description: `Observed standard input validation rejection: ${exception.type} - ${exception.message}`
          }]
        };
    }

    // All other exceptions (AssertionError, MemoryError, ZeroDivisionError, Segfaults, Logic flaws) are unhandled bugs
    return {
      classification: 'INCONCLUSIVE',
      confidence: 90,
      reason: `Unhandled execution anomaly or memory defect: ${exception.type}`,
      evidence: []
    };
  }
}
