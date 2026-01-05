/**
 * Backup Service
 * Creates SQLite database backups using better-sqlite3's backup method
 * Supports restore from backup with strict validation
 */

import { getDatabase, closeDatabase } from '../db/init.js';
import { existsSync, mkdirSync, readdirSync, statSync, createWriteStream, createReadStream, rmSync, copyFileSync, readFileSync } from 'fs';
import { mkdir, rm, readdir, copyFile } from 'fs/promises';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';
import { createChildLogger } from '../utils/logger.js';
import archiver from 'archiver';
import unzipper from 'unzipper';
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
 * In-memory mutex flags to prevent concurrent operations
 */
let isBackupRunning = false;
let isRestoreRunning = false;

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

/**
 * SQLite file signature (first 16 bytes)
 */
const SQLITE_HEADER = Buffer.from('SQLite format 3\0');

/**
 * Validate that a file is a valid SQLite database
 * @param {string} filePath - Path to the database file
 * @returns {boolean} True if valid SQLite file
 */
function validateSQLiteFile(filePath) {
    try {
        const header = readFileSync(filePath, { encoding: null }).slice(0, 16);
        return header.equals(SQLITE_HEADER);
    } catch {
        return false;
    }
}

/**
 * Validate a ZIP entry path for security
 * @param {string} entryPath - Path from ZIP entry
 * @returns {boolean} True if path is safe
 */
function isPathSafe(entryPath) {
    // Reject absolute paths
    if (entryPath.startsWith('/') || entryPath.startsWith('\\')) {
        return false;
    }
    // Reject path traversal
    if (entryPath.includes('..')) {
        return false;
    }
    // Reject backslash (Windows path separator could be sneaky)
    if (entryPath.includes('\\')) {
        return false;
    }
    return true;
}

/**
 * Restore from a backup ZIP file
 * WARNING: This will replace all current data and terminate the process
 * 
 * @param {string} zipPath - Path to the uploaded ZIP file
 * @param {Object} auditContext - Context for audit logging { shopId, userId }
 * @returns {Promise<Object>} Restore metadata
 */
export async function restoreFromBackup(zipPath, auditContext) {
    // Check mutex - prevent concurrent restores
    if (isRestoreRunning) {
        const error = new Error('Restore already in progress');
        error.statusCode = 409;
        throw error;
    }

    // Also prevent restore while backup is running
    if (isBackupRunning) {
        const error = new Error('Cannot restore while backup is in progress');
        error.statusCode = 409;
        throw error;
    }

    ensureBackupDir();

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const tempDir = join(BACKUP_DIR, `restore_temp_${timestamp}`);

    try {
        isRestoreRunning = true;

        backupLogger.info({ zipPath }, 'Starting restore from backup');

        // Step 1: Create temp extraction directory
        await mkdir(tempDir, { recursive: true });
        backupLogger.info({ tempDir }, 'Created temp extraction directory');

        // Step 2: Extract and validate ZIP contents
        let hasSwipeDb = false;
        let hasStorageDir = false;
        const extractedPhotos = [];

        await new Promise((resolve, reject) => {
            createReadStream(zipPath)
                .pipe(unzipper.Parse())
                .on('entry', async (entry) => {
                    const entryPath = entry.path;
                    const type = entry.type; // 'Directory' or 'File'

                    // Security: Validate path
                    if (!isPathSafe(entryPath)) {
                        backupLogger.error({ entryPath }, 'Unsafe path in ZIP, aborting');
                        entry.autodrain();
                        reject(new Error(`Unsafe path in backup: ${entryPath}`));
                        return;
                    }

                    // Check for swipe.db at root
                    if (entryPath === 'swipe.db' && type === 'File') {
                        hasSwipeDb = true;
                        const destPath = join(tempDir, 'swipe.db');
                        entry.pipe(createWriteStream(destPath));
                        backupLogger.info('Found swipe.db in backup');
                    }
                    // Check for storage/photos/ directory
                    else if (entryPath.startsWith('storage/photos/') && type === 'File') {
                        hasStorageDir = true;
                        // Extract relative to storage/photos/
                        const relativePath = entryPath.replace('storage/photos/', '');
                        if (relativePath && !relativePath.includes('/')) {
                            // Only extract files directly in photos dir (not nested subdirs)
                            const photosDir = join(tempDir, 'photos');
                            if (!existsSync(photosDir)) {
                                mkdirSync(photosDir, { recursive: true });
                            }
                            const destPath = join(photosDir, relativePath);
                            entry.pipe(createWriteStream(destPath));
                            extractedPhotos.push(relativePath);
                        } else if (relativePath.includes('/')) {
                            // Handle nested paths like storage/photos/uploads/file.jpg
                            const photosDir = join(tempDir, 'photos');
                            const fullPath = join(photosDir, relativePath);
                            const dir = dirname(fullPath);
                            if (!existsSync(dir)) {
                                mkdirSync(dir, { recursive: true });
                            }
                            entry.pipe(createWriteStream(fullPath));
                            extractedPhotos.push(relativePath);
                        } else {
                            entry.autodrain();
                        }
                    }
                    else {
                        entry.autodrain();
                    }
                })
                .on('close', resolve)
                .on('error', reject);
        });

        // Step 3: Validate extracted contents
        if (!hasSwipeDb) {
            const error = new Error('Invalid backup: swipe.db not found at root');
            error.statusCode = 400;
            throw error;
        }

        const extractedDbPath = join(tempDir, 'swipe.db');
        if (!validateSQLiteFile(extractedDbPath)) {
            const error = new Error('Invalid backup: swipe.db is not a valid SQLite database');
            error.statusCode = 400;
            throw error;
        }

        backupLogger.info({
            hasSwipeDb,
            hasStorageDir,
            extractedPhotos: extractedPhotos.length
        }, 'Backup validation passed');

        // Step 4: Create emergency backup of current state
        const emergencyBackupPath = join(BACKUP_DIR, `emergency_pre_restore_${timestamp}.db`);
        const currentDbPath = config.databasePath;

        backupLogger.info({ emergencyBackupPath }, 'Creating emergency backup before restore');

        // Close current database connection
        closeDatabase();

        // Copy current DB to emergency backup
        copyFileSync(currentDbPath, emergencyBackupPath);
        backupLogger.info({ emergencyBackupPath }, 'Emergency backup created');

        // Step 5: Replace swipe.db
        backupLogger.info('Replacing database file');
        copyFileSync(extractedDbPath, currentDbPath);
        backupLogger.info('Database replaced');

        // Step 6: Replace storage/photos/ if present in backup
        const currentPhotosPath = config.storagePath;
        const extractedPhotosPath = join(tempDir, 'photos');

        if (existsSync(extractedPhotosPath)) {
            backupLogger.info({ currentPhotosPath }, 'Replacing photos directory');

            // Remove current photos
            if (existsSync(currentPhotosPath)) {
                rmSync(currentPhotosPath, { recursive: true, force: true });
            }

            // Copy extracted photos
            await copyDirRecursive(extractedPhotosPath, currentPhotosPath);
            backupLogger.info({ photosRestored: extractedPhotos.length }, 'Photos restored');
        }

        // Step 7: Clean up temp directory
        await rm(tempDir, { recursive: true, force: true });
        backupLogger.info({ tempDir }, 'Cleaned up temp directory');

        // Step 8: Log audit event (to file since DB is being replaced)
        backupLogger.info({
            action: 'SYSTEM_RESTORE',
            shopId: auditContext?.shopId,
            userId: auditContext?.userId,
            photosRestored: extractedPhotos.length,
            emergencyBackupPath
        }, 'SYSTEM_RESTORE completed');

        const metadata = {
            success: true,
            restartRequired: true,
            photosRestored: extractedPhotos.length,
            emergencyBackupPath: basename(emergencyBackupPath),
            restoredAt: new Date().toISOString()
        };

        backupLogger.info(metadata, 'Restore completed successfully. Server will exit.');

        // Return metadata before exit (response will be sent by route handler)
        // The route handler will call process.exit(0) after sending response
        return metadata;

    } catch (error) {
        backupLogger.error({ err: error }, 'Restore failed');

        // Clean up temp directory on error
        if (existsSync(tempDir)) {
            try {
                await rm(tempDir, { recursive: true, force: true });
            } catch (cleanupErr) {
                backupLogger.error({ cleanupErr }, 'Failed to clean up temp directory');
            }
        }

        throw error;
    } finally {
        isRestoreRunning = false;
    }
}

/**
 * Recursively copy a directory
 * @param {string} src - Source directory
 * @param {string} dest - Destination directory
 */
async function copyDirRecursive(src, dest) {
    await mkdir(dest, { recursive: true });
    const entries = await readdir(src, { withFileTypes: true });

    for (const entry of entries) {
        const srcPath = join(src, entry.name);
        const destPath = join(dest, entry.name);

        if (entry.isDirectory()) {
            await copyDirRecursive(srcPath, destPath);
        } else {
            await copyFile(srcPath, destPath);
        }
    }
}

