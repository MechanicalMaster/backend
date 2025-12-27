import { getDatabase } from '../db/init.js';
import { generateUUID } from '../utils/uuid.js';

/**
 * Log user login (start attendance)
 */
export function logLogin(userId) {
    const db = getDatabase();
    const logId = generateUUID();
    const now = new Date();
    const loginDate = now.toISOString().split('T')[0];
    const loginAt = now.toISOString();

    db.prepare(`
    INSERT INTO attendance_logs (id, user_id, login_date, login_at, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(logId, userId, loginDate, loginAt, loginAt);

    return { id: logId, userId, loginDate, loginAt };
}

/**
 * Log user logout (end attendance)
 */
export function logLogout(logId) {
    const db = getDatabase();
    const logoutAt = new Date().toISOString();

    const result = db.prepare(
        'UPDATE attendance_logs SET logout_at = ? WHERE id = ? AND logout_at IS NULL'
    ).run(logoutAt, logId);

    if (result.changes === 0) throw new Error('Attendance log not found or already logged out');
    return { logId, logoutAt };
}

/**
 * Get attendance for a user on a specific date
 */
export function getAttendanceByDate(userId, date) {
    const db = getDatabase();
    return db.prepare(
        'SELECT * FROM attendance_logs WHERE user_id = ? AND login_date = ? ORDER BY login_at'
    ).all(userId, date);
}

/**
 * Get attendance history for a user
 */
export function getAttendanceHistory(userId, limit = 30) {
    const db = getDatabase();
    return db.prepare(
        'SELECT * FROM attendance_logs WHERE user_id = ? ORDER BY login_date DESC, login_at DESC LIMIT ?'
    ).all(userId, limit);
}

/**
 * Get all attendance for a date (admin view)
 */
export function getAllAttendanceByDate(date) {
    const db = getDatabase();
    return db.prepare(`
    SELECT al.*, u.username FROM attendance_logs al
    LEFT JOIN users u ON al.user_id = u.id
    WHERE al.login_date = ? ORDER BY al.login_at
  `).all(date);
}
