// SECURITY: All queries in this service MUST be scoped by shopId

import { getDatabase } from '../db/init.js';
import { generateUUID } from '../utils/uuid.js';

/**
 * Log an action to audit trail
 * 
 * @param {string} shopId - Shop UUID (required)
 * @param {string} entityType - Type of entity (required)
 * @param {string} entityId - ID of the entity (required)
 * @param {string} action - Action performed (required)
 * @param {*} details - Additional details (optional)
 * @param {string} actorUserId - User who performed the action (REQUIRED)
 */
export function logAction(shopId, entityType, entityId, action, details = null, actorUserId) {
  const db = getDatabase();

  if (!actorUserId) {
    throw new Error('actorUserId is required for audit logging');
  }

  const stmt = db.prepare(`
    INSERT INTO audit_logs (id, shop_id, actor_user_id, entity_type, entity_id, action, details, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    generateUUID(),
    shopId,
    actorUserId,
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
