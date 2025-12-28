// SECURITY: All queries in this service MUST be scoped by shopId

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
 * @param {string} shopId - Shop UUID
 * @param {string} invoiceId - Invoice UUID
 * @returns {Object} Assembled InvoiceAggregate or null
 */
export function assembleInvoice(shopId, invoiceId) {
  const db = getDatabase();

  // Get invoice header (scoped by shop)
  const invoice = db.prepare(`
    SELECT * FROM invoices WHERE id = ? AND shop_id = ? AND deleted_at IS NULL
  `).get(invoiceId, shopId);

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
 * @param {string} shopId - Shop UUID
 * @param {Object} aggregatePayload - Invoice aggregate from client
 * @param {string} requestId - Optional idempotency key
 * @returns {Object} Created invoice aggregate
 */
export function createInvoice(shopId, aggregatePayload, requestId = null) {
  return transaction((db) => {
    const now = new Date().toISOString();

    // Check idempotency key (scoped by shop)
    if (requestId) {
      const existing = db.prepare(`
        SELECT entity_id FROM idempotency_keys WHERE request_id = ? AND shop_id = ?
      `).get(requestId, shopId);

      if (existing) {
        // Return existing invoice
        return assembleInvoice(shopId, existing.entity_id);
      }
    }

    // Generate IDs and numbers (per-shop)
    const invoiceId = generateUUID();
    const invoiceNumber = generateInvoiceNumber(shopId);

    // Recompute totals server-side (NEVER trust client)
    const computedTotals = calculateInvoiceTotals(
      aggregatePayload.items,
      aggregatePayload.placeOfSupply
    );

    // Decompose aggregate
    const decomposed = decomposeInvoiceAggregate(aggregatePayload, {
      totals: computedTotals
    });

    // 1. Insert invoice header (with shop_id)
    db.prepare(`
      INSERT INTO invoices (
        id, shop_id, invoice_number, customer_id, type, status, date, due_date, 
        place_of_supply, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      invoiceId,
      shopId,
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

    // 5. Store idempotency key if provided (with shop_id)
    if (requestId) {
      db.prepare(`
        INSERT INTO idempotency_keys (request_id, shop_id, entity_type, entity_id, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(requestId, shopId, 'invoice', invoiceId, now);
    }

    // 6. Audit log
    logAction(shopId, 'invoice', invoiceId, 'CREATE', { invoiceNumber });

    // Return assembled aggregate
    return assembleInvoice(shopId, invoiceId);
  });
}

/**
 * Update an existing invoice (TRANSACTIONAL)
 * Full object replacement strategy
 * 
 * @param {string} shopId - Shop UUID
 * @param {string} invoiceId - Invoice UUID
 * @param {Object} aggregatePayload - Updated invoice aggregate
 * @returns {Object} Updated invoice aggregate
 */
export function updateInvoice(shopId, invoiceId, aggregatePayload) {
  return transaction((db) => {
    const now = new Date().toISOString();

    // Verify invoice exists and belongs to shop
    const existing = db.prepare(`
      SELECT id FROM invoices WHERE id = ? AND shop_id = ? AND deleted_at IS NULL
    `).get(invoiceId, shopId);

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
      WHERE id = ? AND shop_id = ?
    `).run(
      decomposed.invoice.customer_id,
      decomposed.invoice.type,
      decomposed.invoice.status,
      decomposed.invoice.date,
      decomposed.invoice.due_date,
      decomposed.invoice.place_of_supply,
      now,
      invoiceId,
      shopId
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
    logAction(shopId, 'invoice', invoiceId, 'UPDATE');

    // Return assembled aggregate
    return assembleInvoice(shopId, invoiceId);
  });
}

/**
 * List all invoices for a shop (headers only, no aggregation)
 * @param {string} shopId - Shop UUID
 * @returns {Array} List of invoice headers
 */
export function listInvoices(shopId) {
  const db = getDatabase();

  const invoices = db.prepare(`
    SELECT i.*, it.grand_total
    FROM invoices i
    LEFT JOIN invoice_totals it ON i.id = it.invoice_id
    WHERE i.shop_id = ? AND i.deleted_at IS NULL
    ORDER BY i.date DESC, i.created_at DESC
  `).all(shopId);

  return invoices;
}

/**
 * Soft delete an invoice
 * @param {string} shopId - Shop UUID
 * @param {string} invoiceId - Invoice UUID
 */
export function deleteInvoice(shopId, invoiceId) {
  const db = getDatabase();

  const stmt = db.prepare(`
    UPDATE invoices SET deleted_at = ? WHERE id = ? AND shop_id = ? AND deleted_at IS NULL
  `);

  const result = stmt.run(new Date().toISOString(), invoiceId, shopId);

  if (result.changes === 0) {
    throw new Error('Invoice not found or already deleted');
  }

  logAction(shopId, 'invoice', invoiceId, 'DELETE');
}

/**
 * Add a photo to an invoice
 * @param {string} shopId - Shop UUID (for validation)
 * @param {string} invoiceId - Invoice UUID
 * @param {string} filePath - Stored file path
 * @param {string} checksum - File checksum
 * @returns {Object} Photo record
 */
export function addInvoicePhoto(shopId, invoiceId, filePath, checksum) {
  const db = getDatabase();

  // Verify invoice belongs to shop
  const invoice = db.prepare('SELECT id FROM invoices WHERE id = ? AND shop_id = ?').get(invoiceId, shopId);
  if (!invoice) {
    throw new Error('Invoice not found');
  }

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
 * @param {string} shopId - Shop UUID (for validation)
 * @param {string} photoId - Photo UUID
 */
export function deleteInvoicePhoto(shopId, photoId) {
  const db = getDatabase();

  // Verify photo belongs to an invoice in this shop
  const photo = db.prepare(`
        SELECT ip.file_path FROM invoice_photos ip
        JOIN invoices i ON ip.invoice_id = i.id
        WHERE ip.id = ? AND i.shop_id = ?
    `).get(photoId, shopId);

  if (!photo) {
    throw new Error('Photo not found');
  }

  db.prepare('DELETE FROM invoice_photos WHERE id = ?').run(photoId);

  return photo.file_path;
}
