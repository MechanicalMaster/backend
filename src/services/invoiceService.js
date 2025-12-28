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
 */
export function assembleInvoice(shopId, invoiceId) {
  const db = getDatabase();

  const invoice = db.prepare(`
    SELECT * FROM invoices WHERE id = ? AND shop_id = ? AND deleted_at IS NULL
  `).get(invoiceId, shopId);

  if (!invoice) return null;

  const customer = db.prepare(`
    SELECT * FROM invoice_customer_snapshot WHERE invoice_id = ?
  `).get(invoiceId);

  const items = db.prepare(`
    SELECT * FROM invoice_items WHERE invoice_id = ?
  `).all(invoiceId);

  const totals = db.prepare(`
    SELECT * FROM invoice_totals WHERE invoice_id = ?
  `).get(invoiceId);

  const photos = db.prepare(`
    SELECT * FROM invoice_photos WHERE invoice_id = ?
  `).all(invoiceId);

  return assembleInvoiceAggregate(invoice, customer, items, totals, photos);
}

/**
 * Create a new invoice (TRANSACTIONAL)
 * @param {string} shopId - Shop UUID
 * @param {Object} aggregatePayload - Invoice aggregate from client
 * @param {string} requestId - Optional idempotency key
 * @param {string} actorUserId - User performing the action
 */
export function createInvoice(shopId, aggregatePayload, requestId = null, actorUserId) {
  return transaction((db) => {
    const now = new Date().toISOString();

    if (requestId) {
      const existing = db.prepare(`
        SELECT entity_id FROM idempotency_keys WHERE request_id = ? AND shop_id = ?
      `).get(requestId, shopId);

      if (existing) {
        return assembleInvoice(shopId, existing.entity_id);
      }
    }

    const invoiceId = generateUUID();
    const invoiceNumber = generateInvoiceNumber(shopId);

    const computedTotals = calculateInvoiceTotals(
      aggregatePayload.items,
      aggregatePayload.placeOfSupply
    );

    const decomposed = decomposeInvoiceAggregate(aggregatePayload, {
      totals: computedTotals
    });

    db.prepare(`
      INSERT INTO invoices (
        id, shop_id, invoice_number, customer_id, type, status, date, due_date, 
        place_of_supply, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      invoiceId, shopId, invoiceNumber,
      decomposed.invoice.customer_id, decomposed.invoice.type,
      decomposed.invoice.status, decomposed.invoice.date,
      decomposed.invoice.due_date, decomposed.invoice.place_of_supply,
      now, now
    );

    db.prepare(`
      INSERT INTO invoice_customer_snapshot (invoice_id, name, phone, gstin, address_json)
      VALUES (?, ?, ?, ?, ?)
    `).run(invoiceId, decomposed.customerSnapshot.name, decomposed.customerSnapshot.phone,
      decomposed.customerSnapshot.gstin, decomposed.customerSnapshot.address_json);

    const itemStmt = db.prepare(`
      INSERT INTO invoice_items (id, invoice_id, product_id, description, quantity, rate, tax_rate, weight_json, amount_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    decomposed.items.forEach(item => {
      itemStmt.run(generateUUID(), invoiceId, item.product_id, item.description,
        item.quantity, item.rate, item.tax_rate, item.weight_json, item.amount_json);
    });

    db.prepare(`
      INSERT INTO invoice_totals (invoice_id, subtotal, tax_total, cgst, sgst, igst, round_off, grand_total)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(invoiceId, computedTotals.subtotal, computedTotals.taxTotal,
      computedTotals.cgst, computedTotals.sgst, computedTotals.igst,
      computedTotals.roundOff, computedTotals.grandTotal);

    if (requestId) {
      db.prepare(`
        INSERT INTO idempotency_keys (request_id, shop_id, entity_type, entity_id, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(requestId, shopId, 'invoice', invoiceId, now);
    }

    logAction(shopId, 'invoice', invoiceId, 'CREATE', { invoiceNumber }, actorUserId);

    return assembleInvoice(shopId, invoiceId);
  });
}

/**
 * Update an existing invoice (TRANSACTIONAL)
 * @param {string} shopId - Shop UUID
 * @param {string} invoiceId - Invoice UUID
 * @param {Object} aggregatePayload - Updated invoice aggregate
 * @param {string} actorUserId - User performing the action
 */
export function updateInvoice(shopId, invoiceId, aggregatePayload, actorUserId) {
  return transaction((db) => {
    const now = new Date().toISOString();

    const existing = db.prepare(`
      SELECT id FROM invoices WHERE id = ? AND shop_id = ? AND deleted_at IS NULL
    `).get(invoiceId, shopId);

    if (!existing) {
      throw new Error('Invoice not found');
    }

    const computedTotals = calculateInvoiceTotals(
      aggregatePayload.items, aggregatePayload.placeOfSupply
    );

    const decomposed = decomposeInvoiceAggregate(aggregatePayload, { totals: computedTotals });

    db.prepare(`
      UPDATE invoices SET customer_id = ?, type = ?, status = ?, date = ?, due_date = ?,
          place_of_supply = ?, updated_at = ? WHERE id = ? AND shop_id = ?
    `).run(decomposed.invoice.customer_id, decomposed.invoice.type, decomposed.invoice.status,
      decomposed.invoice.date, decomposed.invoice.due_date,
      decomposed.invoice.place_of_supply, now, invoiceId, shopId);

    db.prepare('DELETE FROM invoice_customer_snapshot WHERE invoice_id = ?').run(invoiceId);
    db.prepare(`
      INSERT INTO invoice_customer_snapshot (invoice_id, name, phone, gstin, address_json)
      VALUES (?, ?, ?, ?, ?)
    `).run(invoiceId, decomposed.customerSnapshot.name, decomposed.customerSnapshot.phone,
      decomposed.customerSnapshot.gstin, decomposed.customerSnapshot.address_json);

    db.prepare('DELETE FROM invoice_items WHERE invoice_id = ?').run(invoiceId);
    const itemStmt = db.prepare(`
      INSERT INTO invoice_items (id, invoice_id, product_id, description, quantity, rate, tax_rate, weight_json, amount_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    decomposed.items.forEach(item => {
      itemStmt.run(generateUUID(), invoiceId, item.product_id, item.description,
        item.quantity, item.rate, item.tax_rate, item.weight_json, item.amount_json);
    });

    db.prepare('DELETE FROM invoice_totals WHERE invoice_id = ?').run(invoiceId);
    db.prepare(`
      INSERT INTO invoice_totals (invoice_id, subtotal, tax_total, cgst, sgst, igst, round_off, grand_total)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(invoiceId, computedTotals.subtotal, computedTotals.taxTotal,
      computedTotals.cgst, computedTotals.sgst, computedTotals.igst,
      computedTotals.roundOff, computedTotals.grandTotal);

    logAction(shopId, 'invoice', invoiceId, 'UPDATE', null, actorUserId);

    return assembleInvoice(shopId, invoiceId);
  });
}

/**
 * List all invoices for a shop (headers only)
 */
export function listInvoices(shopId) {
  const db = getDatabase();
  return db.prepare(`
    SELECT i.*, it.grand_total FROM invoices i
    LEFT JOIN invoice_totals it ON i.id = it.invoice_id
    WHERE i.shop_id = ? AND i.deleted_at IS NULL
    ORDER BY i.date DESC, i.created_at DESC
  `).all(shopId);
}

/**
 * Soft delete an invoice
 * @param {string} shopId - Shop UUID
 * @param {string} invoiceId - Invoice UUID
 * @param {string} actorUserId - User performing the action
 */
export function deleteInvoice(shopId, invoiceId, actorUserId) {
  const db = getDatabase();
  const result = db.prepare(`
    UPDATE invoices SET deleted_at = ? WHERE id = ? AND shop_id = ? AND deleted_at IS NULL
  `).run(new Date().toISOString(), invoiceId, shopId);

  if (result.changes === 0) {
    throw new Error('Invoice not found or already deleted');
  }

  logAction(shopId, 'invoice', invoiceId, 'DELETE', null, actorUserId);
}

/**
 * Add a photo to an invoice
 */
export function addInvoicePhoto(shopId, invoiceId, filePath, checksum) {
  const db = getDatabase();
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
 */
export function deleteInvoicePhoto(shopId, photoId) {
  const db = getDatabase();
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
