import { writeFileSync, unlinkSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { config } from '../config/index.js';
import { generateShortId } from '../utils/uuid.js';
import { calculateChecksum } from '../utils/checksum.js';
import { createChildLogger } from '../utils/logger.js';

const fileLogger = createChildLogger('file');

// Ensure storage directory exists
if (!existsSync(config.storagePath)) {
    mkdirSync(config.storagePath, { recursive: true });
    fileLogger.info({ path: config.storagePath }, 'Created storage directory');
}

/**
 * Save a photo file to disk
 * 
 * @param {Buffer} buffer - File buffer
 * @param {string} originalName - Original filename (for extension)
 * @returns {Object} { filePath, checksum }
 */
export function savePhoto(buffer, originalName = 'photo.jpg') {
    // Extract extension
    const ext = originalName.split('.').pop() || 'jpg';

    // Generate unique filename
    const filename = `${generateShortId()}.${ext}`;
    const filePath = join(config.storagePath, filename);

    // Calculate checksum
    const checksum = calculateChecksum(buffer);

    // Write to disk
    writeFileSync(filePath, buffer);

    // Return relative path (never expose absolute path to client)
    return {
        filePath: filename,  // Store only the filename, not full path
        checksum
    };
}

/**
 * Get absolute file path from stored filename
 * Internal use only - never expose to client
 * 
 * @param {string} filename - Stored filename
 * @returns {string} Absolute path
 */
export function getAbsolutePath(filename) {
    return join(config.storagePath, filename);
}

/**
 * Delete a photo from disk
 * 
 * @param {string} filename - Stored filename
 */
export function deletePhoto(filename) {
    const absolutePath = getAbsolutePath(filename);

    if (existsSync(absolutePath)) {
        unlinkSync(absolutePath);
    }
}

/**
 * Check if a photo exists
 * 
 * @param {string} filename - Stored filename
 * @returns {boolean}
 */
export function photoExists(filename) {
    return existsSync(getAbsolutePath(filename));
}
