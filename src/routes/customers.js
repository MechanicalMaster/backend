import express from 'express';
import {
    createCustomer,
    getCustomer,
    listCustomers,
    updateCustomer,
    deleteCustomer
} from '../services/customerService.js';
import { validate, schemas } from '../middleware/validator.js';
import { authenticateToken, adminOnly } from '../middleware/auth.js';
import { injectShopScope } from '../middleware/shopScope.js';

const router = express.Router();

// All routes require authentication and shop scope
router.use(authenticateToken);
router.use(injectShopScope);

/**
 * @swagger
 * /api/customers:
 *   get:
 *     summary: List all customers
 *     tags: [Customers]
 *     responses:
 *       200:
 *         description: List of customers
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Customer'
 */
router.get('/', (req, res, next) => {
    try {
        const customers = listCustomers(req.shopId);
        res.json(customers);
    } catch (error) {
        next(error);
    }
});

/**
 * @swagger
 * /api/customers/{id}:
 *   get:
 *     summary: Get single customer
 *     tags: [Customers]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Customer details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Customer'
 *       404:
 *         description: Customer not found
 */
router.get('/:id', (req, res, next) => {
    try {
        const customer = getCustomer(req.shopId, req.params.id);

        if (!customer) {
            return res.status(404).json({
                error: 'Customer not found',
                requestId: req.requestId
            });
        }

        res.json(customer);
    } catch (error) {
        next(error);
    }
});

/**
 * @swagger
 * /api/customers:
 *   post:
 *     summary: Create new customer
 *     tags: [Customers]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Customer'
 *     responses:
 *       201:
 *         description: Customer created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Customer'
 */
router.post('/', validate(schemas.customer), (req, res, next) => {
    try {
        const customer = createCustomer(req.shopId, req.body, req.user.userId);
        res.status(201).json(customer);
    } catch (error) {
        next(error);
    }
});

/**
 * @swagger
 * /api/customers/{id}:
 *   put:
 *     summary: Update customer
 *     tags: [Customers]
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
 *             $ref: '#/components/schemas/Customer'
 *     responses:
 *       200:
 *         description: Customer updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Customer'
 */
router.put('/:id', validate(schemas.customer), (req, res, next) => {
    try {
        const customer = updateCustomer(req.shopId, req.params.id, req.body, req.user.userId);
        res.json(customer);
    } catch (error) {
        next(error);
    }
});

/**
 * @swagger
 * /api/customers/{id}:
 *   delete:
 *     summary: Soft delete customer (ADMIN only)
 *     tags: [Customers]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       204:
 *         description: Customer deleted
 */
router.delete('/:id', adminOnly, (req, res, next) => {
    try {
        deleteCustomer(req.shopId, req.params.id, req.user.userId);
        res.status(204).send();
    } catch (error) {
        next(error);
    }
});

export default router;
