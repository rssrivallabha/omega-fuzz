import { Finding, TerminalOutcome, FindingFingerprint } from '@omega-fuzz/canonical-model';
import * as crypto from 'crypto';

export class DeduplicationEngine {
  private fingerprintCache = new Set<string>();

  generateFingerprint(
    outcomeCategory: TerminalOutcome,
    exceptionType?: string,
    normalizedMessage?: string,
    rootSourceLocation?: string,
    topMeaningfulStackFrame?: string
  ): FindingFingerprint {
    // Basic normalization for message to remove memory addresses and dynamic IDs
    const cleanMessage = normalizedMessage ? 
      normalizedMessage.replace(/0x[0-9a-fA-F]+/g, '<addr>').replace(/\d+/g, '<num>') : 
      undefined;

    return {
      outcomeCategory,
      exceptionType,
      normalizedMessage: cleanMessage,
      rootSourceLocation,
      topMeaningfulStackFrame
    };
  }

  hashFingerprint(fp: FindingFingerprint): string {
    const data = [
      fp.outcomeCategory,
      fp.exceptionType || '',
      fp.normalizedMessage || '',
      fp.rootSourceLocation || '',
      fp.topMeaningfulStackFrame || ''
    ].join('||');
    
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  isDuplicate(finding: Finding): boolean {
    const hash = this.hashFingerprint(finding.fingerprint);
    if (this.fingerprintCache.has(hash)) {
      return true;
    }
    this.fingerprintCache.add(hash);
    return false;
  }
}
