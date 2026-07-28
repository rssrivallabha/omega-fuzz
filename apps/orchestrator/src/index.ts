import { PythonAdapter } from '@omega-fuzz/language-python';
import { LocalProcessExecutionBackend } from '@omega-fuzz/sandbox-manager';
import { ValidationClassifier } from './classifier';
import { DeduplicationEngine } from './dedup';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { CanonicalReport } from '@omega-fuzz/canonical-model';
import { MutationEngine } from '@omega-fuzz/fuzz-engine';

import { JavaScriptAdapter } from '@omega-fuzz/language-javascript';
import { GoAdapter } from '@omega-fuzz/language-go';
import { CppAdapter } from '@omega-fuzz/language-cpp';
import { SqlAdapter } from '@omega-fuzz/language-sql';
import { SwiftAdapter } from '@omega-fuzz/language-swift';

export async function startCampaign(sourceCode: string, eventEmitter: EventEmitter, maxInputs: number = 200): Promise<CanonicalReport> {
  const campaignId = uuidv4();
  
  const computeSeverity = (exType: string): string => {
    const type = (exType || '').toLowerCase();
    if (type.includes('segfault') || type.includes('segmentation') || type.includes('buffer') || type.includes('memory')) return 'CRITICAL';
    if (type.includes('assertion') || type.includes('panic')) return 'HIGH';
    if (type.includes('typeerror') || type.includes('attributeerror') || type.includes('referenceerror')) return 'HIGH';
    if (type.includes('valueerror') || type.includes('keyerror') || type.includes('indexerror')) return 'MEDIUM';
    if (type.includes('zerodivision') || type.includes('overflow') || type.includes('underflow')) return 'HIGH';
    return 'MEDIUM';
  };

  const pyAdapter = new PythonAdapter();
  const jsAdapter = new JavaScriptAdapter();
  const goAdapter = new GoAdapter();
  const cppAdapter = new CppAdapter();
  const sqlAdapter = new SqlAdapter();
  const swiftAdapter = new SwiftAdapter();
  
  // Basic heuristic detection for Go and C++ in addition to JS/Py
  console.log(`[${new Date().toISOString()}] [DEBUG] Language detection start`);
  let pyScore = (await pyAdapter.detect(sourceCode)).confidence;
  let jsScore = (await jsAdapter.detect(sourceCode)).confidence;
  let goScore = sourceCode.includes('func ') && sourceCode.includes('package ') ? 0.9 : 0;
  let cppScore = sourceCode.includes('#include') || sourceCode.includes('int main') || sourceCode.includes('std::') ? 0.9 : 0;
  let sqlScore = (await sqlAdapter.detect(sourceCode)).confidence;
  let swiftScore = (await swiftAdapter.detect(sourceCode)).confidence;
  
  let adapter: any;
  let detectedLanguage: string;
  
  const scores = [
    { name: 'python', score: pyScore, adapter: pyAdapter },
    { name: 'javascript', score: jsScore, adapter: jsAdapter },
    { name: 'go', score: goScore, adapter: goAdapter },
    { name: 'cpp', score: cppScore, adapter: cppAdapter },
    { name: 'sql', score: sqlScore, adapter: sqlAdapter },
    { name: 'swift', score: swiftScore, adapter: swiftAdapter },
  ].sort((a, b) => b.score - a.score);

  if (scores[0].score > 0) {
      adapter = scores[0].adapter;
      detectedLanguage = scores[0].name;
  } else {
      adapter = jsAdapter;
      detectedLanguage = 'javascript';
  }
  console.log(`[${new Date().toISOString()}] [DEBUG] Language detection finish (Detected: ${detectedLanguage})`);

  console.log(`[${new Date().toISOString()}] [DEBUG] Campaign start before emitting CAMPAIGN_STARTED`);
  eventEmitter.emit('internal_event', {
    schemaVersion: '1.0.0',
    eventId: uuidv4(),
    timestamp: new Date().toISOString(),
    payload: { type: 'CAMPAIGN_STARTED', configuration: { target: detectedLanguage, mode: 'end-to-end', executionBackend: 'Local Process' } }
  });
  console.log(`[${new Date().toISOString()}] [DEBUG] Campaign start after emitting CAMPAIGN_STARTED`);

  console.log(`[${new Date().toISOString()}] [DEBUG] Target discovery start`);
  const parsed = await adapter.parse(sourceCode);
  const targets = await adapter.discoverTargets(sourceCode, parsed);
  
  if (targets.length === 0) {
      targets.push({ id: 'global_script', name: 'global', startLine: 1, endLine: sourceCode.split('\n').length } as any);
  }

  const targetNames = targets.map((t: any) => t.name);
  console.log(`[${new Date().toISOString()}] [DEBUG] Target discovery finish (${targets.length} targets found: ${targetNames.join(', ')})`);

  eventEmitter.emit('internal_event', {
      schemaVersion: '1.0.0',
      eventId: uuidv4(),
      timestamp: new Date().toISOString(),
      payload: { type: 'TARGET_DISCOVERED', targetId: targetNames.join(', '), signature: targetNames.length + ' targets discovered' }
  });

  let totalExecuted = 0;
  let totalUniqueFindings = 0;
  const allFindings: any[] = [];
  let totalExpectedRejections = 0;
  
  const deduplication = new DeduplicationEngine() as any;
  const classifier = new ValidationClassifier();
  let startTime = Date.now();

  const inputsPerTarget = Math.floor(maxInputs / targets.length) || 1;

  for (const target of targets) {
      (target as any).source = sourceCode;

      console.log(`[${new Date().toISOString()}] [DEBUG] Constraint extraction start for target: ${target.name}`);
      const constraints = await adapter.extractConstraints(target, {} as any);
      console.log(`[${new Date().toISOString()}] [DEBUG] Constraint extraction finish for target: ${target.name}`);

      console.log(`[${new Date().toISOString()}] [DEBUG] Seed synthesis start for target: ${target.name}`);
      const seedCorpus = await adapter.synthesizeSeeds(target, constraints);
      const mutationEngine = new MutationEngine(target.name, detectedLanguage, sourceCode, seedCorpus.seeds);
      const baseSeeds = mutationEngine.getInitialPool();
      console.log(`[${new Date().toISOString()}] [DEBUG] Seed synthesis finish for target: ${target.name} (${baseSeeds.length} baseline grammar/adapter seeds initialized)`);
      
      eventEmitter.emit('internal_event', {
          schemaVersion: '1.0.0',
          eventId: uuidv4(),
          timestamp: new Date().toISOString(),
          payload: { type: 'SEEDS_GENERATED', seeds: baseSeeds }
      });

      const harness = await adapter.generateHarness(target, { timeoutMs: 1000 } as any);

      let sandboxBackend;
      const allowUnsafe = process.env.OMEGA_ALLOW_UNSAFE_LOCAL_EXECUTION === 'true';

      if (!allowUnsafe) {
          throw new Error("SECURE EXECUTION FAILURE: Docker backend is required.");
      } else {
          sandboxBackend = new LocalProcessExecutionBackend();
      }
      
      const sandbox = await sandboxBackend.prepare({
          targetId: target.name,
          sourceCode: sourceCode,
          harnessCode: harness.sourceCode,
          timeoutMs: 1000,
          memoryLimitMb: 128,
          language: detectedLanguage
      } as any);

      const streamInterval = Math.max(1, Math.floor(inputsPerTarget / 50)); 
      
      console.log(`[${new Date().toISOString()}] [DEBUG] Execution loop start for target: ${target.name} (${inputsPerTarget} inputs configured)`);
      for (let i = 0; i < inputsPerTarget; i++) {
         const seed = mutationEngine.generateLiveInput(i, (target as any).params || (target as any).args || []);
         
         const execResult = await sandboxBackend.execute(sandbox, { inputData: JSON.stringify(seed.input.value) + '\n' });
         
         totalExecuted++;
         const normalizedCrash = await adapter.parseCrash(execResult);
         
         // Use the AST-backed classifier
         const classification = classifier.classify(execResult, {} as any, constraints, normalizedCrash);
         let outcome = 'SUCCESS';

         if (classification.classification === 'EXPECTED_REJECTION' || execResult.stdout.includes('ValueError') || execResult.stderr.includes('ValueError')) {
             outcome = 'EXPECTED_REJECTION';
             totalExpectedRejections++;
         } else if (normalizedCrash || (classification.classification as string) === 'UNEXPECTED_EXCEPTION' || (execResult.exitCode !== 0 && execResult.exitCode !== null) || execResult.stderr.includes('Error') || execResult.stderr.includes('Exception') || execResult.stdout.includes('"status":"error"')) {
             outcome = 'UNEXPECTED_EXCEPTION';
             const crashType = normalizedCrash?.exceptionType || (classification.reason ? classification.reason.split(': ')[1] : 'UnhandledException') || 'RuntimeError';
             const crashMsg = normalizedCrash?.normalizedMessage || execResult.stderr.trim() || execResult.stdout.trim() || 'Execution anomaly detected';
             const frames = (normalizedCrash?.stackTrace as any)?.frames || [execResult.stderr.split('\n')[0] || 'unknown_location'];

             const finding = {
                 id: `FND-${totalUniqueFindings + 1}`,
                 targetFunction: target.name,
                 exceptionMessage: crashMsg,
                 discoveryStrategy: (seed as any).discoveryStrategy || 'Mutation Strategy',
                 fingerprint: {
                     outcomeCategory: 'UNEXPECTED_EXCEPTION',
                     exceptionType: crashType,
                     rootSourceLocation: frames[0] || 'unknown',
                     normalizedMessage: crashMsg
                 },
                 isReproducible: true
             };
                 
             const fgptStr = JSON.stringify(finding.fingerprint);
             if (!deduplication.fingerprintCache?.has(fgptStr)) {
                 deduplication.fingerprintCache?.add(fgptStr);
                 totalUniqueFindings++;
                 allFindings.push(finding);
                 eventEmitter.emit('internal_event', {
                     schemaVersion: '1.0.0',
                     eventId: uuidv4(),
                     timestamp: new Date().toISOString(),
                     payload: { 
                         type: 'NEW_FINDING', 
                         findingId: finding.id, 
                         fingerprint: finding.fingerprint, 
                         outcome: 'UNEXPECTED_EXCEPTION',
                         inputData: seed.input.value,
                         discoveryStrategy: finding.discoveryStrategy,
                         targetFunction: finding.targetFunction,
                         exceptionMessage: finding.exceptionMessage,
                         severity: computeSeverity(crashType),
                         confidence: classification.confidence || 90,
                         trace: frames
                     }
                 });
                 
                 eventEmitter.emit('internal_event', {
                    schemaVersion: '1.0.0',
                    eventId: uuidv4(),
                    timestamp: new Date().toISOString(),
                    payload: { 
                        type: 'EXECUTION_COMPLETED', 
                        inputId: seed.id, 
                        inputData: seed.input.value,
                        outcome: 'UNEXPECTED_EXCEPTION',
                        exceptionType: crashType,
                        exceptionMessage: crashMsg
                    }
                 });
             }
         }

         if ((i % streamInterval === 0 || (outcome === 'EXPECTED_REJECTION' && totalExpectedRejections <= 30)) && outcome !== 'UNEXPECTED_EXCEPTION') {
             eventEmitter.emit('internal_event', {
                schemaVersion: '1.0.0',
                eventId: uuidv4(),
                timestamp: new Date().toISOString(),
                payload: { 
                    type: 'EXECUTION_COMPLETED', 
                    inputId: seed.id, 
                    inputData: seed.input.value,
                    outcome: outcome
                }
             });
         }

         if (totalExecuted % 25 === 0) {
             eventEmitter.emit('internal_event', {
                schemaVersion: '1.0.0',
                eventId: uuidv4(),
                timestamp: new Date().toISOString(),
                payload: { type: 'CAMPAIGN_PROGRESS', executed: totalExecuted, durationMs: Date.now() - startTime }
             });
         }
      }
      console.log(`[${new Date().toISOString()}] [DEBUG] Execution loop finish for target: ${target.name}`);

      await sandboxBackend.destroy(sandbox);
  }

  eventEmitter.emit('internal_event', {
      schemaVersion: '1.0.0',
      eventId: uuidv4(),
      timestamp: new Date().toISOString(),
      payload: { type: 'CAMPAIGN_PROGRESS', executed: totalExecuted, durationMs: Date.now() - startTime }
  });

  console.log(`[${new Date().toISOString()}] [DEBUG] Report generation start`);
  const finalReport = {
      campaign_id: campaignId,
      generated_at: new Date().toISOString(),
      target: { language: detectedLanguage, runtime: 'unknown', targets: targetNames },
      summary: { executed: totalExecuted, unique_findings: totalUniqueFindings, duplicates: deduplication.fingerprintCache?.size || 0, expected_rejections: totalExpectedRejections },
      findings: allFindings,
      timeline: []
  } as any;
  console.log(`[${new Date().toISOString()}] [DEBUG] Report generation finish`);
  return finalReport;
}
