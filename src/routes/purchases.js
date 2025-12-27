import express from 'express';
import {
    createPurchase,
    getPurchase,
    listPurchases,
    updatePurchase,
    deletePurchase
} from '../services/purchaseService.js';

const router = express.Router();

/**
 * @swagger
 * /api/purchases:
 *   get:
 *     summary: List purchases
 *     tags: [Purchases]
 *     parameters:
 *       - in: query
 *         name: vendorId
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [RECEIVED, PENDING, ORDERED]
 *     responses:
 *       200:
 *         description: List of purchases
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Purchase'
 */
router.get('/', (req, res, next) => {
    try {
        const filters = {
            vendorId: req.query.vendorId,
            status: req.query.status
        };
        const purchases = listPurchases(filters);
        res.json(purchases);
    } catch (error) {
        next(error);
    }
});

/**
 * @swagger
 * /api/purchases/{id}:
 *   get:
 *     summary: Get single purchase
 *     tags: [Purchases]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Purchase details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Purchase'
 *       404:
 *         description: Purchase not found
 */
router.get('/:id', (req, res, next) => {
    try {
        const purchase = getPurchase(req.params.id);
        if (!purchase) {
            return res.status(404).json({ error: 'Purchase not found', requestId: req.requestId });
        }
        res.json(purchase);
    } catch (error) {
        next(error);
    }
});

/**
 * @swagger
 * /api/purchases:
 *   post:
 *     summary: Create new purchase
 *     tags: [Purchases]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Purchase'
 *     responses:
 *       201:
 *         description: Purchase created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Purchase'
 */
router.post('/', (req, res, next) => {
    try {
        const purchase = createPurchase(req.body);
        res.status(201).json(purchase);
    } catch (error) {
        next(error);
    }
});

/**
 * @swagger
 * /api/purchases/{id}:
 *   put:
 *     summary: Update purchase
 *     tags: [Purchases]
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
 *             $ref: '#/components/schemas/Purchase'
 *     responses:
 *       200:
 *         description: Purchase updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Purchase'
 */
router.put('/:id', (req, res, next) => {
    try {
        const purchase = updatePurchase(req.params.id, req.body);
        res.json(purchase);
    } catch (error) {
        next(error);
    }
});

/**
 * @swagger
 * /api/purchases/{id}:
 *   delete:
 *     summary: Soft delete purchase
 *     tags: [Purchases]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       204:
 *         description: Purchase deleted
 */
router.delete('/:id', (req, res, next) => {
    try {
        deletePurchase(req.params.id);
        res.status(204).send();
    } catch (error) {
        next(error);
    }
});

export default router;
