import crypto from 'crypto';

/**
 * Generate a UUID v4
 * Uses Node.js crypto.randomUUID() for cryptographically secure UUIDs
 */
export function generateUUID() {
    return crypto.randomUUID();
}

/**
 * Generate a URL-safe short ID (for file names)
 */
export function generateShortId() {
    return crypto.randomBytes(16).toString('hex');
}
