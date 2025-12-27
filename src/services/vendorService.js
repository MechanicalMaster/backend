import { getDatabase } from '../db/init.js';
import { generateUUID } from '../utils/uuid.js';
import { logAction } from './auditService.js';

/**
 * Create a new vendor
 */
export function createVendor(data) {
    const db = getDatabase();
    const vendorId = generateUUID();
    const now = new Date().toISOString();

    db.prepare(`
    INSERT INTO vendors (id, name, gstin, phone, email, balance, address_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
        vendorId,
        data.name,
        data.gstin || null,
        data.phone || null,
        data.email || null,
        0,
        data.address ? JSON.stringify(data.address) : null,
        now,
        now
    );

    logAction('vendor', vendorId, 'CREATE', { name: data.name });
    return getVendor(vendorId);
}

/**
 * Get a single vendor
 */
export function getVendor(vendorId) {
    const db = getDatabase();
    const vendor = db.prepare(
        'SELECT * FROM vendors WHERE id = ? AND deleted_at IS NULL'
    ).get(vendorId);

    if (!vendor) return null;
    return { ...vendor, address: vendor.address_json ? JSON.parse(vendor.address_json) : null };
}

/**
 * List all vendors
 */
export function listVendors() {
    const db = getDatabase();
    const vendors = db.prepare(
        'SELECT * FROM vendors WHERE deleted_at IS NULL ORDER BY name'
    ).all();

    return vendors.map(v => ({
        ...v,
        address: v.address_json ? JSON.parse(v.address_json) : null
    }));
}

/**
 * Update a vendor
 */
export function updateVendor(vendorId, data) {
    const db = getDatabase();
    const now = new Date().toISOString();

    const result = db.prepare(`
    UPDATE vendors SET name = ?, gstin = ?, phone = ?, email = ?, address_json = ?, updated_at = ?
    WHERE id = ? AND deleted_at IS NULL
  `).run(
        data.name,
        data.gstin || null,
        data.phone || null,
        data.email || null,
        data.address ? JSON.stringify(data.address) : null,
        now,
        vendorId
    );

    if (result.changes === 0) throw new Error('Vendor not found');
    logAction('vendor', vendorId, 'UPDATE');
    return getVendor(vendorId);
}

/**
 * Soft delete a vendor
 */
export function deleteVendor(vendorId) {
    const db = getDatabase();
    const result = db.prepare(
        'UPDATE vendors SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL'
    ).run(new Date().toISOString(), vendorId);

    if (result.changes === 0) throw new Error('Vendor not found or already deleted');
    logAction('vendor', vendorId, 'DELETE');
}

/**
 * Recalculate vendor balance from purchases and payments
 */
export function updateVendorBalance(vendorId) {
    const db = getDatabase();

    // TODO: Sum from purchases table when purchase items are implemented
    const payments = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total FROM payments
    WHERE party_id = ? AND party_type = 'VENDOR'
  `).get(vendorId);

    const balance = -payments.total; // Negative means we owe them
    db.prepare('UPDATE vendors SET balance = ? WHERE id = ?').run(balance, vendorId);
    return balance;
}
