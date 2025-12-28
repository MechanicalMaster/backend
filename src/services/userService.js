// SECURITY: All queries in this service MUST be scoped by shopId

import { getDatabase, transaction } from '../db/init.js';
import { generateUUID } from '../utils/uuid.js';
import { createShop, getShop, initializeShopSequences } from './shopService.js';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { createChildLogger } from '../utils/logger.js';

const userLogger = createChildLogger('user');

// Static OTP for local development
const DEV_OTP = '111111';

/**
 * Request OTP for phone number
 * NOTE: Does NOT create users. Use /api/setup/bootstrap for initial setup.
 */
export function requestOTP(phone) {
    const db = getDatabase();

    // Check if user exists
    let user = db.prepare('SELECT * FROM users WHERE phone = ? AND deleted_at IS NULL').get(phone);

    if (!user) {
        userLogger.debug({ phone }, 'Phone number not registered');
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
 * NOTE: Does NOT auto-create shops. Use /api/setup/bootstrap for initial setup.
 */
export function verifyOTP(phone, otp) {
    const db = getDatabase();

    // Verify OTP (static for dev)
    if (otp !== DEV_OTP) {
        throw { statusCode: 401, message: 'Invalid OTP' };
    }

    // Find user by phone
    let user = db.prepare('SELECT * FROM users WHERE phone = ? AND deleted_at IS NULL').get(phone);

    if (!user) {
        // User not registered - do NOT auto-create
        throw {
            statusCode: 403,
            message: 'User not registered. Contact your shop admin to get access.'
        };
    }

    // Generate JWT token with shopId and role
    const token = jwt.sign(
        {
            userId: user.id,
            shopId: user.shop_id,
            role: user.role
        },
        config.jwtSecret,
        { expiresIn: '30d' }
    );

    return {
        token,
        user: {
            id: user.id,
            phone: user.phone,
            name: user.name,
            role: user.role,
            shopId: user.shop_id
        }
    };
}

/**
 * Get user by ID with shop info
 * Used for /api/auth/me endpoint
 */
export function getUser(userId) {
    const db = getDatabase();

    const user = db.prepare(`
        SELECT u.id, u.phone, u.name, u.role, u.shop_id, u.created_at,
               s.id as shop_id, s.name as shop_name
        FROM users u
        JOIN shops s ON u.shop_id = s.id
        WHERE u.id = ? AND u.deleted_at IS NULL
    `).get(userId);

    if (!user) return null;

    return {
        id: user.id,
        phone: user.phone,
        name: user.name,
        role: user.role,
        created_at: user.created_at,
        shop: {
            id: user.shop_id,
            name: user.shop_name
        }
    };
}

/**
 * List all users in a shop (admin only)
 */
export function listUsers(shopId) {
    const db = getDatabase();
    return db.prepare(`
        SELECT id, phone, name, role, created_at 
        FROM users 
        WHERE shop_id = ? AND deleted_at IS NULL
        ORDER BY created_at DESC
    `).all(shopId);
}

/**
 * Create a user in a shop (for adding SALES users)
 * Only ADMIN can do this
 */
export function createUser(shopId, data) {
    const db = getDatabase();
    const userId = generateUUID();
    const now = new Date().toISOString();

    // Check if phone already exists
    const existing = db.prepare('SELECT id FROM users WHERE phone = ?').get(data.phone);
    if (existing) {
        throw { statusCode: 400, message: 'Phone number already registered' };
    }

    db.prepare(`
        INSERT INTO users (id, shop_id, phone, name, role, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
    `).run(userId, shopId, data.phone, data.name || null, data.role || 'SALES', now);

    userLogger.info({ userId, shopId, phone: data.phone, role: data.role }, 'Created new user');

    return getUser(userId);
}
