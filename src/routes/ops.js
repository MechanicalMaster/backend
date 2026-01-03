import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { injectShopScope } from '../middleware/shopScope.js';
import { createFullBackup, validateBackupFilename, getBackupPath } from '../services/backupService.js';
import { logAction } from '../services/auditService.js';
import { existsSync } from 'fs';

const router = express.Router();

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

export default router;
