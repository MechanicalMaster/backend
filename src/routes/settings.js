import express from 'express';
import { getSetting, setSetting, getAllSettings } from '../services/settingsService.js';

const router = express.Router();

/**
 * @swagger
 * /api/settings:
 *   get:
 *     summary: Get all settings
 *     tags: [Settings]
 *     responses:
 *       200:
 *         description: All settings
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               additionalProperties:
 *                 type: object 
 */
router.get('/', (req, res, next) => {
    try {
        const settings = getAllSettings();
        res.json(settings);
    } catch (error) {
        next(error);
    }
});

/**
 * @swagger
 * /api/settings/{key}:
 *   get:
 *     summary: Get single setting
 *     tags: [Settings]
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Setting value
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Setting'
 *       404:
 *         description: Setting not found
 */
router.get('/:key', (req, res, next) => {
    try {
        const value = getSetting(req.params.key);

        if (value === null) {
            return res.status(404).json({
                error: 'Setting not found',
                requestId: req.requestId
            });
        }

        res.json({ key: req.params.key, value });
    } catch (error) {
        next(error);
    }
});

/**
 * @swagger
 * /api/settings/{key}:
 *   put:
 *     summary: Set a setting
 *     tags: [Settings]
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               value:
 *                 oneOf:
 *                   - type: string
 *                   - type: number
 *                   - type: boolean
 *                   - type: object
 *     responses:
 *       200:
 *         description: Setting updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Setting'
 */
router.put('/:key', (req, res, next) => {
    try {
        const { value } = req.body;

        if (value === undefined) {
            return res.status(400).json({
                error: 'Value is required',
                requestId: req.requestId
            });
        }

        setSetting(req.params.key, value);
        res.json({ key: req.params.key, value });
    } catch (error) {
        next(error);
    }
});

export default router;
