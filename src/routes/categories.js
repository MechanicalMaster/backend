import express from 'express';
import {
    createCategory,
    getCategory,
    listCategories,
    updateCategory,
    deleteCategory,
    createSubcategory,
    deleteSubcategory
} from '../services/categoryService.js';
import { authenticateToken, adminOnly } from '../middleware/auth.js';
import { injectShopScope } from '../middleware/shopScope.js';

const router = express.Router();

// All routes require authentication and shop scope
router.use(authenticateToken);
router.use(injectShopScope);

/**
 * @swagger
 * /api/categories:
 *   get:
 *     summary: List all categories with subcategories
 *     tags: [Categories]
 */
router.get('/', (req, res, next) => {
    try {
        const categories = listCategories(req.shopId);
        res.json(categories);
    } catch (error) {
        next(error);
    }
});

/**
 * @swagger
 * /api/categories/{id}:
 *   get:
 *     summary: Get single category
 *     tags: [Categories]
 */
router.get('/:id', (req, res, next) => {
    try {
        const category = getCategory(req.shopId, req.params.id);
        if (!category) {
            return res.status(404).json({ error: 'Category not found', requestId: req.requestId });
        }
        res.json(category);
    } catch (error) {
        next(error);
    }
});

/**
 * @swagger
 * /api/categories:
 *   post:
 *     summary: Create new category
 *     tags: [Categories]
 */
router.post('/', (req, res, next) => {
    try {
        const category = createCategory(req.shopId, req.body);
        res.status(201).json(category);
    } catch (error) {
        next(error);
    }
});

/**
 * @swagger
 * /api/categories/{id}:
 *   put:
 *     summary: Update category
 *     tags: [Categories]
 */
router.put('/:id', (req, res, next) => {
    try {
        const category = updateCategory(req.shopId, req.params.id, req.body);
        res.json(category);
    } catch (error) {
        next(error);
    }
});

/**
 * @swagger
 * /api/categories/{id}:
 *   delete:
 *     summary: Delete category (ADMIN only)
 *     tags: [Categories]
 */
router.delete('/:id', adminOnly, (req, res, next) => {
    try {
        deleteCategory(req.shopId, req.params.id);
        res.status(204).send();
    } catch (error) {
        next(error);
    }
});

/**
 * @swagger
 * /api/categories/{id}/subcategories:
 *   post:
 *     summary: Add subcategory to category
 *     tags: [Categories]
 */
router.post('/:id/subcategories', (req, res, next) => {
    try {
        const subcategory = createSubcategory(req.shopId, req.params.id, req.body);
        res.status(201).json(subcategory);
    } catch (error) {
        next(error);
    }
});

/**
 * @swagger
 * /api/categories/{categoryId}/subcategories/{subcategoryId}:
 *   delete:
 *     summary: Delete subcategory (ADMIN only)
 *     tags: [Categories]
 */
router.delete('/:categoryId/subcategories/:subcategoryId', adminOnly, (req, res, next) => {
    try {
        deleteSubcategory(req.shopId, req.params.subcategoryId);
        res.status(204).send();
    } catch (error) {
        next(error);
    }
});

export default router;
