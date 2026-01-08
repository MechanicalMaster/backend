/**
 * InvoiceAggregate - Domain Object / DTO
 * 
 * This is NOT an ORM model. It represents the canonical business object shape
 * that the API exposes to clients.
 * 
 * Internally, this aggregate is assembled from 5 tables:
 * - invoices
 * - invoice_customer_snapshot
 * - invoice_items
 * - invoice_totals
 * - invoice_photos
 */

import { toRupees } from '../utils/calculator.js';

/**
 * Create an invoice aggregate object from database rows
 * This is the READ assembly operation
 * 
 * @param {Object} invoice - Invoice header row
 * @param {Object} customer - Customer snapshot row
 * @param {Array} items - Invoice item rows
 * @param {Object} totals - Invoice totals row
 * @param {Array} photos - Invoice photo rows
 * @returns {Object} Assembled InvoiceAggregate
 */
export function assembleInvoiceAggregate(invoice, customer, items, totals, photos) {
    return {
        id: invoice.id,
        invoiceNumber: invoice.invoice_number,
        type: invoice.type,
        status: invoice.status,
        date: invoice.date,
        dueDate: invoice.due_date,
        placeOfSupply: invoice.place_of_supply,

        customer: customer ? {
            id: invoice.customer_id,
            name: customer.name,
            phone: customer.phone,
            gstin: customer.gstin,
            address: customer.address_json ? JSON.parse(customer.address_json) : null
        } : null,

        items: items.map(item => ({
            id: item.id,
            productId: item.product_id,
            description: item.description,
            hsn: item.hsn,
            purity: item.purity,
            quantity: item.quantity,
            rate: item.rate,
            taxRate: item.tax_rate,
            weight: item.weight_json ? JSON.parse(item.weight_json) : null,
            amount: item.amount_json ? JSON.parse(item.amount_json) : null
        })),

        totals: totals ? {
            subtotal: toRupees(totals.subtotal_paisa),
            taxTotal: toRupees(totals.tax_total_paisa),
            cgst: toRupees(totals.cgst_paisa),
            sgst: toRupees(totals.sgst_paisa),
            igst: toRupees(totals.igst_paisa),
            roundOff: toRupees(totals.round_off_paisa),
            grandTotal: toRupees(totals.grand_total_paisa)
        } : null,

        photos: photos.map(photo => ({
            id: photo.id,
            url: `/api/photos/${photo.id}`,
            createdAt: photo.created_at
        })),

        createdAt: invoice.created_at,
        updatedAt: invoice.updated_at
    };
}

/**
 * Decompose an invoice aggregate for database storage
 * This prepares the aggregate for WRITE operations
 * 
 * @param {Object} aggregate - Invoice aggregate from client
 * @param {Object} computedValues - Server-computed values (totals, etc.)
 * @returns {Object} Decomposed data ready for database insertion
 */
export function decomposeInvoiceAggregate(aggregate, computedValues) {
    return {
        invoice: {
            customer_id: aggregate.customerId,
            type: aggregate.type,
            status: aggregate.status || 'UNPAID',
            date: aggregate.date,
            due_date: aggregate.dueDate || null,
            place_of_supply: aggregate.placeOfSupply || null
        },

        customerSnapshot: {
            name: aggregate.customer.name,
            phone: aggregate.customer.phone || null,
            gstin: aggregate.customer.gstin || null,
            address_json: aggregate.customer.address ? JSON.stringify(aggregate.customer.address) : null
        },

        items: aggregate.items.map(item => ({
            product_id: item.productId || null,
            description: item.description || null,
            hsn: item.hsn || null,
            purity: item.purity || null,
            quantity: item.quantity,
            rate: item.rate,
            tax_rate: item.taxRate || null,
            weight_json: item.weight ? JSON.stringify(item.weight) : null,
            amount_json: item.amount ? JSON.stringify(item.amount) : null
        })),

        totals: computedValues.totals
    };
}
