import express from 'express';
import { getSetting, setSetting, getAllSettings } from '../services/settingsService.js';
import { authenticateToken, adminOnly } from '../middleware/auth.js';
import { injectShopScope } from '../middleware/shopScope.js';

const router = express.Router();

// All routes require authentication and shop scope
router.use(authenticateToken);
router.use(injectShopScope);

/**
 * @swagger
 * /api/settings:
 *   get:
 *     summary: Get all settings
 *     tags: [Settings]
 */
router.get('/', (req, res, next) => {
    try {
        const settings = getAllSettings(req.shopId);
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
 */
router.get('/:key', (req, res, next) => {
    try {
        const value = getSetting(req.shopId, req.params.key);

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
 *     summary: Set a setting (ADMIN only)
 *     tags: [Settings]
 */
router.put('/:key', adminOnly, (req, res, next) => {
    try {
        const { value } = req.body;

        if (value === undefined) {
            return res.status(400).json({
                error: 'Value is required',
                requestId: req.requestId
            });
        }

        setSetting(req.shopId, req.params.key, value, req.user.userId);
        res.json({ key: req.params.key, value });
    } catch (error) {
        next(error);
    }
});

export default router;
