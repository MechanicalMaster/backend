// SECURITY: All queries in this service MUST be scoped by shopId

import { getDatabase } from '../db/init.js';
import { generateUUID } from '../utils/uuid.js';
import { recalculateBalance } from '../utils/calculator.js';
import { logAction } from './auditService.js';

/**
 * Create a new customer
 * @param {string} shopId - Shop UUID
 * @param {Object} data - Customer data
 * @param {string} actorUserId - User performing the action
 */
export function createCustomer(shopId, data, actorUserId) {
  const db = getDatabase();
  const customerId = generateUUID();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO customers (
      id, shop_id, name, gstin, phone, email, balance, address_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    customerId,
    shopId,
    data.name,
    data.gstin || null,
    data.phone || null,
    data.email || null,
    0, // Initial balance
    data.address ? JSON.stringify(data.address) : null,
    now,
    now
  );

  logAction(shopId, 'customer', customerId, 'CREATE', { name: data.name }, actorUserId);

  return getCustomer(shopId, customerId);
}

/**
 * Get a single customer
 * @param {string} shopId - Shop UUID
 * @param {string} customerId - Customer UUID
 */
export function getCustomer(shopId, customerId) {
  const db = getDatabase();

  const customer = db.prepare(`
    SELECT * FROM customers WHERE id = ? AND shop_id = ? AND deleted_at IS NULL
  `).get(customerId, shopId);

  if (!customer) return null;

  return {
    ...customer,
    address: customer.address_json ? JSON.parse(customer.address_json) : null
  };
}

/**
 * List all customers for a shop
 * @param {string} shopId - Shop UUID
 */
export function listCustomers(shopId) {
  const db = getDatabase();

  const customers = db.prepare(`
    SELECT * FROM customers WHERE shop_id = ? AND deleted_at IS NULL ORDER BY name
  `).all(shopId);

  return customers.map(c => ({
    ...c,
    address: c.address_json ? JSON.parse(c.address_json) : null
  }));
}

/**
 * Update a customer
 * @param {string} shopId - Shop UUID
 * @param {string} customerId - Customer UUID
 * @param {Object} data - Update data
 * @param {string} actorUserId - User performing the action
 */
export function updateCustomer(shopId, customerId, data, actorUserId) {
  const db = getDatabase();
  const now = new Date().toISOString();

  const result = db.prepare(`
    UPDATE customers
    SET name = ?, gstin = ?, phone = ?, email = ?, address_json = ?, updated_at = ?
    WHERE id = ? AND shop_id = ? AND deleted_at IS NULL
  `).run(
    data.name,
    data.gstin || null,
    data.phone || null,
    data.email || null,
    data.address ? JSON.stringify(data.address) : null,
    now,
    customerId,
    shopId
  );

  if (result.changes === 0) {
    throw new Error('Customer not found');
  }

  logAction(shopId, 'customer', customerId, 'UPDATE', null, actorUserId);

  return getCustomer(shopId, customerId);
}

/**
 * Soft delete a customer
 * @param {string} shopId - Shop UUID
 * @param {string} customerId - Customer UUID
 * @param {string} actorUserId - User performing the action
 */
export function deleteCustomer(shopId, customerId, actorUserId) {
  const db = getDatabase();

  const result = db.prepare(`
    UPDATE customers SET deleted_at = ? WHERE id = ? AND shop_id = ? AND deleted_at IS NULL
  `).run(new Date().toISOString(), customerId, shopId);

  if (result.changes === 0) {
    throw new Error('Customer not found or already deleted');
  }

  logAction(shopId, 'customer', customerId, 'DELETE', null, actorUserId);
}

/**
 * Update customer balance (derived from invoices and payments)
 * @param {string} shopId - Shop UUID
 * @param {string} customerId - Customer UUID
 */
export function updateCustomerBalance(shopId, customerId) {
  const db = getDatabase();

  const balance = recalculateBalance(db, customerId, 'CUSTOMER');

  db.prepare(`
    UPDATE customers SET balance = ? WHERE id = ? AND shop_id = ?
  `).run(balance, customerId, shopId);

  return balance;
}
