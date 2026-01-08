// SECURITY: All queries in this service MUST be scoped by shopId

import { getDatabase } from '../db/init.js';
import { generateUUID } from '../utils/uuid.js';
import { createChildLogger } from '../utils/logger.js';

const shopLogger = createChildLogger('shop');

/**
 * Create a new shop
 * @param {string} name - Shop name
 * @param {Object} businessInfo - Optional business header info
 * @returns {Object} Created shop
 */
export function createShop(name, businessInfo = {}) {
    const db = getDatabase();
    const shopId = generateUUID();
    const now = new Date().toISOString();

    db.prepare(`
        INSERT INTO shops (id, name, created_at, address_json, phone, gstin, terms_conditions, jurisdiction_city)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        shopId,
        name,
        now,
        businessInfo.address ? JSON.stringify(businessInfo.address) : null,
        businessInfo.phone || null,
        businessInfo.gstin || null,
        businessInfo.termsConditions || null,
        businessInfo.jurisdictionCity || null
    );

    // Initialize sequences for the new shop
    initializeShopSequences(shopId);

    shopLogger.info({ shopId, name }, 'Shop created');

    return getShop(shopId);
}

/**
 * Initialize default sequences for a shop
 * @param {string} shopId - Shop UUID
 */
export function initializeShopSequences(shopId) {
    const db = getDatabase();
    const sequences = [
        { key: 'invoice_seq', value: 1 },
        { key: 'purchase_seq', value: 1 },
        { key: 'payment_seq', value: 1 }
    ];

    const insertStmt = db.prepare(`
        INSERT OR IGNORE INTO sequences (shop_id, key, value) VALUES (?, ?, ?)
    `);

    sequences.forEach(seq => {
        insertStmt.run(shopId, seq.key, seq.value);
    });

    shopLogger.debug({ shopId }, 'Initialized shop sequences');
}

/**
 * Get a shop by ID with parsed business info
 * @param {string} shopId - Shop UUID
 * @returns {Object|null} Shop with business header info or null
 */
export function getShop(shopId) {
    const db = getDatabase();
    const shop = db.prepare('SELECT * FROM shops WHERE id = ?').get(shopId);

    if (!shop) return null;

    return {
        id: shop.id,
        name: shop.name,
        createdAt: shop.created_at,
        address: shop.address_json ? JSON.parse(shop.address_json) : null,
        phone: shop.phone,
        gstin: shop.gstin,
        termsConditions: shop.terms_conditions,
        jurisdictionCity: shop.jurisdiction_city
    };
}

/**
 * Update shop details including business header info (ADMIN only)
 * @param {string} shopId - Shop UUID
 * @param {Object} data - Update data
 * @returns {Object} Updated shop
 */
export function updateShop(shopId, data) {
    const db = getDatabase();

    const result = db.prepare(`
        UPDATE shops 
        SET name = ?, 
            address_json = ?, 
            phone = ?, 
            gstin = ?, 
            terms_conditions = ?, 
            jurisdiction_city = ?
        WHERE id = ?
    `).run(
        data.name,
        data.address ? JSON.stringify(data.address) : null,
        data.phone || null,
        data.gstin || null,
        data.termsConditions || null,
        data.jurisdictionCity || null,
        shopId
    );

    if (result.changes === 0) {
        throw new Error('Shop not found');
    }

    shopLogger.info({ shopId }, 'Shop updated');

    return getShop(shopId);
}
