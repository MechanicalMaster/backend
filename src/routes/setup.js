// SECURITY: Bootstrap endpoint for initial shop creation
// This endpoint should only be used once during initial setup

import express from 'express';
import { getDatabase, transaction } from '../db/init.js';
import { generateUUID } from '../utils/uuid.js';
import { config } from '../config/index.js';
import { createChildLogger } from '../utils/logger.js';

const setupLogger = createChildLogger('setup');
const router = express.Router();

/**
 * POST /api/setup/bootstrap
 * Create the first shop and admin user
 * 
 * Requires: setupSecret matching SETUP_SECRET env var
 * Can only run once (if shop exists, requires valid secret to proceed)
 */
router.post('/bootstrap', (req, res, next) => {
    try {
        const { shopName, adminPhone, setupSecret } = req.body;

        // Validate required fields
        if (!shopName || !adminPhone || !setupSecret) {
            return res.status(400).json({
                error: 'Missing required fields: shopName, adminPhone, setupSecret',
                requestId: req.requestId
            });
        }

        const db = getDatabase();

        // Check if any shop already exists
        const existingShop = db.prepare('SELECT id FROM shops LIMIT 1').get();

        if (existingShop) {
            // Shop exists - validate secret for re-bootstrap
            if (setupSecret !== config.setupSecret) {
                return res.status(403).json({
                    error: 'Shop already exists. Invalid setup secret.',
                    requestId: req.requestId
                });
            }
            // With valid secret, allow re-bootstrap (for dev/testing)
            setupLogger.warn('Re-bootstrap attempted with valid secret');
        }

        // Validate setup secret
        if (setupSecret !== config.setupSecret) {
            return res.status(403).json({
                error: 'Invalid setup secret',
                requestId: req.requestId
            });
        }

        // Check if phone already registered
        const existingUser = db.prepare('SELECT id FROM users WHERE phone = ?').get(adminPhone);
        if (existingUser) {
            return res.status(409).json({
                error: 'Phone number already registered',
                requestId: req.requestId
            });
        }

        // Transactional shop + user creation
        const result = transaction((db) => {
            const shopId = generateUUID();
            const userId = generateUUID();
            const now = new Date().toISOString();

            // Create shop
            db.prepare(`
                INSERT INTO shops (id, name, created_at)
                VALUES (?, ?, ?)
            `).run(shopId, shopName, now);

            // Initialize sequences for the new shop
            const sequences = [
                { key: 'invoice_seq', value: 1 },
                { key: 'purchase_seq', value: 1 },
                { key: 'payment_seq', value: 1 }
            ];
            const insertSeq = db.prepare(`
                INSERT OR IGNORE INTO sequences (shop_id, key, value) VALUES (?, ?, ?)
            `);
            sequences.forEach(seq => {
                insertSeq.run(shopId, seq.key, seq.value);
            });

            // Create admin user
            db.prepare(`
                INSERT INTO users (id, shop_id, phone, name, role, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
            `).run(userId, shopId, adminPhone, 'Admin', 'ADMIN', now);

            setupLogger.info({ shopId, userId, shopName, adminPhone }, 'Shop bootstrapped successfully');

            return {
                shop: { id: shopId, name: shopName },
                user: { id: userId, phone: adminPhone, role: 'ADMIN' }
            };
        });

        res.status(201).json({
            success: true,
            message: 'Shop bootstrapped successfully',
            ...result
        });

    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/setup/status
 * Check if setup has been completed (any shop exists)
 */
router.get('/status', (req, res, next) => {
    try {
        const db = getDatabase();
        const shop = db.prepare('SELECT id, name FROM shops LIMIT 1').get();

        res.json({
            setupComplete: !!shop,
            shop: shop ? { id: shop.id, name: shop.name } : null
        });
    } catch (error) {
        next(error);
    }
});

export default router;
