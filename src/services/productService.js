// SECURITY: All queries in this service MUST be scoped by shopId

import { getDatabase, transaction } from '../db/init.js';
import { generateUUID } from '../utils/uuid.js';
import { logAction } from './auditService.js';

/**
 * Create a new product
 * @param {string} shopId - Shop UUID
 * @param {Object} data - Product data
 * @param {string} actorUserId - User performing the action
 */
export function createProduct(shopId, data, actorUserId) {
    return transaction((db) => {
        const productId = generateUUID();
        const now = new Date().toISOString();

        db.prepare(`
      INSERT INTO products (
        id, shop_id, type, name, sku, barcode, hsn, category_id, subcategory_id,
        description, selling_price, purchase_price, tax_rate, unit,
        metal_json, gemstone_json, design_json, vendor_ref, procurement_date,
        hallmark_cert, launch_date, show_online, not_for_sale,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
            productId,
            shopId,
            data.type,
            data.name,
            data.sku || null,
            data.barcode || null,
            data.hsn || null,
            data.categoryId || null,
            data.subcategoryId || null,
            data.description || null,
            data.sellingPrice || null,
            data.purchasePrice || null,
            data.taxRate || null,
            data.unit || null,
            data.metal ? JSON.stringify(data.metal) : null,
            data.gemstone ? JSON.stringify(data.gemstone) : null,
            data.design ? JSON.stringify(data.design) : null,
            data.vendorRef || null,
            data.procurementDate || null,
            data.hallmarkCert || null,
            data.launchDate || null,
            data.showOnline ? 1 : 0,
            data.notForSale ? 1 : 0,
            now,
            now
        );

        logAction(shopId, 'product', productId, 'CREATE', { name: data.name }, actorUserId);

        return getProduct(shopId, productId);
    });
}

/**
 * Get a product with images
 * @param {string} shopId - Shop UUID
 * @param {string} productId - Product UUID
 */
export function getProduct(shopId, productId) {
    const db = getDatabase();

    const product = db.prepare(`
    SELECT * FROM products WHERE id = ? AND shop_id = ? AND deleted_at IS NULL
  `).get(productId, shopId);

    if (!product) return null;

    const images = db.prepare(`
    SELECT * FROM product_images WHERE product_id = ? ORDER BY created_at
  `).all(productId);

    return {
        ...product,
        metal: product.metal_json ? JSON.parse(product.metal_json) : null,
        gemstone: product.gemstone_json ? JSON.parse(product.gemstone_json) : null,
        design: product.design_json ? JSON.parse(product.design_json) : null,
        images: images.map(img => ({
            id: img.id,
            url: `/api/photos/${img.id}`,
            createdAt: img.created_at
        }))
    };
}

/**
 * List products with optional filters (includes images)
 * @param {string} shopId - Shop UUID
 * @param {Object} filters - Optional filters
 */
export function listProducts(shopId, filters = {}) {
    const db = getDatabase();

    let query = 'SELECT * FROM products WHERE shop_id = ? AND deleted_at IS NULL';
    const params = [shopId];

    if (filters.type) {
        query += ' AND type = ?';
        params.push(filters.type);
    }

    if (filters.categoryId) {
        query += ' AND category_id = ?';
        params.push(filters.categoryId);
    }

    query += ' ORDER BY name';

    const products = db.prepare(query).all(...params);

    if (products.length === 0) {
        return [];
    }

    // Batch fetch all images for the returned products
    const productIds = products.map(p => p.id);
    const placeholders = productIds.map(() => '?').join(',');
    const allImages = db.prepare(`
        SELECT * FROM product_images 
        WHERE product_id IN (${placeholders}) 
        ORDER BY created_at
    `).all(...productIds);

    // Group images by product_id for efficient lookup
    const imagesByProductId = {};
    for (const img of allImages) {
        if (!imagesByProductId[img.product_id]) {
            imagesByProductId[img.product_id] = [];
        }
        imagesByProductId[img.product_id].push({
            id: img.id,
            url: `/api/photos/${img.id}`,
            createdAt: img.created_at
        });
    }

    return products.map(p => ({
        ...p,
        metal: p.metal_json ? JSON.parse(p.metal_json) : null,
        gemstone: p.gemstone_json ? JSON.parse(p.gemstone_json) : null,
        design: p.design_json ? JSON.parse(p.design_json) : null,
        images: imagesByProductId[p.id] || []
    }));
}

/**
 * Update a product
 * @param {string} shopId - Shop UUID
 * @param {string} productId - Product UUID
 * @param {Object} data - Update data
 * @param {string} actorUserId - User performing the action
 */
export function updateProduct(shopId, productId, data, actorUserId) {
    const db = getDatabase();
    const now = new Date().toISOString();

    const result = db.prepare(`
    UPDATE products
    SET type = ?, name = ?, sku = ?, barcode = ?, hsn = ?, category_id = ?, 
        subcategory_id = ?, description = ?, selling_price = ?, purchase_price = ?,
        tax_rate = ?, unit = ?, metal_json = ?, gemstone_json = ?, design_json = ?,
        vendor_ref = ?, procurement_date = ?, hallmark_cert = ?, launch_date = ?,
        show_online = ?, not_for_sale = ?, updated_at = ?
    WHERE id = ? AND shop_id = ? AND deleted_at IS NULL
  `).run(
        data.type,
        data.name,
        data.sku || null,
        data.barcode || null,
        data.hsn || null,
        data.categoryId || null,
        data.subcategoryId || null,
        data.description || null,
        data.sellingPrice || null,
        data.purchasePrice || null,
        data.taxRate || null,
        data.unit || null,
        data.metal ? JSON.stringify(data.metal) : null,
        data.gemstone ? JSON.stringify(data.gemstone) : null,
        data.design ? JSON.stringify(data.design) : null,
        data.vendorRef || null,
        data.procurementDate || null,
        data.hallmarkCert || null,
        data.launchDate || null,
        data.showOnline ? 1 : 0,
        data.notForSale ? 1 : 0,
        now,
        productId,
        shopId
    );

    if (result.changes === 0) {
        throw new Error('Product not found');
    }

    logAction(shopId, 'product', productId, 'UPDATE', null, actorUserId);

    return getProduct(shopId, productId);
}

/**
 * Soft delete a product
 * @param {string} shopId - Shop UUID
 * @param {string} productId - Product UUID
 * @param {string} actorUserId - User performing the action
 */
export function deleteProduct(shopId, productId, actorUserId) {
    const db = getDatabase();

    const result = db.prepare(`
    UPDATE products SET deleted_at = ? WHERE id = ? AND shop_id = ? AND deleted_at IS NULL
  `).run(new Date().toISOString(), productId, shopId);

    if (result.changes === 0) {
        throw new Error('Product not found or already deleted');
    }

    logAction(shopId, 'product', productId, 'DELETE', null, actorUserId);
}

/**
 * Add image to product
 * @param {string} shopId - Shop UUID (for validation)
 * @param {string} productId - Product UUID
 * @param {string} filePath - File path
 * @param {string} checksum - File checksum
 */
export function addProductImage(shopId, productId, filePath, checksum) {
    const db = getDatabase();

    // Verify product belongs to shop
    const product = db.prepare('SELECT id FROM products WHERE id = ? AND shop_id = ?').get(productId, shopId);
    if (!product) {
        throw new Error('Product not found');
    }

    const imageId = generateUUID();
    const now = new Date().toISOString();

    db.prepare(`
    INSERT INTO product_images (id, product_id, file_path, checksum, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(imageId, productId, filePath, checksum, now);

    return { id: imageId, url: `/api/photos/${imageId}`, createdAt: now };
}

/**
 * Delete product image
 * @param {string} shopId - Shop UUID (for validation)
 * @param {string} imageId - Image UUID
 */
export function deleteProductImage(shopId, imageId) {
    const db = getDatabase();

    // Verify image belongs to a product in this shop
    const image = db.prepare(`
        SELECT pi.file_path FROM product_images pi
        JOIN products p ON pi.product_id = p.id
        WHERE pi.id = ? AND p.shop_id = ?
    `).get(imageId, shopId);

    if (!image) {
        throw new Error('Image not found');
    }

    db.prepare('DELETE FROM product_images WHERE id = ?').run(imageId);

    return image.file_path;
}
