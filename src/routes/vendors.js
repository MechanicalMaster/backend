import express from 'express';
import {
    createVendor,
    getVendor,
    listVendors,
    updateVendor,
    deleteVendor
} from '../services/vendorService.js';
import { validate, schemas } from '../middleware/validator.js';
import { authenticateToken, adminOnly } from '../middleware/auth.js';
import { injectShopScope } from '../middleware/shopScope.js';

const router = express.Router();

// All routes require authentication and shop scope
router.use(authenticateToken);
router.use(injectShopScope);

/**
 * @swagger
 * /api/vendors:
 *   get:
 *     summary: List all vendors
 *     tags: [Vendors]
 *     responses:
 *       200:
 *         description: List of vendors
 */
router.get('/', (req, res, next) => {
    try {
        const vendors = listVendors(req.shopId);
        res.json(vendors);
    } catch (error) {
        next(error);
    }
});

/**
 * @swagger
 * /api/vendors/{id}:
 *   get:
 *     summary: Get single vendor
 *     tags: [Vendors]
 */
router.get('/:id', (req, res, next) => {
    try {
        const vendor = getVendor(req.shopId, req.params.id);
        if (!vendor) {
            return res.status(404).json({ error: 'Vendor not found', requestId: req.requestId });
        }
        res.json(vendor);
    } catch (error) {
        next(error);
    }
});

/**
 * @swagger
 * /api/vendors:
 *   post:
 *     summary: Create new vendor
 *     tags: [Vendors]
 */
router.post('/', validate(schemas.vendor), (req, res, next) => {
    try {
        const vendor = createVendor(req.shopId, req.body, req.user.userId);
        res.status(201).json(vendor);
    } catch (error) {
        next(error);
    }
});

/**
 * @swagger
 * /api/vendors/{id}:
 *   put:
 *     summary: Update vendor
 *     tags: [Vendors]
 */
router.put('/:id', validate(schemas.vendor), (req, res, next) => {
    try {
        const vendor = updateVendor(req.shopId, req.params.id, req.body, req.user.userId);
        res.json(vendor);
    } catch (error) {
        next(error);
    }
});

/**
 * @swagger
 * /api/vendors/{id}:
 *   delete:
 *     summary: Soft delete vendor (ADMIN only)
 *     tags: [Vendors]
 */
router.delete('/:id', adminOnly, (req, res, next) => {
    try {
        deleteVendor(req.shopId, req.params.id, req.user.userId);
        res.status(204).send();
    } catch (error) {
        next(error);
    }
});

export default router;
