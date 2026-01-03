import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { injectShopScope } from '../middleware/shopScope.js';
import { generateHomeSnapshot } from '../services/home/homeSnapshot.service.js';

const router = express.Router();

// In-memory cache with TTL (5 minutes)
const cache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;

// All routes require authentication and shop scope
router.use(authenticateToken);
router.use(injectShopScope);

/**
 * @swagger
 * /api/home/snapshot:
 *   get:
 *     summary: Get aggregated home screen data
 *     description: Returns business metrics, risk summary, activity cards, and momentum
 *     tags: [Home]
 */
router.get('/snapshot', (req, res, next) => {
    try {
        const cacheKey = `snapshot:${req.shopId}`;
        const cached = cache.get(cacheKey);

        // Check cache validity
        if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
            return res.json(cached.data);
        }

        // Generate fresh snapshot
        const snapshot = generateHomeSnapshot(req.shopId);

        // Cache result
        cache.set(cacheKey, {
            data: snapshot,
            timestamp: Date.now()
        });

        res.json(snapshot);
    } catch (error) {
        next(error);
    }
});

/**
 * Bust cache for a shop (internal use by other services)
 * @param {string} shopId - Shop UUID
 */
export function bustHomeCache(shopId) {
    const cacheKey = `snapshot:${shopId}`;
    const deleted = cache.delete(cacheKey);

    if (deleted) {
        console.log(`[Cache] Busted home snapshot cache for shop: ${shopId}`);
    }
}

export default router;
