import crypto from 'crypto';

/**
 * Calculate SHA-256 checksum of a file buffer
 * @param {Buffer} buffer - File buffer
 * @returns {string} Hexadecimal checksum
 */
export function calculateChecksum(buffer) {
    return crypto.createHash('sha256').update(buffer).digest('hex');
}
