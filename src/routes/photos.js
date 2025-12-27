import express from 'express';
import { readFileSync } from 'fs';
import { getDatabase } from '../db/init.js';
import { getAbsolutePath } from '../services/fileService.js';

const router = express.Router();

/**
 * @swagger
 * /api/photos/{id}:
 *   get:
 *     summary: Get photo file
 *     description: Works for both invoice_photos and product_images
 *     tags: [Photos]
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
 *       404:
 *         description: Photo not found
 */
router.get('/:id', (req, res, next) => {
    try {
        const db = getDatabase();
        const photoId = req.params.id;

        // Check invoice_photos
        let photo = db.prepare(`
      SELECT file_path FROM invoice_photos WHERE id = ?
    `).get(photoId);

        // If not found, check product_images
        if (!photo) {
            photo = db.prepare(`
        SELECT file_path FROM product_images WHERE id = ?
      `).get(photoId);
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
