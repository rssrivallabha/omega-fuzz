/**
 * SIMULATION DRIVER - FOR LOAD TESTING ONLY
 * This script is strictly isolated from the real Omega Fuzz engine.
 * It broadcasts synthetic load events to test SSE stream stability and dashboard rendering logic.
 * IT MUST NEVER BE USED IN A REAL CAMPAIGN.
 */

import { EventEmitter } from 'events';

export function startSimulationStream(eventEmitter: EventEmitter) {
    let executed = 0;
    let targets = 0;
    let findings = 0;

    console.log('[SIMULATION MODE] Load-testing driver started. Emitting synthetic events.');

    setInterval(() => {
        executed += Math.floor(Math.random() * 500) + 100;
        
        eventEmitter.emit('internal_event', {
            schemaVersion: '1.0.0',
            eventId: Math.random().toString(36).substring(7),
            timestamp: new Date().toISOString(),
            payload: {
                type: 'CAMPAIGN_PROGRESS',
                executed: executed,
                durationMs: executed * 2.5
            }
        });

        if (Math.random() > 0.9) {
            targets++;
            eventEmitter.emit('internal_event', {
                schemaVersion: '1.0.0',
                eventId: Math.random().toString(36).substring(7),
                timestamp: new Date().toISOString(),
                payload: {
                    type: 'TARGET_DISCOVERED',
                    targetId: `synthetic_target_${targets}`,
                    signature: `def synthetic_target_${targets}(a: int): pass`
                }
            });
        }

        if (Math.random() > 0.95) {
            findings++;
            const exceptions = ['TypeError', 'ValueError', 'IndexError', 'CustomSecurityException'];
            eventEmitter.emit('internal_event', {
                schemaVersion: '1.0.0',
                eventId: Math.random().toString(36).substring(7),
                timestamp: new Date().toISOString(),
                payload: {
                    type: 'NEW_FINDING',
                    findingId: `SIM-FND-${findings}`,
                    outcome: Math.random() > 0.5 ? 'EXPECTED_REJECTION' : 'UNEXPECTED_EXCEPTION',
                    fingerprint: {
                        outcomeCategory: 'UNEXPECTED_EXCEPTION',
                        exceptionType: exceptions[Math.floor(Math.random() * exceptions.length)],
                        rootSourceLocation: `line ${Math.floor(Math.random() * 200)}`
                    }
                }
            });
        }
    }, 100);
}
