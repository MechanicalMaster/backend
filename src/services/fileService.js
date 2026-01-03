import { readFileSync, unlinkSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { config } from '../config/index.js';
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
 * File is already on disk from multer diskStorage
 * This function just calculates checksum and returns metadata
 * 
 * @param {string} filename - Filename (already on disk in uploads/)
 * @returns {Object} { filePath, checksum }
 */
export function savePhoto(filename) {
    // File already written by multer to uploads/ directory
    const absolutePath = join(config.storagePath, 'uploads', filename);

    // Read file to calculate checksum
    // Note: readFileSync is acceptable here - only called once per upload
    const buffer = readFileSync(absolutePath);
    const checksum = calculateChecksum(buffer);

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
    return join(config.storagePath, 'uploads', filename);
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
