import { getDatabase } from '../db/init.js';
import { generateUUID } from '../utils/uuid.js';

/**
 * Log an action to audit trail
 * 
 * @param {string} entityType - Type of entity (e.g., 'invoice', 'customer')
 * @param {string} entityId - ID of the entity
 * @param {string} action - Action performed (e.g., 'CREATE', 'UPDATE', 'DELETE')
 * @param {*} details - Additional details (will be JSON stringified)
 */
export function logAction(entityType, entityId, action, details = null) {
    const db = getDatabase();

    const stmt = db.prepare(`
    INSERT INTO audit_logs (id, entity_type, entity_id, action, details, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

    stmt.run(
        generateUUID(),
        entityType,
        entityId,
        action,
        details ? JSON.stringify(details) : null,
        new Date().toISOString()
    );
}

/**
 * Get audit logs for a specific entity
 * 
 * @param {string} entityType - Type of entity
 * @param {string} entityId - ID of the entity
 * @returns {Array} Array of audit log entries
 */
export function getEntityLogs(entityType, entityId) {
    const db = getDatabase();

    const stmt = db.prepare(`
    SELECT * FROM audit_logs
    WHERE entity_type = ? AND entity_id = ?
    ORDER BY created_at DESC
  `);

    const rows = stmt.all(entityType, entityId);

    return rows.map(row => ({
        ...row,
        details: row.details ? JSON.parse(row.details) : null
    }));
}

/**
 * Get recent audit logs
 * 
 * @param {number} limit - Number of logs to retrieve
 * @returns {Array} Array of recent audit log entries
 */
export function getRecentLogs(limit = 100) {
    const db = getDatabase();

    const stmt = db.prepare(`
    SELECT * FROM audit_logs
    ORDER BY created_at DESC
    LIMIT ?
  `);

    const rows = stmt.all(limit);

    return rows.map(row => ({
        ...row,
        details: row.details ? JSON.parse(row.details) : null
    }));
}
