import express from 'express';
import {
    createPayment,
    getPayment,
    listPayments,
    deletePayment
} from '../services/paymentService.js';
import { validate, schemas } from '../middleware/validator.js';

const router = express.Router();

/**
 * @swagger
 * /api/payments:
 *   get:
 *     summary: List payments with optional filters
 *     tags: [Payments]
 *     parameters:
 *       - in: query
 *         name: partyId
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [IN, OUT]
 *     responses:
 *       200:
 *         description: List of payments
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Payment'
 */
router.get('/', (req, res, next) => {
    try {
        const filters = {
            partyId: req.query.partyId,
            type: req.query.type
        };

        const payments = listPayments(filters);
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
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Payment details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Payment'
 *       404:
 *         description: Payment not found
 */
router.get('/:id', (req, res, next) => {
    try {
        const payment = getPayment(req.params.id);

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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Payment'
 *     responses:
 *       201:
 *         description: Payment created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Payment'
 */
router.post('/', validate(schemas.payment), (req, res, next) => {
    try {
        const payment = createPayment(req.body);
        res.status(201).json(payment);
    } catch (error) {
        next(error);
    }
});

/**
 * @swagger
 * /api/payments/{id}:
 *   delete:
 *     summary: Delete payment and recalculate balances
 *     tags: [Payments]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       204:
 *         description: Payment deleted
 */
router.delete('/:id', (req, res, next) => {
    try {
        deletePayment(req.params.id);
        res.status(204).send();
    } catch (error) {
        next(error);
    }
});

export default router;
