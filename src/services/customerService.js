import { getDatabase } from '../db/init.js';
import { generateUUID } from '../utils/uuid.js';
import { recalculateBalance } from '../utils/calculator.js';
import { logAction } from './auditService.js';

/**
 * Create a new customer
 */
export function createCustomer(data) {
    const db = getDatabase();
    const customerId = generateUUID();
    const now = new Date().toISOString();

    db.prepare(`
    INSERT INTO customers (
      id, name, gstin, phone, email, balance, address_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
        customerId,
        data.name,
        data.gstin || null,
        data.phone || null,
        data.email || null,
        0, // Initial balance
        data.address ? JSON.stringify(data.address) : null,
        now,
        now
    );

    logAction('customer', customerId, 'CREATE', { name: data.name });

    return getCustomer(customerId);
}

/**
 * Get a single customer
 */
export function getCustomer(customerId) {
    const db = getDatabase();

    const customer = db.prepare(`
    SELECT * FROM customers WHERE id = ? AND deleted_at IS NULL
  `).get(customerId);

    if (!customer) return null;

    return {
        ...customer,
        address: customer.address_json ? JSON.parse(customer.address_json) : null
    };
}

/**
 * List all customers
 */
export function listCustomers() {
    const db = getDatabase();

    const customers = db.prepare(`
    SELECT * FROM customers WHERE deleted_at IS NULL ORDER BY name
  `).all();

    return customers.map(c => ({
        ...c,
        address: c.address_json ? JSON.parse(c.address_json) : null
    }));
}

/**
 * Update a customer
 */
export function updateCustomer(customerId, data) {
    const db = getDatabase();
    const now = new Date().toISOString();

    const result = db.prepare(`
    UPDATE customers
    SET name = ?, gstin = ?, phone = ?, email = ?, address_json = ?, updated_at = ?
    WHERE id = ? AND deleted_at IS NULL
  `).run(
        data.name,
        data.gstin || null,
        data.phone || null,
        data.email || null,
        data.address ? JSON.stringify(data.address) : null,
        now,
        customerId
    );

    if (result.changes === 0) {
        throw new Error('Customer not found');
    }

    logAction('customer', customerId, 'UPDATE');

    return getCustomer(customerId);
}

/**
 * Soft delete a customer
 */
export function deleteCustomer(customerId) {
    const db = getDatabase();

    const result = db.prepare(`
    UPDATE customers SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL
  `).run(new Date().toISOString(), customerId);

    if (result.changes === 0) {
        throw new Error('Customer not found or already deleted');
    }

    logAction('customer', customerId, 'DELETE');
}

/**
 * Update customer balance (derived from invoices and payments)
 */
export function updateCustomerBalance(customerId) {
    const db = getDatabase();

    const balance = recalculateBalance(db, customerId, 'CUSTOMER');

    db.prepare(`
    UPDATE customers SET balance = ? WHERE id = ?
  `).run(balance, customerId);

    return balance;
}
