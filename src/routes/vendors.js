import express from 'express';
import {
    createVendor,
    getVendor,
    listVendors,
    updateVendor,
    deleteVendor
} from '../services/vendorService.js';
import { validate, schemas } from '../middleware/validator.js';

const router = express.Router();

/**
 * @swagger
 * /api/vendors:
 *   get:
 *     summary: List all vendors
 *     tags: [Vendors]
 *     responses:
 *       200:
 *         description: List of vendors
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Vendor'
 */
router.get('/', (req, res, next) => {
    try {
        const vendors = listVendors();
        res.json(vendors);
    } catch (error) {
        next(error);
    }
});

/**
 * @swagger
 * /api/vendors/{id}:
 *   get:
 *     summary: Get single vendor
 *     tags: [Vendors]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Vendor details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Vendor'
 *       404:
 *         description: Vendor not found
 */
router.get('/:id', (req, res, next) => {
    try {
        const vendor = getVendor(req.params.id);
        if (!vendor) {
            return res.status(404).json({ error: 'Vendor not found', requestId: req.requestId });
        }
        res.json(vendor);
    } catch (error) {
        next(error);
    }
});

/**
 * @swagger
 * /api/vendors:
 *   post:
 *     summary: Create new vendor
 *     tags: [Vendors]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Vendor'
 *     responses:
 *       201:
 *         description: Vendor created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Vendor'
 */
router.post('/', validate(schemas.vendor), (req, res, next) => {
    try {
        const vendor = createVendor(req.body);
        res.status(201).json(vendor);
    } catch (error) {
        next(error);
    }
});

/**
 * @swagger
 * /api/vendors/{id}:
 *   put:
 *     summary: Update vendor
 *     tags: [Vendors]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Vendor'
 *     responses:
 *       200:
 *         description: Vendor updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Vendor'
 */
router.put('/:id', validate(schemas.vendor), (req, res, next) => {
    try {
        const vendor = updateVendor(req.params.id, req.body);
        res.json(vendor);
    } catch (error) {
        next(error);
    }
});

/**
 * @swagger
 * /api/vendors/{id}:
 *   delete:
 *     summary: Soft delete vendor
 *     tags: [Vendors]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       204:
 *         description: Vendor deleted
 */
router.delete('/:id', (req, res, next) => {
    try {
        deleteVendor(req.params.id);
        res.status(204).send();
    } catch (error) {
        next(error);
    }
});

export default router;
