import multer from 'multer';
import { randomUUID } from 'crypto';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { config } from '../config/index.js';
import { createChildLogger } from './logger.js';

const uploadLogger = createChildLogger('upload');

// Ensure uploads directory exists
const uploadsDir = join(config.storagePath, 'uploads');
if (!existsSync(uploadsDir)) {
    mkdirSync(uploadsDir, { recursive: true });
    uploadLogger.info({ path: uploadsDir }, 'Created uploads directory');
}

/**
 * Multer disk storage configuration
 * Files are written directly to disk with UUID filenames
 */
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        // Preserve file extension, generate UUID for filename
        const ext = file.originalname.split('.').pop() || 'jpg';
        const filename = `${randomUUID()}.${ext}`;
        cb(null, filename);
    }
});

/**
 * File filter - only allow images
 */
const fileFilter = (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
        const error = new Error('Only image files are allowed');
        error.code = 'INVALID_FILE_TYPE';
        return cb(error, false);
    }
    cb(null, true);
};

/**
 * Shared upload middleware
 * Enforces:
 * - Max file size: 5MB
 * - MIME type: image/* only
 * - Direct disk write (no memory buffering)
 */
export const upload = multer({
    storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB
    },
    fileFilter
});
