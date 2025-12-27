import { getDatabase, transaction } from '../db/init.js';
import { generateUUID } from '../utils/uuid.js';
import { generatePaymentNumber } from './sequenceService.js';
import { updateCustomerBalance } from './customerService.js';
import { logAction } from './auditService.js';

/**
 * Create a payment with allocations (TRANSACTIONAL)
 * Also updates customer/vendor balances and invoice statuses
 * 
 * @param {Object} data - Payment data
 * @returns {Object} Created payment
 */
export function createPayment(data) {
    return transaction((db) => {
        const paymentId = generateUUID();
        const transactionNumber = generatePaymentNumber();
        const now = new Date().toISOString();

        // 1. Insert payment
        db.prepare(`
      INSERT INTO payments (
        id, transaction_number, date, type, party_type, party_id, amount, mode, notes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
            paymentId,
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
                updateInvoiceStatus(db, alloc.invoiceId);
            });
        }

        // 4. Recalculate party balance
        if (data.partyType === 'CUSTOMER') {
            updateCustomerBalance(data.partyId);
        }
        // Add vendor balance update when vendor service is implemented

        logAction('payment', paymentId, 'CREATE', { transactionNumber });

        return getPayment(paymentId);
    });
}

/**
 * Update invoice status based on payment allocations
 * Internal helper function
 */
function updateInvoiceStatus(db, invoiceId) {
    // Get total invoice amount
    const invoice = db.prepare(`
    SELECT it.grand_total
    FROM invoices i
    JOIN invoice_totals it ON i.id = it.invoice_id
    WHERE i.id = ?
  `).get(invoiceId);

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
    UPDATE invoices SET status = ?, updated_at = ? WHERE id = ?
  `).run(status, new Date().toISOString(), invoiceId);
}

/**
 * Get a payment with allocations
 */
export function getPayment(paymentId) {
    const db = getDatabase();

    const payment = db.prepare(`
    SELECT * FROM payments WHERE id = ?
  `).get(paymentId);

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
 * List payments
 */
export function listPayments(filters = {}) {
    const db = getDatabase();

    let query = 'SELECT * FROM payments WHERE 1=1';
    const params = [];

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
 */
export function deletePayment(paymentId) {
    return transaction((db) => {
        const payment = db.prepare('SELECT * FROM payments WHERE id = ?').get(paymentId);

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
            updateInvoiceStatus(db, alloc.invoice_id);
        });

        // Recalculate party balance
        if (payment.party_type === 'CUSTOMER') {
            updateCustomerBalance(payment.party_id);
        }

        logAction('payment', paymentId, 'DELETE');
    });
}
