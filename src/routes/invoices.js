import express from 'express';
import multer from 'multer';
import {
    createInvoice,
    assembleInvoice,
    updateInvoice,
    listInvoices,
    deleteInvoice,
    addInvoicePhoto,
    deleteInvoicePhoto
} from '../services/invoiceService.js';
import { savePhoto, deletePhoto } from '../services/fileService.js';
import { validate, schemas } from '../middleware/validator.js';
import { authenticateToken, adminOnly } from '../middleware/auth.js';
import { injectShopScope } from '../middleware/shopScope.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// All routes require authentication and shop scope
router.use(authenticateToken);
router.use(injectShopScope);

/**
 * @swagger
 * /api/invoices:
 *   get:
 *     summary: List all invoices (headers only)
 *     tags: [Invoices]
 */
router.get('/', (req, res, next) => {
    try {
        const invoices = listInvoices(req.shopId);
        res.json(invoices);
    } catch (error) {
        next(error);
    }
});

/**
 * @swagger
 * /api/invoices/{id}:
 *   get:
 *     summary: Get fully assembled invoice aggregate
 *     tags: [Invoices]
 */
router.get('/:id', (req, res, next) => {
    try {
        const invoice = assembleInvoice(req.shopId, req.params.id);

        if (!invoice) {
            return res.status(404).json({
                error: 'Invoice not found',
                requestId: req.requestId
            });
        }

        res.json(invoice);
    } catch (error) {
        next(error);
    }
});

/**
 * @swagger
 * /api/invoices:
 *   post:
 *     summary: Create new invoice
 *     description: Supports X-Request-Id header for idempotency
 *     tags: [Invoices]
 */
router.post('/', validate(schemas.invoice), (req, res, next) => {
    try {
        const requestId = req.headers['x-request-id'] || null;
        const invoice = createInvoice(req.shopId, req.body, requestId, req.user.userId);

        res.status(201).json(invoice);
    } catch (error) {
        next(error);
    }
});

/**
 * PUT /api/invoices/:id
 * Update existing invoice (full replacement)
 */
router.put('/:id', validate(schemas.invoice), (req, res, next) => {
    try {
        const invoice = updateInvoice(req.shopId, req.params.id, req.body, req.user.userId);
        res.json(invoice);
    } catch (error) {
        next(error);
    }
});

/**
 * DELETE /api/invoices/:id
 * Soft delete invoice (ADMIN only)
 */
router.delete('/:id', adminOnly, (req, res, next) => {
    try {
        deleteInvoice(req.shopId, req.params.id, req.user.userId);
        res.status(204).send();
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/invoices/:id/photos
 * Upload invoice photo
 */
router.post('/:id/photos', upload.single('photo'), (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                error: 'No photo file provided',
                requestId: req.requestId
            });
        }

        const { filePath, checksum } = savePhoto(req.file.buffer, req.file.originalname);
        const photo = addInvoicePhoto(req.shopId, req.params.id, filePath, checksum);

        res.status(201).json(photo);
    } catch (error) {
        next(error);
    }
});

/**
 * DELETE /api/invoices/:invoiceId/photos/:photoId
 * Delete invoice photo (ADMIN only)
 */
router.delete('/:invoiceId/photos/:photoId', adminOnly, (req, res, next) => {
    try {
        const filePath = deleteInvoicePhoto(req.shopId, req.params.photoId);
        deletePhoto(filePath);

        res.status(204).send();
    } catch (error) {
        next(error);
    }
});

export default router;
