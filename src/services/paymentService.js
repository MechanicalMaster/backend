// SECURITY: All queries in this service MUST be scoped by shopId

import { getDatabase, transaction } from '../db/init.js';
import { generateUUID } from '../utils/uuid.js';
import { generatePaymentNumber } from './sequenceService.js';
import { updateCustomerBalance } from './customerService.js';
import { updateVendorBalance } from './vendorService.js';
import { logAction } from './auditService.js';
import { bustHomeCache } from '../routes/home.js';
import { sanitizeString } from '../utils/sanitize.js';

/**
 * Create a payment with allocations (TRANSACTIONAL)
 * @param {string} shopId - Shop UUID
 * @param {Object} data - Payment data
 * @param {string} actorUserId - User performing the action
 * @returns {Object} Created payment
 */
export function createPayment(shopId, data, actorUserId) {
    return transaction((db) => {
        const paymentId = generateUUID();
        const transactionNumber = generatePaymentNumber(shopId);
        const now = new Date().toISOString();

        const amountPaisa = Math.round(data.amount * 100);

        // Sanitize notes to prevent XSS
        const sanitizedNotes = sanitizeString(data.notes);

        db.prepare(`
      INSERT INTO payments (
        id, shop_id, transaction_number, date, type, party_type, party_id, amount_paisa, amount, mode, notes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
            paymentId, shopId, transactionNumber, data.date, data.type,
            data.partyType, data.partyId, amountPaisa, data.amount, data.mode || null, sanitizedNotes || null, now
        );

        if (data.allocations && data.allocations.length > 0) {
            const allocStmt = db.prepare(`
        INSERT INTO payment_allocations (id, payment_id, invoice_id, amount)
        VALUES (?, ?, ?, ?)
      `);

            data.allocations.forEach(alloc => {
                allocStmt.run(generateUUID(), paymentId, alloc.invoiceId, alloc.amount);
            });

            data.allocations.forEach(alloc => {
                updateInvoiceStatus(db, shopId, alloc.invoiceId);
            });
        }

        if (data.partyType === 'CUSTOMER') {
            updateCustomerBalance(shopId, data.partyId);
        } else if (data.partyType === 'VENDOR') {
            updateVendorBalance(shopId, data.partyId);
        }

        logAction(shopId, 'payment', paymentId, 'CREATE', { transactionNumber }, actorUserId);
        bustHomeCache(shopId);

        return getPayment(shopId, paymentId);
    });
}

/**
 * Update invoice status based on payment allocations (internal helper)
 */
function updateInvoiceStatus(db, shopId, invoiceId) {
    const invoice = db.prepare(`
    SELECT it.grand_total_paisa FROM invoices i
    JOIN invoice_totals it ON i.id = it.invoice_id
    WHERE i.id = ? AND i.shop_id = ?
  `).get(invoiceId, shopId);

    if (!invoice) return;

    const allocated = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total FROM payment_allocations WHERE invoice_id = ?
  `).get(invoiceId);

    // Convert allocated amount to paisa for comparison
    const totalPaidPaisa = Math.round(allocated.total * 100);
    const grandTotalPaisa = invoice.grand_total_paisa;

    let status;
    if (totalPaidPaisa >= grandTotalPaisa) {
        status = 'PAID';
    } else if (totalPaidPaisa > 0) {
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

    return { ...payment, allocations };
}

/**
 * List payments for a shop
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
 * @param {string} actorUserId - User performing the action
 */
export function deletePayment(shopId, paymentId, actorUserId) {
    return transaction((db) => {
        const payment = db.prepare('SELECT * FROM payments WHERE id = ? AND shop_id = ?').get(paymentId, shopId);

        if (!payment) {
            throw new Error('Payment not found');
        }

        const allocations = db.prepare(`
      SELECT invoice_id FROM payment_allocations WHERE payment_id = ?
    `).all(paymentId);

        db.prepare('DELETE FROM payment_allocations WHERE payment_id = ?').run(paymentId);
        db.prepare('DELETE FROM payments WHERE id = ?').run(paymentId);

        allocations.forEach(alloc => {
            updateInvoiceStatus(db, shopId, alloc.invoice_id);
        });

        if (payment.party_type === 'CUSTOMER') {
            updateCustomerBalance(shopId, payment.party_id);
        } else if (payment.party_type === 'VENDOR') {
            updateVendorBalance(shopId, payment.party_id);
        }

        logAction(shopId, 'payment', paymentId, 'DELETE', null, actorUserId);
        bustHomeCache(shopId);
    });
}
