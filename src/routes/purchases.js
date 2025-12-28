import express from 'express';
import {
    createPurchase,
    getPurchase,
    listPurchases,
    updatePurchase,
    deletePurchase
} from '../services/purchaseService.js';
import { authenticateToken, adminOnly } from '../middleware/auth.js';
import { injectShopScope } from '../middleware/shopScope.js';

const router = express.Router();

// All routes require authentication and shop scope
router.use(authenticateToken);
router.use(injectShopScope);

/**
 * @swagger
 * /api/purchases:
 *   get:
 *     summary: List purchases
 *     tags: [Purchases]
 */
router.get('/', (req, res, next) => {
    try {
        const filters = {
            vendorId: req.query.vendorId,
            status: req.query.status
        };
        const purchases = listPurchases(req.shopId, filters);
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
 */
router.get('/:id', (req, res, next) => {
    try {
        const purchase = getPurchase(req.shopId, req.params.id);
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
 */
router.post('/', (req, res, next) => {
    try {
        const purchase = createPurchase(req.shopId, req.body, req.user.userId);
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
 */
router.put('/:id', (req, res, next) => {
    try {
        const purchase = updatePurchase(req.shopId, req.params.id, req.body, req.user.userId);
        res.json(purchase);
    } catch (error) {
        next(error);
    }
});

/**
 * @swagger
 * /api/purchases/{id}:
 *   delete:
 *     summary: Soft delete purchase (ADMIN only)
 *     tags: [Purchases]
 */
router.delete('/:id', adminOnly, (req, res, next) => {
    try {
        deletePurchase(req.shopId, req.params.id, req.user.userId);
        res.status(204).send();
    } catch (error) {
        next(error);
    }
});

export default router;
