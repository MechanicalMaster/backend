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

const router = express.Router();

/**
 * @swagger
 * /api/categories:
 *   get:
 *     summary: List all categories with subcategories
 *     tags: [Categories]
 *     responses:
 *       200:
 *         description: List of categories
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Category'
 */
router.get('/', (req, res, next) => {
    try {
        const categories = listCategories();
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
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Category details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Category'
 *       404:
 *         description: Category not found
 */
router.get('/:id', (req, res, next) => {
    try {
        const category = getCategory(req.params.id);
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Category'
 *     responses:
 *       201:
 *         description: Category created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Category'
 */
router.post('/', (req, res, next) => {
    try {
        const category = createCategory(req.body);
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
 *             $ref: '#/components/schemas/Category'
 *     responses:
 *       200:
 *         description: Category updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Category'
 */
router.put('/:id', (req, res, next) => {
    try {
        const category = updateCategory(req.params.id, req.body);
        res.json(category);
    } catch (error) {
        next(error);
    }
});

/**
 * @swagger
 * /api/categories/{id}:
 *   delete:
 *     summary: Soft delete category
 *     tags: [Categories]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       204:
 *         description: Category deleted
 */
router.delete('/:id', (req, res, next) => {
    try {
        deleteCategory(req.params.id);
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
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Category ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: Subcategory name
 *     responses:
 *       201:
 *         description: Subcategory created
 */
router.post('/:id/subcategories', (req, res, next) => {
    try {
        const subcategory = createSubcategory(req.params.id, req.body);
        res.status(201).json(subcategory);
    } catch (error) {
        next(error);
    }
});

/**
 * @swagger
 * /api/categories/{categoryId}/subcategories/{subcategoryId}:
 *   delete:
 *     summary: Delete subcategory
 *     tags: [Categories]
 *     parameters:
 *       - in: path
 *         name: categoryId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: path
 *         name: subcategoryId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       204:
 *         description: Subcategory deleted
 */
router.delete('/:categoryId/subcategories/:subcategoryId', (req, res, next) => {
    try {
        deleteSubcategory(req.params.subcategoryId);
        res.status(204).send();
    } catch (error) {
        next(error);
    }
});

export default router;
