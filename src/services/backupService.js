/**
 * Backup Service
 * Creates SQLite database backups using better-sqlite3's backup method
 */

import { getDatabase } from '../db/init.js';
import { existsSync, mkdirSync, readdirSync, statSync, createWriteStream } from 'fs';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';
import { createChildLogger } from '../utils/logger.js';
import archiver from 'archiver';
import { config } from '../config/index.js';

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

/**
 * In-memory mutex flag to prevent concurrent backups
 */
let isBackupRunning = false;

/**
 * Validate backup filename to prevent path traversal attacks
 * @param {string} filename - Filename to validate
 * @returns {boolean} True if valid, false otherwise
 */
export function validateBackupFilename(filename) {
    // Must be a ZIP file
    if (!filename.endsWith('.zip')) return false;

    // Must match the expected pattern: swipe_backup_<timestamp>.zip
    const pattern = /^swipe_backup_[\d-TZ]+\.zip$/;
    if (!pattern.test(filename)) return false;

    // No path traversal characters
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
        return false;
    }

    return true;
}

/**
 * Get the full path for a backup file (safely)
 * @param {string} filename - Validated backup filename
 * @returns {string} Full path to backup file
 */
export function getBackupPath(filename) {
    return join(BACKUP_DIR, filename);
}

/**
 * Create a full backup (SQLite DB + file storage) as a ZIP file
 * @returns {Promise<Object>} Backup metadata (filename, sizeBytes, createdAt)
 */
export async function createFullBackup() {
    // Check mutex - prevent concurrent backups
    if (isBackupRunning) {
        const error = new Error('Backup already in progress');
        error.statusCode = 409;
        throw error;
    }

    ensureBackupDir();

    try {
        // Set mutex flag
        isBackupRunning = true;

        const db = getDatabase();
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const tempDbFilename = `swipe_temp_${timestamp}.db`;
        const zipFilename = `swipe_backup_${timestamp}.zip`;
        const tempDbPath = join(BACKUP_DIR, tempDbFilename);
        const zipPath = join(BACKUP_DIR, zipFilename);

        backupLogger.info({ zipPath }, 'Starting full backup (DB + storage)');

        // Step 1: Create WAL-safe SQLite backup using better-sqlite3's backup method
        backupLogger.info({ tempDbPath }, 'Creating SQLite backup');
        await db.backup(tempDbPath);
        backupLogger.info('SQLite backup completed');

        // Step 2: Create ZIP archive with streaming
        backupLogger.info({ zipPath }, 'Creating ZIP archive');

        const output = createWriteStream(zipPath);
        const archive = archiver('zip', {
            zlib: { level: 6 } // Balanced compression
        });

        // Promise to handle ZIP creation
        const zipPromise = new Promise((resolve, reject) => {
            output.on('close', () => {
                backupLogger.info({
                    zipPath,
                    totalBytes: archive.pointer()
                }, 'ZIP archive created successfully');
                resolve();
            });

            archive.on('error', (err) => {
                backupLogger.error({ err, zipPath }, 'ZIP archive creation failed');
                reject(err);
            });

            archive.on('warning', (err) => {
                if (err.code === 'ENOENT') {
                    backupLogger.warn({ err }, 'ZIP archive warning');
                } else {
                    reject(err);
                }
            });
        });

        // Pipe archive to output file
        archive.pipe(output);

        // Add the SQLite database backup to ZIP
        archive.file(tempDbPath, { name: 'swipe.db' });

        // Add storage directory (photos) to ZIP
        const storagePath = config.storagePath;
        if (existsSync(storagePath)) {
            backupLogger.info({ storagePath }, 'Adding storage directory to ZIP');
            archive.directory(storagePath, 'storage/photos');
        } else {
            backupLogger.warn({ storagePath }, 'Storage directory does not exist, skipping');
        }

        // Finalize the archive
        await archive.finalize();

        // Wait for ZIP to complete
        await zipPromise;

        // Get final ZIP file size
        const stats = statSync(zipPath);

        // Clean up temporary DB file
        const fs = await import('fs/promises');
        await fs.unlink(tempDbPath);
        backupLogger.info({ tempDbPath }, 'Cleaned up temporary DB file');

        const metadata = {
            filename: zipFilename,
            sizeBytes: stats.size,
            createdAt: new Date().toISOString()
        };

        backupLogger.info(metadata, 'Full backup completed successfully');
        return metadata;

    } catch (error) {
        backupLogger.error({ err: error }, 'Full backup failed');
        throw error;
    } finally {
        // Always reset mutex flag
        isBackupRunning = false;
    }
}
