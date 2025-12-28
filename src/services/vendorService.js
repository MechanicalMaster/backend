// SECURITY: All queries in this service MUST be scoped by shopId

import { getDatabase } from '../db/init.js';
import { generateUUID } from '../utils/uuid.js';
import { recalculateBalance } from '../utils/calculator.js';
import { logAction } from './auditService.js';

/**
 * Create a new vendor
 * @param {string} shopId - Shop UUID
 * @param {Object} data - Vendor data
 * @param {string} actorUserId - User performing the action
 */
export function createVendor(shopId, data, actorUserId) {
  const db = getDatabase();
  const vendorId = generateUUID();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO vendors (id, shop_id, name, gstin, phone, email, balance, address_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    vendorId,
    shopId,
    data.name,
    data.gstin || null,
    data.phone || null,
    data.email || null,
    0,
    data.address ? JSON.stringify(data.address) : null,
    now,
    now
  );

  logAction(shopId, 'vendor', vendorId, 'CREATE', { name: data.name }, actorUserId);

  return getVendor(shopId, vendorId);
}

/**
 * Get a single vendor
 * @param {string} shopId - Shop UUID
 * @param {string} vendorId - Vendor UUID
 */
export function getVendor(shopId, vendorId) {
  const db = getDatabase();
  const vendor = db.prepare(`
    SELECT * FROM vendors WHERE id = ? AND shop_id = ? AND deleted_at IS NULL
  `).get(vendorId, shopId);

  if (!vendor) return null;

  return {
    ...vendor,
    address: vendor.address_json ? JSON.parse(vendor.address_json) : null
  };
}

/**
 * List all vendors for a shop
 * @param {string} shopId - Shop UUID
 */
export function listVendors(shopId) {
  const db = getDatabase();
  const vendors = db.prepare(`
    SELECT * FROM vendors WHERE shop_id = ? AND deleted_at IS NULL ORDER BY name
  `).all(shopId);

  return vendors.map(v => ({
    ...v,
    address: v.address_json ? JSON.parse(v.address_json) : null
  }));
}

/**
 * Update a vendor
 * @param {string} shopId - Shop UUID
 * @param {string} vendorId - Vendor UUID
 * @param {Object} data - Update data
 * @param {string} actorUserId - User performing the action
 */
export function updateVendor(shopId, vendorId, data, actorUserId) {
  const db = getDatabase();
  const now = new Date().toISOString();

  const result = db.prepare(`
    UPDATE vendors
    SET name = ?, gstin = ?, phone = ?, email = ?, address_json = ?, updated_at = ?
    WHERE id = ? AND shop_id = ? AND deleted_at IS NULL
  `).run(
    data.name,
    data.gstin || null,
    data.phone || null,
    data.email || null,
    data.address ? JSON.stringify(data.address) : null,
    now,
    vendorId,
    shopId
  );

  if (result.changes === 0) throw new Error('Vendor not found');

  logAction(shopId, 'vendor', vendorId, 'UPDATE', null, actorUserId);

  return getVendor(shopId, vendorId);
}

/**
 * Soft delete a vendor
 * @param {string} shopId - Shop UUID
 * @param {string} vendorId - Vendor UUID
 * @param {string} actorUserId - User performing the action
 */
export function deleteVendor(shopId, vendorId, actorUserId) {
  const db = getDatabase();
  const result = db.prepare(`
    UPDATE vendors SET deleted_at = ? WHERE id = ? AND shop_id = ? AND deleted_at IS NULL
  `).run(new Date().toISOString(), vendorId, shopId);

  if (result.changes === 0) throw new Error('Vendor not found or already deleted');

  logAction(shopId, 'vendor', vendorId, 'DELETE', null, actorUserId);
}

/**
 * Update vendor balance (derived from purchases and payments)
 * @param {string} shopId - Shop UUID
 * @param {string} vendorId - Vendor UUID
 */
export function updateVendorBalance(shopId, vendorId) {
  const db = getDatabase();

  const balance = recalculateBalance(db, vendorId, 'VENDOR');

  db.prepare(`
    UPDATE vendors SET balance = ? WHERE id = ? AND shop_id = ?
  `).run(balance, vendorId, shopId);

  return balance;
}
