import express from 'express';
import {
    logLogin,
    logLogout,
    getAttendanceByDate,
    getAttendanceHistory,
    getAllAttendanceByDate
} from '../services/attendanceService.js';

const router = express.Router();

/**
 * @swagger
 * /api/attendance/login:
 *   post:
 *     summary: Record user login
 *     tags: [Attendance]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userId]
 *             properties:
 *               userId:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       201:
 *         description: Login recorded
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Attendance'
 */
router.post('/login', (req, res, next) => {
    try {
        const { userId } = req.body;
        if (!userId) {
            return res.status(400).json({ error: 'userId is required', requestId: req.requestId });
        }
        const log = logLogin(userId);
        res.status(201).json(log);
    } catch (error) {
        next(error);
    }
});

/**
 * @swagger
 * /api/attendance/logout:
 *   post:
 *     summary: Record user logout
 *     tags: [Attendance]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [logId]
 *             properties:
 *               logId:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       200:
 *         description: Logout recorded
 */
router.post('/logout', (req, res, next) => {
    try {
        const { logId } = req.body;
        if (!logId) {
            return res.status(400).json({ error: 'logId is required', requestId: req.requestId });
        }
        const result = logLogout(logId);
        res.json(result);
    } catch (error) {
        next(error);
    }
});

/**
 * @swagger
 * /api/attendance/user/{userId}:
 *   get:
 *     summary: Get attendance history for a user
 *     tags: [Attendance]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 30
 *     responses:
 *       200:
 *         description: Attendance history
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Attendance'
 */
router.get('/user/:userId', (req, res, next) => {
    try {
        const limit = parseInt(req.query.limit) || 30;
        const history = getAttendanceHistory(req.params.userId, limit);
        res.json(history);
    } catch (error) {
        next(error);
    }
});

/**
 * @swagger
 * /api/attendance/user/{userId}/date/{date}:
 *   get:
 *     summary: Get attendance for a user on a specific date
 *     tags: [Attendance]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: path
 *         name: date
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Attendance logs
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Attendance'
 */
router.get('/user/:userId/date/:date', (req, res, next) => {
    try {
        const logs = getAttendanceByDate(req.params.userId, req.params.date);
        res.json(logs);
    } catch (error) {
        next(error);
    }
});

/**
 * @swagger
 * /api/attendance/date/{date}:
 *   get:
 *     summary: Get all attendance for a date (admin)
 *     tags: [Attendance]
 *     parameters:
 *       - in: path
 *         name: date
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Attendance logs
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Attendance'
 */
router.get('/date/:date', (req, res, next) => {
    try {
        const logs = getAllAttendanceByDate(req.params.date);
        res.json(logs);
    } catch (error) {
        next(error);
    }
});

export default router;
