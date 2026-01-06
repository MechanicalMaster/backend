import express from 'express';
import { readFileSync } from 'fs';
import { getDatabase } from '../db/init.js';
import { getAbsolutePath } from '../services/fileService.js';
import { authenticateToken } from '../middleware/auth.js';
import { injectShopScope } from '../middleware/shopScope.js';

const router = express.Router();

// All routes require authentication and shop scope
router.use(authenticateToken);
router.use(injectShopScope);

/**
 * @swagger
 * /api/photos/{id}:
 *   get:
 *     summary: Get photo file
 *     description: Works for both invoice_photos and product_images. Requires authentication.
 *     tags: [Photos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Image file
 *         content:
 *           image/*:
 *             schema:
 *               type: string
 *               format: binary
 *       401:
 *         description: Unauthorized - missing or invalid token
 *       404:
 *         description: Photo not found or not accessible
 */
router.get('/:id', (req, res, next) => {
    try {
        const db = getDatabase();
        const photoId = req.params.id;
        const shopId = req.shopId;

        // Check invoice_photos with shop scope validation
        let photo = db.prepare(`
            SELECT ip.file_path FROM invoice_photos ip
            JOIN invoices i ON ip.invoice_id = i.id
            WHERE ip.id = ? AND i.shop_id = ?
        `).get(photoId, shopId);

        // If not found, check product_images with shop scope validation
        if (!photo) {
            photo = db.prepare(`
                SELECT pi.file_path FROM product_images pi
                JOIN products p ON pi.product_id = p.id
                WHERE pi.id = ? AND p.shop_id = ?
            `).get(photoId, shopId);
        }

        if (!photo) {
            return res.status(404).json({
                error: 'Photo not found',
                requestId: req.requestId
            });
        }

        // Get absolute path (never expose to client)
        const absolutePath = getAbsolutePath(photo.file_path);

        // Read and serve file
        const fileBuffer = readFileSync(absolutePath);

        // Set appropriate content type
        const ext = photo.file_path.split('.').pop().toLowerCase();
        const contentTypes = {
            jpg: 'image/jpeg',
            jpeg: 'image/jpeg',
            png: 'image/png',
            gif: 'image/gif',
            webp: 'image/webp'
        };

        res.setHeader('Content-Type', contentTypes[ext] || 'application/octet-stream');
        res.send(fileBuffer);
    } catch (error) {
        next(error);
    }
});

export default router;
