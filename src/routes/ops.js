import express from 'express';
import multer from 'multer';
import { randomUUID } from 'crypto';
import { join, dirname } from 'path';
import { existsSync, mkdirSync, unlinkSync } from 'fs';
import { fileURLToPath } from 'url';
import { authenticateToken } from '../middleware/auth.js';
import { injectShopScope } from '../middleware/shopScope.js';
import { createFullBackup, validateBackupFilename, getBackupPath, restoreFromBackup } from '../services/backupService.js';
import { logAction } from '../services/auditService.js';
import { createChildLogger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = express.Router();
const opsLogger = createChildLogger('ops');

// Ensure temp uploads directory exists
const tempUploadsDir = join(__dirname, '../../storage/temp_uploads');
if (!existsSync(tempUploadsDir)) {
    mkdirSync(tempUploadsDir, { recursive: true });
}

/**
 * Multer configuration for backup ZIP uploads
 * Uses disk storage to avoid memory issues with large files
 */
const restoreStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, tempUploadsDir);
    },
    filename: (req, file, cb) => {
        const filename = `restore_${randomUUID()}.zip`;
        cb(null, filename);
    }
});

const restoreUpload = multer({
    storage: restoreStorage,
    limits: {
        fileSize: 100 * 1024 * 1024 // 100MB max
    },
    fileFilter: (req, file, cb) => {
        // Accept only ZIP files
        if (file.mimetype === 'application/zip' ||
            file.mimetype === 'application/x-zip-compressed' ||
            file.originalname.toLowerCase().endsWith('.zip')) {
            cb(null, true);
        } else {
            const error = new Error('Only ZIP files are allowed');
            error.code = 'INVALID_FILE_TYPE';
            cb(error, false);
        }
    }
});

// All routes require authentication and shop scope
router.use(authenticateToken);
router.use(injectShopScope);

/**
 * @swagger
 * /api/ops/backup:
 *   post:
 *     summary: Create a full backup (DB + storage) as ZIP
 *     tags: [Operations]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Backup created successfully
 *       409:
 *         description: Backup already in progress
 *       500:
 *         description: Backup creation failed
 */
router.post('/backup', async (req, res, next) => {
    try {
        const metadata = await createFullBackup();

        // Log backup creation to audit trail
        logAction(
            req.shopId,
            'SYSTEM',
            metadata.filename,
            'BACKUP_CREATED',
            { sizeBytes: metadata.sizeBytes },
            req.user.userId
        );

        res.json({
            success: true,
            ...metadata
        });
    } catch (error) {
        // Handle concurrent backup error specifically
        if (error.statusCode === 409) {
            return res.status(409).json({
                error: error.message,
                requestId: req.requestId
            });
        }
        next(error);
    }
});

/**
 * @swagger
 * /api/ops/backup/{filename}:
 *   get:
 *     summary: Download a backup ZIP file
 *     tags: [Operations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: filename
 *         required: true
 *         schema:
 *           type: string
 *         description: Backup filename
 *     responses:
 *       200:
 *         description: Backup file download
 *       400:
 *         description: Invalid filename
 *       404:
 *         description: Backup file not found
 */
router.get('/backup/:filename', (req, res, next) => {
    try {
        const { filename } = req.params;

        // Validate filename to prevent path traversal
        if (!validateBackupFilename(filename)) {
            return res.status(400).json({
                error: 'Invalid backup filename',
                requestId: req.requestId
            });
        }

        // Get safe backup path
        const backupPath = getBackupPath(filename);

        // Check if file exists
        if (!existsSync(backupPath)) {
            return res.status(404).json({
                error: 'Backup file not found',
                requestId: req.requestId
            });
        }

        // Stream file to client
        res.download(backupPath, filename, (err) => {
            if (err) {
                next(err);
            }
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @swagger
 * /api/ops/restore:
 *   post:
 *     summary: Restore from a backup ZIP file (ADMIN only)
 *     tags: [Operations]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               backup:
 *                 type: string
 *                 format: binary
 *                 description: Backup ZIP file
 *     responses:
 *       200:
 *         description: Restore completed, server will restart
 *       400:
 *         description: Invalid backup file or format
 *       403:
 *         description: Admin access required
 *       409:
 *         description: Restore or backup already in progress
 *       415:
 *         description: Only ZIP files allowed
 *       500:
 *         description: Restore failed
 */
router.post('/restore', restoreUpload.single('backup'), async (req, res, next) => {
    let uploadedFilePath = null;

    try {
        // ADMIN-only check
        if (req.user.role !== 'ADMIN') {
            return res.status(403).json({
                error: 'Admin access required for restore operations',
                requestId: req.requestId
            });
        }

        // Check if file was uploaded
        if (!req.file) {
            return res.status(400).json({
                error: 'No backup file uploaded',
                requestId: req.requestId
            });
        }

        uploadedFilePath = req.file.path;
        opsLogger.info({
            uploadedFilePath,
            originalName: req.file.originalname,
            sizeBytes: req.file.size
        }, 'Backup file uploaded for restore');

        // Perform restore
        const metadata = await restoreFromBackup(uploadedFilePath, {
            shopId: req.shopId,
            userId: req.user.userId
        });

        // Clean up uploaded file
        try {
            unlinkSync(uploadedFilePath);
            opsLogger.info({ uploadedFilePath }, 'Cleaned up uploaded backup file');
        } catch (cleanupErr) {
            opsLogger.warn({ cleanupErr }, 'Failed to clean up uploaded file');
        }

        // Send success response
        res.json(metadata);

        // Schedule server exit after response is sent
        // Use setImmediate to ensure response is flushed
        opsLogger.info('Scheduling server exit after restore');
        setImmediate(() => {
            opsLogger.info('Server exiting after successful restore. Restart required.');
            process.exit(0);
        });

    } catch (error) {
        // Clean up uploaded file on error
        if (uploadedFilePath && existsSync(uploadedFilePath)) {
            try {
                unlinkSync(uploadedFilePath);
            } catch (cleanupErr) {
                opsLogger.warn({ cleanupErr }, 'Failed to clean up uploaded file after error');
            }
        }

        // Handle specific error codes
        if (error.statusCode === 400) {
            return res.status(400).json({
                error: error.message,
                requestId: req.requestId
            });
        }
        if (error.statusCode === 409) {
            return res.status(409).json({
                error: error.message,
                requestId: req.requestId
            });
        }
        if (error.code === 'INVALID_FILE_TYPE') {
            return res.status(415).json({
                error: 'Only ZIP files are allowed',
                requestId: req.requestId
            });
        }
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                error: 'File too large. Maximum size is 100MB',
                requestId: req.requestId
            });
        }

        next(error);
    }
});

// Handle multer errors globally for this router
router.use((error, req, res, next) => {
    if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
            error: 'File too large. Maximum size is 100MB',
            requestId: req.requestId
        });
    }
    if (error.code === 'INVALID_FILE_TYPE') {
        return res.status(415).json({
            error: 'Only ZIP files are allowed',
            requestId: req.requestId
        });
    }
    next(error);
});

export default router;

