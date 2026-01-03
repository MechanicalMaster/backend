// Type definitions for Home Snapshot API
// These JSDoc typedefs provide IDE autocomplete and documentation

/**
 * @typedef {Object} BusinessPulse
 * @property {number} amountReceivedThisWeek - Total amount received this week
 * @property {number} percentChangeWoW - Week over Week percentage change (1 decimal)
 * @property {number} paymentsCompleted - Number of payments completed this week
 */

/**
 * @typedef {Object} PrimaryAction
 * @property {"INVOICE"|"PURCHASE"|"EXPENSE"} mostUsed - Most frequently used action in last 30 days
 */

/**
 * @typedef {Object} ActivityCard
 * @property {"INVOICE"|"PAYMENT"|"RISK"} type - Card type
 * @property {string} title - Card title
 * @property {string} subtitle - Secondary text (e.g., customer name)
 * @property {number} amount - Monetary amount
 * @property {string} status - Status indicator (e.g., "OVERDUE", "PAID")
 * @property {string} date - ISO date string
 * @property {string} entityId - Invoice/Payment UUID for navigation
 */

/**
 * @typedef {Object} RiskSummary
 * @property {number} unpaidInvoicesCount - Count of unpaid/partial invoices
 * @property {number} unpaidAmount - Total unpaid amount
 */

/**
 * @typedef {Object} Momentum
 * @property {number} invoiceStreakDays - Consecutive days with at least one invoice
 * @property {number} totalSentThisWeek - Number of invoices sent this week
 */

/**
 * @typedef {Object} HomeSnapshot
 * @property {number} snapshotVersion - Snapshot schema version (currently 1)
 * @property {BusinessPulse} businessPulse - Weekly payment metrics
 * @property {PrimaryAction} primaryAction - Most used action
 * @property {ActivityCard[]} recentActivity - Curated activity cards (max 3)
 * @property {RiskSummary} riskSummary - Unpaid invoice summary
 * @property {Momentum} momentum - Invoice creation streak
 * @property {string} generatedAt - ISO timestamp when snapshot was generated
 */

// Export empty object (this file is for types only)
export { };
