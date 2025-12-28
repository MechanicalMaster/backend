import express from 'express';
import { requestOTP, verifyOTP, getUser, createUser, listUsers } from '../services/userService.js';
import { authenticateToken, adminOnly } from '../middleware/auth.js';
import { injectShopScope } from '../middleware/shopScope.js';

const router = express.Router();

/**
 * @swagger
 * /api/auth/request-otp:
 *   post:
 *     summary: Request OTP for phone number
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [phone]
 *             properties:
 *               phone:
 *                 type: string
 *     responses:
 *       200:
 *         description: OTP requested
 */
router.post('/request-otp', (req, res, next) => {
    try {
        const { phone } = req.body;

        if (!phone) {
            return res.status(400).json({
                error: 'Phone number is required',
                requestId: req.requestId
            });
        }

        const result = requestOTP(phone);
        res.json(result);
    } catch (error) {
        next(error);
    }
});

/**
 * @swagger
 * /api/auth/verify-otp:
 *   post:
 *     summary: Verify OTP and get JWT token
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [phone, otp]
 *             properties:
 *               phone:
 *                 type: string
 *               otp:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                 user:
 *                   type: object
 */
router.post('/verify-otp', (req, res, next) => {
    try {
        const { phone, otp } = req.body;

        if (!phone || !otp) {
            return res.status(400).json({
                error: 'Phone number and OTP are required',
                requestId: req.requestId
            });
        }

        const result = verifyOTP(phone, otp);
        res.json(result);
    } catch (error) {
        next(error);
    }
});

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Verify OTP and get JWT token
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phone
 *               - otp
 *             properties:
 *               phone:
 *                 type: string
 *                 description: User phone number
 *                 example: "1234567890"
 *               otp:
 *                 type: string
 *                 description: One-time password
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                   description: JWT access token
 *                 user:
 *                   type: object
 *                   description: User details
 *       400:
 *         description: Missing phone or OTP
 *       401:
 *         description: Invalid OTP
 */
router.post('/login', (req, res, next) => {
    try {
        const { phone, otp } = req.body;

        if (!phone || !otp) {
            return res.status(400).json({
                error: 'Phone number and OTP are required',
                requestId: req.requestId
            });
        }

        const result = verifyOTP(phone, otp);
        res.json(result);
    } catch (error) {
        next(error);
    }
});

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Get current user info (requires auth)
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: User profile
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 phone:
 *                   type: string
 *                 role:
 *                   type: string
 */
router.get('/me', authenticateToken, (req, res, next) => {
    try {
        const user = getUser(req.user.userId);
        if (!user) {
            return res.status(404).json({
                error: 'User not found',
                requestId: req.requestId
            });
        }
        res.json(user);
    } catch (error) {
        next(error);
    }
});

/**
 * @swagger
 * /api/auth/users:
 *   get:
 *     summary: List all users in the shop (ADMIN only)
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: List of users
 */
router.get('/users', authenticateToken, injectShopScope, adminOnly, (req, res, next) => {
    try {
        const users = listUsers(req.shopId);
        res.json(users);
    } catch (error) {
        next(error);
    }
});

/**
 * @swagger
 * /api/auth/users:
 *   post:
 *     summary: Create a new user in the shop (ADMIN only)
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [phone]
 *             properties:
 *               phone:
 *                 type: string
 *               name:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [ADMIN, SALES]
 *     responses:
 *       201:
 *         description: User created
 */
router.post('/users', authenticateToken, injectShopScope, adminOnly, (req, res, next) => {
    try {
        const { phone, name, role } = req.body;

        if (!phone) {
            return res.status(400).json({
                error: 'Phone number is required',
                requestId: req.requestId
            });
        }

        if (role && !['ADMIN', 'SALES'].includes(role)) {
            return res.status(400).json({
                error: 'Role must be ADMIN or SALES',
                requestId: req.requestId
            });
        }

        const user = createUser(req.shopId, { phone, name, role });
        res.status(201).json(user);
    } catch (error) {
        next(error);
    }
});

export default router;
