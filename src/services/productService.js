import { getDatabase, transaction } from '../db/init.js';
import { generateUUID } from '../utils/uuid.js';
import { logAction } from './auditService.js';

/**
 * Create a new product
 */
export function createProduct(data) {
    return transaction((db) => {
        const productId = generateUUID();
        const now = new Date().toISOString();

        db.prepare(`
      INSERT INTO products (
        id, type, name, sku, barcode, hsn, category_id, subcategory_id,
        description, selling_price, purchase_price, tax_rate, unit,
        metal_json, gemstone_json, design_json, vendor_ref, procurement_date,
        hallmark_cert, launch_date, show_online, not_for_sale,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
            productId,
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

        logAction('product', productId, 'CREATE', { name: data.name });

        return getProduct(productId);
    });
}

/**
 * Get a product with images
 */
export function getProduct(productId) {
    const db = getDatabase();

    const product = db.prepare(`
    SELECT * FROM products WHERE id = ? AND deleted_at IS NULL
  `).get(productId);

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
 * List products with optional filters
 */
export function listProducts(filters = {}) {
    const db = getDatabase();

    let query = 'SELECT * FROM products WHERE deleted_at IS NULL';
    const params = [];

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

    return products.map(p => ({
        ...p,
        metal: p.metal_json ? JSON.parse(p.metal_json) : null,
        gemstone: p.gemstone_json ? JSON.parse(p.gemstone_json) : null,
        design: p.design_json ? JSON.parse(p.design_json) : null
    }));
}

/**
 * Update a product
 */
export function updateProduct(productId, data) {
    const db = getDatabase();
    const now = new Date().toISOString();

    const result = db.prepare(`
    UPDATE products
    SET type = ?, name = ?, sku = ?, barcode = ?, hsn = ?, category_id = ?, 
        subcategory_id = ?, description = ?, selling_price = ?, purchase_price = ?,
        tax_rate = ?, unit = ?, metal_json = ?, gemstone_json = ?, design_json = ?,
        vendor_ref = ?, procurement_date = ?, hallmark_cert = ?, launch_date = ?,
        show_online = ?, not_for_sale = ?, updated_at = ?
    WHERE id = ? AND deleted_at IS NULL
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
        productId
    );

    if (result.changes === 0) {
        throw new Error('Product not found');
    }

    logAction('product', productId, 'UPDATE');

    return getProduct(productId);
}

/**
 * Soft delete a product
 */
export function deleteProduct(productId) {
    const db = getDatabase();

    const result = db.prepare(`
    UPDATE products SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL
  `).run(new Date().toISOString(), productId);

    if (result.changes === 0) {
        throw new Error('Product not found or already deleted');
    }

    logAction('product', productId, 'DELETE');
}

/**
 * Add image to product
 */
export function addProductImage(productId, filePath, checksum) {
    const db = getDatabase();
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
 */
export function deleteProductImage(imageId) {
    const db = getDatabase();

    const image = db.prepare('SELECT file_path FROM product_images WHERE id = ?').get(imageId);

    if (!image) {
        throw new Error('Image not found');
    }

    db.prepare('DELETE FROM product_images WHERE id = ?').run(imageId);

    return image.file_path;
}
