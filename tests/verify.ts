import { startCampaign } from '../apps/orchestrator/src/index.ts';
import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';

async function run() {
    process.env.OMEGA_ALLOW_UNSAFE_LOCAL_EXECUTION = 'true';
    const targets = fs.readFileSync(path.join(__dirname, 'targets.py'), 'utf-8').split('\n\n\n');
    
    for (const target of targets) {
        if (!target.trim()) continue;
        console.log(`\n======================================================`);
        console.log(`TESTING TARGET:`);
        console.log(target.split('\n')[0]); // Print the comment header
        console.log(`======================================================\n`);
        let sampleCount = 0;
        const events = new EventEmitter();
        events.on('internal_event', (e) => {
            if (e.payload.type === 'NEW_FINDING') {
                console.log(`[FINDING/CRASH] ${e.payload.outcome} | ${e.payload.fingerprint.exceptionType} -> ${e.payload.exceptionMessage}`);
            } else if (e.payload.type === 'TARGET_DISCOVERED') {
                console.log(`[TARGET DISCOVERED] ${e.payload.targetId}`);
            } else if (e.payload.type === 'EXECUTION_COMPLETED') {
                if (sampleCount < 5 || e.payload.outcome === 'UNEXPECTED_EXCEPTION') {
                    const preview = typeof e.payload.inputData === 'object' ? JSON.stringify(e.payload.inputData) : String(e.payload.inputData);
                    console.log(`[EXEC SAMPLE #${sampleCount + 1}] Outcome: ${e.payload.outcome} | Input: ${preview.substring(0, 80)}`);
                    sampleCount++;
                }
            }
        });

        try {
            const report = await startCampaign(target, events);
            console.log(`\n[COMPLETE REPORT SUMMARY]`);
            console.log(` - Total Executed Inputs:     ${report.summary.executed}`);
            console.log(` - Unique Findings (Crashes): ${report.summary.unique_findings}`);
            console.log(` - Expected Rejections:       ${report.summary.expected_rejections || 0}`);
            console.log(` - Duplicate Fingerprints:    ${report.summary.duplicates || 0}`);
            console.log(`------------------------------------------------------\n`);
        } catch (err: any) {
            console.error(`[FATAL ERROR] ${err.message}`);
        }
    }
}

run();
