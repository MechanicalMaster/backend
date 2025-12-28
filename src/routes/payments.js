import express from 'express';
import {
    createPayment,
    getPayment,
    listPayments,
    deletePayment
} from '../services/paymentService.js';
import { validate, schemas } from '../middleware/validator.js';
import { authenticateToken, adminOnly } from '../middleware/auth.js';
import { injectShopScope } from '../middleware/shopScope.js';

const router = express.Router();

// All routes require authentication and shop scope
router.use(authenticateToken);
router.use(injectShopScope);

/**
 * @swagger
 * /api/payments:
 *   get:
 *     summary: List payments with optional filters
 *     tags: [Payments]
 */
router.get('/', (req, res, next) => {
    try {
        const filters = {
            partyId: req.query.partyId,
            type: req.query.type
        };

        const payments = listPayments(req.shopId, filters);
        res.json(payments);
    } catch (error) {
        next(error);
    }
});

/**
 * @swagger
 * /api/payments/{id}:
 *   get:
 *     summary: Get payment with allocations
 *     tags: [Payments]
 */
router.get('/:id', (req, res, next) => {
    try {
        const payment = getPayment(req.shopId, req.params.id);

        if (!payment) {
            return res.status(404).json({
                error: 'Payment not found',
                requestId: req.requestId
            });
        }

        res.json(payment);
    } catch (error) {
        next(error);
    }
});

/**
 * @swagger
 * /api/payments:
 *   post:
 *     summary: Create payment with allocations
 *     tags: [Payments]
 */
router.post('/', validate(schemas.payment), (req, res, next) => {
    try {
        const payment = createPayment(req.shopId, req.body, req.user.userId);
        res.status(201).json(payment);
    } catch (error) {
        next(error);
    }
});

/**
 * @swagger
 * /api/payments/{id}:
 *   delete:
 *     summary: Delete payment and recalculate balances (ADMIN only)
 *     tags: [Payments]
 */
router.delete('/:id', adminOnly, (req, res, next) => {
    try {
        deletePayment(req.shopId, req.params.id, req.user.userId);
        res.status(204).send();
    } catch (error) {
        next(error);
    }
});

export default router;
