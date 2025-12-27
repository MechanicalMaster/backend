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

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

/**
 * @swagger
 * /api/invoices:
 *   get:
 *     summary: List all invoices (headers only)
 *     tags: [Invoices]
 *     responses:
 *       200:
 *         description: List of invoices
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/InvoiceAggregate'
 */
router.get('/', (req, res, next) => {
    try {
        const invoices = listInvoices();
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
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Invoice ID
 *     responses:
 *       200:
 *         description: Invoice details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InvoiceAggregate'
 *       404:
 *         description: Invoice not found
 */
router.get('/:id', (req, res, next) => {
    try {
        const invoice = assembleInvoice(req.params.id);

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
 *     parameters:
 *       - in: header
 *         name: X-Request-Id
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Idempotency key
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/InvoiceAggregate'
 *     responses:
 *       201:
 *         description: Invoice created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InvoiceAggregate'
 *       400:
 *         description: Validation error
 */
router.post('/', validate(schemas.invoice), (req, res, next) => {
    try {
        const requestId = req.headers['x-request-id'] || null;
        const invoice = createInvoice(req.body, requestId);

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
        const invoice = updateInvoice(req.params.id, req.body);
        res.json(invoice);
    } catch (error) {
        next(error);
    }
});

/**
 * DELETE /api/invoices/:id
 * Soft delete invoice
 */
router.delete('/:id', (req, res, next) => {
    try {
        deleteInvoice(req.params.id);
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
        const photo = addInvoicePhoto(req.params.id, filePath, checksum);

        res.status(201).json(photo);
    } catch (error) {
        next(error);
    }
});

/**
 * DELETE /api/invoices/:invoiceId/photos/:photoId
 * Delete invoice photo
 */
router.delete('/:invoiceId/photos/:photoId', (req, res, next) => {
    try {
        const filePath = deleteInvoicePhoto(req.params.photoId);
        deletePhoto(filePath);

        res.status(204).send();
    } catch (error) {
        next(error);
    }
});

export default router;
