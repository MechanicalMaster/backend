/**
 * Calculate invoice totals from line items
 * Server-side authority - never trust client calculations
 * 
 * @param {Array} items - Invoice line items
 * @param {string} placeOfSupply - State code for GST calculation
 * @returns {Object} Calculation results
 */
export function calculateInvoiceTotals(items, placeOfSupply = null) {
    let subtotal = 0;
    let taxTotal = 0;
    let cgst = 0;
    let sgst = 0;
    let igst = 0;

    items.forEach(item => {
        const lineTotal = item.quantity * item.rate;
        subtotal += lineTotal;

        if (item.taxRate) {
            const lineTax = (lineTotal * item.taxRate) / 100;
            taxTotal += lineTax;

            // Simplified CGST/SGST vs IGST logic
            // In production, compare placeOfSupply with business GSTIN state
            const isIntraState = true; // TODO: Implement proper state comparison

            if (isIntraState) {
                cgst += lineTax / 2;
                sgst += lineTax / 2;
            } else {
                igst += lineTax;
            }
        }
    });

    const grandTotal = subtotal + taxTotal;
    const roundOff = Math.round(grandTotal) - grandTotal;

    return {
        subtotal: parseFloat(subtotal.toFixed(2)),
        taxTotal: parseFloat(taxTotal.toFixed(2)),
        cgst: parseFloat(cgst.toFixed(2)),
        sgst: parseFloat(sgst.toFixed(2)),
        igst: parseFloat(igst.toFixed(2)),
        roundOff: parseFloat(roundOff.toFixed(2)),
        grandTotal: parseFloat(Math.round(grandTotal).toFixed(2))
    };
}

/**
 * Recalculate customer/vendor balance from ledger
 * Balances are derived, not authoritative
 * 
 * @param {Object} db - Database instance
 * @param {string} partyId - Customer or vendor ID
 * @param {string} partyType - 'CUSTOMER' or 'VENDOR'
 * @returns {number} Calculated balance
 */
export function recalculateBalance(db, partyId, partyType) {
    // Sum all invoices for this party
    const invoiceStmt = db.prepare(`
    SELECT COALESCE(SUM(it.grand_total), 0) as total_invoiced
    FROM invoices i
    JOIN invoice_totals it ON i.id = it.invoice_id
    WHERE i.customer_id = ? AND i.deleted_at IS NULL
  `);

    const { total_invoiced } = invoiceStmt.get(partyId);

    // Sum all payments for this party
    const paymentStmt = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total_paid
    FROM payments
    WHERE party_id = ? AND party_type = ?
  `);

    const { total_paid } = paymentStmt.get(partyId, partyType);

    return parseFloat((total_invoiced - total_paid).toFixed(2));
}
