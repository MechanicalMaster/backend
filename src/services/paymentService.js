// SECURITY: All queries in this service MUST be scoped by shopId

import { getDatabase, transaction } from '../db/init.js';
import { generateUUID } from '../utils/uuid.js';
import { generatePaymentNumber } from './sequenceService.js';
import { updateCustomerBalance } from './customerService.js';
import { updateVendorBalance } from './vendorService.js';
import { logAction } from './auditService.js';

/**
 * Create a payment with allocations (TRANSACTIONAL)
 * Also updates customer/vendor balances and invoice statuses
 * 
 * @param {string} shopId - Shop UUID
 * @param {Object} data - Payment data
 * @returns {Object} Created payment
 */
export function createPayment(shopId, data) {
    return transaction((db) => {
        const paymentId = generateUUID();
        const transactionNumber = generatePaymentNumber(shopId);
        const now = new Date().toISOString();

        // 1. Insert payment
        db.prepare(`
      INSERT INTO payments (
        id, shop_id, transaction_number, date, type, party_type, party_id, amount, mode, notes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
            paymentId,
            shopId,
            transactionNumber,
            data.date,
            data.type,
            data.partyType,
            data.partyId,
            data.amount,
            data.mode || null,
            data.notes || null,
            now
        );

        // 2. Insert payment allocations
        if (data.allocations && data.allocations.length > 0) {
            const allocStmt = db.prepare(`
        INSERT INTO payment_allocations (id, payment_id, invoice_id, amount)
        VALUES (?, ?, ?, ?)
      `);

            data.allocations.forEach(alloc => {
                allocStmt.run(generateUUID(), paymentId, alloc.invoiceId, alloc.amount);
            });

            // 3. Update invoice statuses
            data.allocations.forEach(alloc => {
                updateInvoiceStatus(db, shopId, alloc.invoiceId);
            });
        }

        // 4. Recalculate party balance
        if (data.partyType === 'CUSTOMER') {
            updateCustomerBalance(shopId, data.partyId);
        } else if (data.partyType === 'VENDOR') {
            updateVendorBalance(shopId, data.partyId);
        }

        logAction(shopId, 'payment', paymentId, 'CREATE', { transactionNumber });

        return getPayment(shopId, paymentId);
    });
}

/**
 * Update invoice status based on payment allocations
 * Internal helper function
 */
function updateInvoiceStatus(db, shopId, invoiceId) {
    // Get total invoice amount
    const invoice = db.prepare(`
    SELECT it.grand_total
    FROM invoices i
    JOIN invoice_totals it ON i.id = it.invoice_id
    WHERE i.id = ? AND i.shop_id = ?
  `).get(invoiceId, shopId);

    if (!invoice) return;

    // Get total allocated payments
    const allocated = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total
    FROM payment_allocations
    WHERE invoice_id = ?
  `).get(invoiceId);

    const totalPaid = allocated.total;
    const grandTotal = invoice.grand_total;

    let status;
    if (totalPaid >= grandTotal) {
        status = 'PAID';
    } else if (totalPaid > 0) {
        status = 'PARTIAL';
    } else {
        status = 'UNPAID';
    }

    db.prepare(`
    UPDATE invoices SET status = ?, updated_at = ? WHERE id = ? AND shop_id = ?
  `).run(status, new Date().toISOString(), invoiceId, shopId);
}

/**
 * Get a payment with allocations
 * @param {string} shopId - Shop UUID
 * @param {string} paymentId - Payment UUID
 */
export function getPayment(shopId, paymentId) {
    const db = getDatabase();

    const payment = db.prepare(`
    SELECT * FROM payments WHERE id = ? AND shop_id = ?
  `).get(paymentId, shopId);

    if (!payment) return null;

    const allocations = db.prepare(`
    SELECT * FROM payment_allocations WHERE payment_id = ?
  `).all(paymentId);

    return {
        ...payment,
        allocations
    };
}

/**
 * List payments for a shop
 * @param {string} shopId - Shop UUID
 * @param {Object} filters - Optional filters
 */
export function listPayments(shopId, filters = {}) {
    const db = getDatabase();

    let query = 'SELECT * FROM payments WHERE shop_id = ?';
    const params = [shopId];

    if (filters.partyId) {
        query += ' AND party_id = ?';
        params.push(filters.partyId);
    }

    if (filters.type) {
        query += ' AND type = ?';
        params.push(filters.type);
    }

    query += ' ORDER BY date DESC, created_at DESC';

    return db.prepare(query).all(...params);
}

/**
 * Delete a payment and recalculate balances
 * @param {string} shopId - Shop UUID
 * @param {string} paymentId - Payment UUID
 */
export function deletePayment(shopId, paymentId) {
    return transaction((db) => {
        const payment = db.prepare('SELECT * FROM payments WHERE id = ? AND shop_id = ?').get(paymentId, shopId);

        if (!payment) {
            throw new Error('Payment not found');
        }

        // Get allocations before deleting
        const allocations = db.prepare(`
      SELECT invoice_id FROM payment_allocations WHERE payment_id = ?
    `).all(paymentId);

        // Delete allocations
        db.prepare('DELETE FROM payment_allocations WHERE payment_id = ?').run(paymentId);

        // Delete payment
        db.prepare('DELETE FROM payments WHERE id = ?').run(paymentId);

        // Update affected invoice statuses
        allocations.forEach(alloc => {
            updateInvoiceStatus(db, shopId, alloc.invoice_id);
        });

        // Recalculate party balance
        if (payment.party_type === 'CUSTOMER') {
            updateCustomerBalance(shopId, payment.party_id);
        } else if (payment.party_type === 'VENDOR') {
            updateVendorBalance(shopId, payment.party_id);
        }

        logAction(shopId, 'payment', paymentId, 'DELETE');
    });
}
