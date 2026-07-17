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
        
        const events = new EventEmitter();
        events.on('internal_event', (e) => {
            if (e.payload.type === 'NEW_FINDING') {
                console.log(`[FINDING] ${e.payload.outcome} | ${e.payload.fingerprint.exceptionType} at ${e.payload.fingerprint.rootSourceLocation}`);
            } else if (e.payload.type === 'TARGET_DISCOVERED') {
                console.log(`[TARGET] ${e.payload.targetId}`);
            }
        });

        try {
            const report = await startCampaign(target, events);
            console.log(`\n[SUMMARY] Executed: ${report.summary.executed}, Unique Findings: ${report.summary.unique_findings}, Duplicates: ${report.summary.duplicates}`);
        } catch (err: any) {
            console.error(`[FATAL ERROR] ${err.message}`);
        }
    }
}

run();
