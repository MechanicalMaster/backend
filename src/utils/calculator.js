/**
 * Calculate invoice totals using integer paisa arithmetic
 * Server-side authority - never trust client calculations
 * 
 * @param {Array} items - Invoice line items
 * @param {string} placeOfSupply - State code for GST calculation
 * @returns {Object} Calculation results in paisa (integers)
 */
export function calculateInvoiceTotals(items, placeOfSupply = null) {
    let subtotalPaisa = 0;
    let taxTotalPaisa = 0;
    let cgstPaisa = 0;
    let sgstPaisa = 0;
    let igstPaisa = 0;

    items.forEach(item => {
        // Convert rate to paisa FIRST to avoid floating-point errors
        const ratePaisa = Math.round(item.rate * 100);
        const lineTotalPaisa = item.quantity * ratePaisa;
        subtotalPaisa += lineTotalPaisa;

        if (item.taxRate) {
            const lineTaxPaisa = Math.round((lineTotalPaisa * item.taxRate) / 100);
            taxTotalPaisa += lineTaxPaisa;

            // Simplified CGST/SGST vs IGST logic
            // In production, compare placeOfSupply with business GSTIN state
            const isIntraState = true; // TODO: Implement proper state comparison

            if (isIntraState) {
                cgstPaisa += Math.round(lineTaxPaisa / 2);
                sgstPaisa += Math.round(lineTaxPaisa / 2);
            } else {
                igstPaisa += lineTaxPaisa;
            }
        }
    });

    const grandTotalBeforeRound = subtotalPaisa + taxTotalPaisa;
    // Round to nearest rupee in paisa
    const grandTotalPaisa = Math.round(grandTotalBeforeRound / 100) * 100;
    const roundOffPaisa = grandTotalPaisa - grandTotalBeforeRound;

    return {
        subtotalPaisa,
        taxTotalPaisa,
        cgstPaisa,
        sgstPaisa,
        igstPaisa,
        roundOffPaisa,
        grandTotalPaisa
    };
}

/**
 * Convert paisa (integer) to rupees (decimal string) for API responses
 * 
 * @param {number} paisa - Amount in paisa (integer)
 * @returns {string} Amount in rupees with 2 decimal places
 */
export function toRupees(paisa) {
    if (paisa === null || paisa === undefined) {
        return '0.00';
    }
    return (paisa / 100).toFixed(2);
}

/**
 * Recalculate customer/vendor balance from ledger using integer paisa
 * Balances are derived, not authoritative
 * 
 * @param {Object} db - Database instance
 * @param {string} partyId - Customer or vendor ID
 * @param {string} partyType - 'CUSTOMER' or 'VENDOR'
 * @returns {number} Calculated balance in paisa (integer)
 */
export function recalculateBalance(db, partyId, partyType) {
    // Sum all invoices for this party (in paisa)
    const invoiceStmt = db.prepare(`
    SELECT COALESCE(SUM(it.grand_total_paisa), 0) as total_invoiced
    FROM invoices i
    JOIN invoice_totals it ON i.id = it.invoice_id
    WHERE i.customer_id = ? AND i.deleted_at IS NULL
  `);

    const { total_invoiced } = invoiceStmt.get(partyId);

    // Sum all payments for this party (in paisa)
    const paymentStmt = db.prepare(`
    SELECT COALESCE(SUM(amount_paisa), 0) as total_paid
    FROM payments
    WHERE party_id = ? AND party_type = ?
  `);

    const { total_paid } = paymentStmt.get(partyId, partyType);

    return total_invoiced - total_paid; // Integer paisa
}
