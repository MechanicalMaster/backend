// SECURITY: All queries in this service MUST be scoped by shopId

import { getDatabase } from '../db/init.js';
import { generateUUID } from '../utils/uuid.js';

/**
 * Log an action to audit trail
 * 
 * @param {string} shopId - Shop UUID
 * @param {string} entityType - Type of entity (e.g., 'invoice', 'customer')
 * @param {string} entityId - ID of the entity
 * @param {string} action - Action performed (e.g., 'CREATE', 'UPDATE', 'DELETE')
 * @param {*} details - Additional details (will be JSON stringified)
 * @param {string} actorUserId - Optional user who performed the action (from req.user.userId)
 */
export function logAction(shopId, entityType, entityId, action, details = null, actorUserId = null) {
  const db = getDatabase();

  // If no actor provided, use a placeholder (should be improved in routes)
  const actor = actorUserId || 'system';

  const stmt = db.prepare(`
    INSERT INTO audit_logs (id, shop_id, actor_user_id, entity_type, entity_id, action, details, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    generateUUID(),
    shopId,
    actor,
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
 * @param {string} shopId - Shop UUID
 * @param {string} entityType - Type of entity
 * @param {string} entityId - ID of the entity
 * @returns {Array} Array of audit log entries
 */
export function getEntityLogs(shopId, entityType, entityId) {
  const db = getDatabase();

  const stmt = db.prepare(`
    SELECT * FROM audit_logs
    WHERE shop_id = ? AND entity_type = ? AND entity_id = ?
    ORDER BY created_at DESC
  `);

  const rows = stmt.all(shopId, entityType, entityId);

  return rows.map(row => ({
    ...row,
    details: row.details ? JSON.parse(row.details) : null
  }));
}

/**
 * Get recent audit logs for a shop
 * 
 * @param {string} shopId - Shop UUID
 * @param {number} limit - Number of logs to retrieve
 * @returns {Array} Array of recent audit log entries
 */
export function getRecentLogs(shopId, limit = 100) {
  const db = getDatabase();

  const stmt = db.prepare(`
    SELECT * FROM audit_logs
    WHERE shop_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `);

  const rows = stmt.all(shopId, limit);

  return rows.map(row => ({
    ...row,
    details: row.details ? JSON.parse(row.details) : null
  }));
}
