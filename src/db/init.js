import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { config } from '../config/index.js';
import { createChildLogger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbLogger = createChildLogger('db');

let db = null;

/**
 * Initialize database connection and schema
 * This function is idempotent - safe to call multiple times
 */
export function initDatabase() {
    if (db) {
        return db;
    }

    dbLogger.info({ path: config.databasePath }, 'Initializing database');

    // Create database connection
    db = new Database(config.databasePath);

    // Apply critical SQLite settings
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
    db.pragma('foreign_keys = ON');

    dbLogger.info('Applied SQLite settings (WAL mode, foreign keys ON)');

    // Read and execute schema
    const schemaPath = join(__dirname, 'schema.sql');
    const schema = readFileSync(schemaPath, 'utf8');

    // Execute entire schema at once (better-sqlite3 handles multiple statements)
    db.exec(schema);

    dbLogger.info('Database schema initialized');

    // Note: Sequences are now per-shop and initialized when a shop is created
    // See shopService.js initializeShopSequences()

    return db;
}

/**
 * Get database instance
 * WARNING: This assumes initDatabase() has been called
 */
export function getDatabase() {
    if (!db) {
        throw new Error('Database not initialized. Call initDatabase() first.');
    }
    return db;
}

/**
 * Close database connection (for graceful shutdown)
 */
export function closeDatabase() {
    if (db) {
        db.close();
        db = null;
        dbLogger.info('Database connection closed');
    }
}

/**
 * Execute a function within a transaction
 * Automatically rolls back on error
 * 
 * @param {Function} fn - Function to execute in transaction
 * @returns {*} Result of the function
 */
export function transaction(fn) {
    const db = getDatabase();

    try {
        db.exec('BEGIN TRANSACTION');
        const result = fn(db);
        db.exec('COMMIT');
        return result;
    } catch (error) {
        db.exec('ROLLBACK');
        throw error;
    }
}
