import { CanonicalReport } from '@omega-fuzz/canonical-model';

export class InvariantChecker {
  static validateReport(report: CanonicalReport): boolean {
    const sum = 
      report.summary.successes +
      report.summary.expected_rejections +
      report.summary.unexpected_exceptions +
      report.summary.process_crashes +
      report.summary.sanitizer_findings +
      report.summary.assertion_failures +
      report.summary.timeouts +
      report.summary.memory_limits +
      report.summary.output_limits +
      report.summary.security_violations +
      report.summary.compilation_errors +
      report.summary.dependency_errors +
      report.summary.harness_errors +
      report.summary.serialization_errors +
      report.summary.platform_errors +
      report.summary.inconclusive;

    if (sum !== report.summary.executed) {
      console.error(`Invariant Failed: executed (${report.summary.executed}) does not match sum of outcomes (${sum})`);
      return false;
    }

    if (report.summary.duplicates + report.summary.unique_findings !== report.findings.length) {
      console.error(`Invariant Failed: findings length does not match duplicates + unique`);
      return false;
    }

    // Ensure all findings have a canonical fingerprint and outcome
    for (const finding of report.findings) {
      if (!finding.fingerprint || !finding.fingerprint.outcomeCategory) {
         console.error(`Invariant Failed: Finding ${finding.id} missing fingerprint or outcomeCategory`);
         return false;
      }
      if (finding.outcome !== finding.fingerprint.outcomeCategory) {
         console.error(`Invariant Failed: Finding ${finding.id} outcome does not match fingerprint outcomeCategory`);
         return false;
      }
    }

    return true;
  }
}
