/**
 * Log Service
 * Read-only log viewing with hardened access
 */

import { readFileSync, existsSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Hardcoded log path - no user input accepted
const LOG_PATH = join(__dirname, '../../logs/app.log');
const MAX_LINES = 500;

/**
 * Read recent log entries (tail, max 500 lines)
 * @returns {Object} Log content and metadata
 */
export function getRecentLogs() {
    if (!existsSync(LOG_PATH)) {
        return {
            lines: [],
            message: 'Log file does not exist (logs are only created in production)',
            path: LOG_PATH
        };
    }

    const stats = statSync(LOG_PATH);
    const content = readFileSync(LOG_PATH, 'utf-8');
    const allLines = content.split('\n').filter(line => line.trim());

    // Take last MAX_LINES
    const lines = allLines.slice(-MAX_LINES);

    return {
        lines,
        totalLines: allLines.length,
        displayedLines: lines.length,
        maxLines: MAX_LINES,
        fileSizeBytes: stats.size,
        lastModified: stats.mtime.toISOString()
    };
}
