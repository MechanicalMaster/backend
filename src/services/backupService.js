/**
 * Backup Service
 * Creates SQLite database backups using better-sqlite3's backup method
 */

import { getDatabase } from '../db/init.js';
import { existsSync, mkdirSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createChildLogger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const backupLogger = createChildLogger('backup');
const BACKUP_DIR = join(__dirname, '../../storage/backups');

/**
 * Ensure backup directory exists
 */
function ensureBackupDir() {
    if (!existsSync(BACKUP_DIR)) {
        mkdirSync(BACKUP_DIR, { recursive: true });
        backupLogger.info({ path: BACKUP_DIR }, 'Created backup directory');
    }
}

/**
 * Create a database backup
 * @returns {Object} Backup metadata (path, timestamp, size)
 */
export function createBackup() {
    ensureBackupDir();

    const db = getDatabase();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `swipe_${timestamp}.db`;
    const backupPath = join(BACKUP_DIR, filename);

    backupLogger.info({ backupPath }, 'Starting database backup');

    // Use better-sqlite3's backup method (synchronous, safe)
    db.backup(backupPath)
        .then(() => {
            backupLogger.info({ backupPath }, 'Backup completed successfully');
        })
        .catch((err) => {
            backupLogger.error({ err, backupPath }, 'Backup failed');
            throw err;
        });

    // Get file size after backup
    const stats = statSync(backupPath);

    return {
        path: backupPath,
        filename,
        timestamp: new Date().toISOString(),
        sizeBytes: stats.size
    };
}

/**
 * List existing backups
 * @returns {Array} List of backup metadata
 */
export function listBackups() {
    ensureBackupDir();

    const files = readdirSync(BACKUP_DIR)
        .filter(f => f.endsWith('.db'))
        .map(filename => {
            const filePath = join(BACKUP_DIR, filename);
            const stats = statSync(filePath);
            return {
                filename,
                path: filePath,
                createdAt: stats.mtime.toISOString(),
                sizeBytes: stats.size
            };
        })
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return files;
}
