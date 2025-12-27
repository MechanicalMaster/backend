import { getDatabase } from '../db/init.js';
import { generateUUID } from '../utils/uuid.js';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { createChildLogger } from '../utils/logger.js';

const userLogger = createChildLogger('user');

// Static OTP for local development
const DEV_OTP = '111111';

/**
 * Request OTP for phone number
 * Creates user if doesn't exist
 */
export function requestOTP(phone) {
    const db = getDatabase();
    const now = new Date().toISOString();

    // Find or create user by phone
    let user = db.prepare('SELECT * FROM users WHERE username = ?').get(phone);

    if (!user) {
        // Create new user with phone as username
        const userId = generateUUID();
        db.prepare(`
      INSERT INTO users (id, username, password_hash, role, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(userId, phone, '', 'USER', now);

        user = { id: userId, username: phone, role: 'user' };
    }

    // Log OTP generation WITHOUT the actual OTP value (security)
    userLogger.debug({ phone }, 'OTP generated for phone number');

    return {
        success: true,
        message: 'OTP sent successfully',
        phone
    };
}

/**
 * Verify OTP and return JWT
 */
export function verifyOTP(phone, otp) {
    const db = getDatabase();

    // Find user by phone
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(phone);

    if (!user) {
        throw { statusCode: 404, message: 'User not found. Please request OTP first.' };
    }

    // Verify OTP (static for dev)
    if (otp !== DEV_OTP) {
        throw { statusCode: 401, message: 'Invalid OTP' };
    }

    // Generate JWT token
    const token = jwt.sign(
        { userId: user.id, phone: user.username, role: user.role },
        config.jwtSecret,
        { expiresIn: '30d' }
    );

    return {
        token,
        user: {
            id: user.id,
            phone: user.username,
            role: user.role
        }
    };
}

/**
 * Get user by ID
 */
export function getUser(userId) {
    const db = getDatabase();
    const user = db.prepare(
        'SELECT id, username as phone, role, created_at FROM users WHERE id = ?'
    ).get(userId);
    return user || null;
}

/**
 * List all users (admin only)
 */
export function listUsers() {
    const db = getDatabase();
    return db.prepare(
        'SELECT id, username as phone, role, created_at FROM users ORDER BY created_at DESC'
    ).all();
}
