// SECURITY: All queries in this service MUST be scoped by shopId

import { calculateBusinessPulse } from './businessPulse.js';
import { calculateRiskSummary } from './riskSummary.js';
import { generateRecentActivity } from './recentActivity.js';
import { calculateMomentum } from './momentum.js';
import { calculatePrimaryAction } from './primaryAction.js';

/**
 * Generate complete home snapshot
 * @param {string} shopId - Shop UUID
 * @returns {import('./homeSnapshot.types.js').HomeSnapshot}
 */
export function generateHomeSnapshot(shopId) {
    return {
        snapshotVersion: 1,
        businessPulse: calculateBusinessPulse(shopId),
        primaryAction: calculatePrimaryAction(shopId),
        recentActivity: generateRecentActivity(shopId),
        riskSummary: calculateRiskSummary(shopId),
        momentum: calculateMomentum(shopId),
        generatedAt: new Date().toISOString()
    };
}
