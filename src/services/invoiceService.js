import { getDatabase, transaction } from '../db/init.js';
import { generateUUID } from '../utils/uuid.js';
import { generateInvoiceNumber } from './sequenceService.js';
import { calculateInvoiceTotals } from '../utils/calculator.js';
import { assembleInvoiceAggregate, decomposeInvoiceAggregate } from '../models/InvoiceAggregate.js';
import { logAction } from './auditService.js';

/**
 * Assemble a complete invoice aggregate from database
 * READ operation - joins data from 5 tables
 * 
 * @param {string} invoiceId - Invoice UUID
 * @returns {Object} Assembled InvoiceAggregate or null
 */
export function assembleInvoice(invoiceId) {
    const db = getDatabase();

    // Get invoice header
    const invoice = db.prepare(`
    SELECT * FROM invoices WHERE id = ? AND deleted_at IS NULL
  `).get(invoiceId);

    if (!invoice) return null;

    // Get customer snapshot
    const customer = db.prepare(`
    SELECT * FROM invoice_customer_snapshot WHERE invoice_id = ?
  `).get(invoiceId);

    // Get line items
    const items = db.prepare(`
    SELECT * FROM invoice_items WHERE invoice_id = ?
  `).all(invoiceId);

    // Get totals
    const totals = db.prepare(`
    SELECT * FROM invoice_totals WHERE invoice_id = ?
  `).get(invoiceId);

    // Get photos
    const photos = db.prepare(`
    SELECT * FROM invoice_photos WHERE invoice_id = ?
  `).all(invoiceId);

    return assembleInvoiceAggregate(invoice, customer, items, totals, photos);
}

/**
 * Create a new invoice (TRANSACTIONAL)
 * Decomposes aggregate and persists to 5 tables atomically
 * 
 * @param {Object} aggregatePayload - Invoice aggregate from client
 * @param {string} requestId - Optional idempotency key
 * @returns {Object} Created invoice aggregate
 */
export function createInvoice(aggregatePayload, requestId = null) {
    return transaction((db) => {
        const now = new Date().toISOString();

        // Check idempotency key
        if (requestId) {
            const existing = db.prepare(`
        SELECT entity_id FROM idempotency_keys WHERE request_id = ?
      `).get(requestId);

            if (existing) {
                // Return existing invoice
                return assembleInvoice(existing.entity_id);
            }
        }

        // Generate IDs and numbers
        const invoiceId = generateUUID();
        const invoiceNumber = generateInvoiceNumber();

        // Recompute totals server-side (NEVER trust client)
        const computedTotals = calculateInvoiceTotals(
            aggregatePayload.items,
            aggregatePayload.placeOfSupply
        );

        // Decompose aggregate
        const decomposed = decomposeInvoiceAggregate(aggregatePayload, {
            totals: computedTotals
        });

        // 1. Insert invoice header
        db.prepare(`
      INSERT INTO invoices (
        id, invoice_number, customer_id, type, status, date, due_date, 
        place_of_supply, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
            invoiceId,
            invoiceNumber,
            decomposed.invoice.customer_id,
            decomposed.invoice.type,
            decomposed.invoice.status,
            decomposed.invoice.date,
            decomposed.invoice.due_date,
            decomposed.invoice.place_of_supply,
            now,
            now
        );

        // 2. Insert customer snapshot
        db.prepare(`
      INSERT INTO invoice_customer_snapshot (invoice_id, name, phone, gstin, address_json)
      VALUES (?, ?, ?, ?, ?)
    `).run(
            invoiceId,
            decomposed.customerSnapshot.name,
            decomposed.customerSnapshot.phone,
            decomposed.customerSnapshot.gstin,
            decomposed.customerSnapshot.address_json
        );

        // 3. Insert line items
        const itemStmt = db.prepare(`
      INSERT INTO invoice_items (
        id, invoice_id, product_id, description, quantity, rate, tax_rate,
        weight_json, amount_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

        decomposed.items.forEach(item => {
            itemStmt.run(
                generateUUID(),
                invoiceId,
                item.product_id,
                item.description,
                item.quantity,
                item.rate,
                item.tax_rate,
                item.weight_json,
                item.amount_json
            );
        });

        // 4. Insert totals
        db.prepare(`
      INSERT INTO invoice_totals (
        invoice_id, subtotal, tax_total, cgst, sgst, igst, round_off, grand_total
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
            invoiceId,
            computedTotals.subtotal,
            computedTotals.taxTotal,
            computedTotals.cgst,
            computedTotals.sgst,
            computedTotals.igst,
            computedTotals.roundOff,
            computedTotals.grandTotal
        );

        // 5. Store idempotency key if provided
        if (requestId) {
            db.prepare(`
        INSERT INTO idempotency_keys (request_id, entity_type, entity_id, created_at)
        VALUES (?, ?, ?, ?)
      `).run(requestId, 'invoice', invoiceId, now);
        }

        // 6. Audit log
        logAction('invoice', invoiceId, 'CREATE', { invoiceNumber });

        // Return assembled aggregate
        return assembleInvoice(invoiceId);
    });
}

/**
 * Update an existing invoice (TRANSACTIONAL)
 * Full object replacement strategy
 * 
 * @param {string} invoiceId - Invoice UUID
 * @param {Object} aggregatePayload - Updated invoice aggregate
 * @returns {Object} Updated invoice aggregate
 */
export function updateInvoice(invoiceId, aggregatePayload) {
    return transaction((db) => {
        const now = new Date().toISOString();

        // Verify invoice exists
        const existing = db.prepare(`
      SELECT id FROM invoices WHERE id = ? AND deleted_at IS NULL
    `).get(invoiceId);

        if (!existing) {
            throw new Error('Invoice not found');
        }

        // Recompute totals server-side
        const computedTotals = calculateInvoiceTotals(
            aggregatePayload.items,
            aggregatePayload.placeOfSupply
        );

        // Decompose aggregate
        const decomposed = decomposeInvoiceAggregate(aggregatePayload, {
            totals: computedTotals
        });

        // 1. Update invoice header
        db.prepare(`
      UPDATE invoices
      SET customer_id = ?, type = ?, status = ?, date = ?, due_date = ?,
          place_of_supply = ?, updated_at = ?
      WHERE id = ?
    `).run(
            decomposed.invoice.customer_id,
            decomposed.invoice.type,
            decomposed.invoice.status,
            decomposed.invoice.date,
            decomposed.invoice.due_date,
            decomposed.invoice.place_of_supply,
            now,
            invoiceId
        );

        // 2. Delete and recreate customer snapshot
        db.prepare('DELETE FROM invoice_customer_snapshot WHERE invoice_id = ?').run(invoiceId);
        db.prepare(`
      INSERT INTO invoice_customer_snapshot (invoice_id, name, phone, gstin, address_json)
      VALUES (?, ?, ?, ?, ?)
    `).run(
            invoiceId,
            decomposed.customerSnapshot.name,
            decomposed.customerSnapshot.phone,
            decomposed.customerSnapshot.gstin,
            decomposed.customerSnapshot.address_json
        );

        // 3. Delete and recreate items
        db.prepare('DELETE FROM invoice_items WHERE invoice_id = ?').run(invoiceId);
        const itemStmt = db.prepare(`
      INSERT INTO invoice_items (
        id, invoice_id, product_id, description, quantity, rate, tax_rate,
        weight_json, amount_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

        decomposed.items.forEach(item => {
            itemStmt.run(
                generateUUID(),
                invoiceId,
                item.product_id,
                item.description,
                item.quantity,
                item.rate,
                item.tax_rate,
                item.weight_json,
                item.amount_json
            );
        });

        // 4. Delete and recreate totals
        db.prepare('DELETE FROM invoice_totals WHERE invoice_id = ?').run(invoiceId);
        db.prepare(`
      INSERT INTO invoice_totals (
        invoice_id, subtotal, tax_total, cgst, sgst, igst, round_off, grand_total
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
            invoiceId,
            computedTotals.subtotal,
            computedTotals.taxTotal,
            computedTotals.cgst,
            computedTotals.sgst,
            computedTotals.igst,
            computedTotals.roundOff,
            computedTotals.grandTotal
        );

        // 5. Audit log
        logAction('invoice', invoiceId, 'UPDATE');

        // Return assembled aggregate
        return assembleInvoice(invoiceId);
    });
}

/**
 * List all invoices (headers only, no aggregation)
 * @returns {Array} List of invoice headers
 */
export function listInvoices() {
    const db = getDatabase();

    const invoices = db.prepare(`
    SELECT i.*, it.grand_total
    FROM invoices i
    LEFT JOIN invoice_totals it ON i.id = it.invoice_id
    WHERE i.deleted_at IS NULL
    ORDER BY i.date DESC, i.created_at DESC
  `).all();

    return invoices;
}

/**
 * Soft delete an invoice
 * @param {string} invoiceId - Invoice UUID
 */
export function deleteInvoice(invoiceId) {
    const db = getDatabase();

    const stmt = db.prepare(`
    UPDATE invoices SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL
  `);

    const result = stmt.run(new Date().toISOString(), invoiceId);

    if (result.changes === 0) {
        throw new Error('Invoice not found or already deleted');
    }

    logAction('invoice', invoiceId, 'DELETE');
}

/**
 * Add a photo to an invoice
 * @param {string} invoiceId - Invoice UUID
 * @param {string} filePath - Stored file path
 * @param {string} checksum - File checksum
 * @returns {Object} Photo record
 */
export function addInvoicePhoto(invoiceId, filePath, checksum) {
    const db = getDatabase();
    const photoId = generateUUID();
    const now = new Date().toISOString();

    db.prepare(`
    INSERT INTO invoice_photos (id, invoice_id, file_path, checksum, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(photoId, invoiceId, filePath, checksum, now);

    return { id: photoId, url: `/api/photos/${photoId}`, createdAt: now };
}

/**
 * Delete a photo from an invoice
 * @param {string} photoId - Photo UUID
 */
export function deleteInvoicePhoto(photoId) {
    const db = getDatabase();

    const photo = db.prepare('SELECT file_path FROM invoice_photos WHERE id = ?').get(photoId);

    if (!photo) {
        throw new Error('Photo not found');
    }

    db.prepare('DELETE FROM invoice_photos WHERE id = ?').run(photoId);

    return photo.file_path;
}
