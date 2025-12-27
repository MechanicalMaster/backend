import express from 'express';
import multer from 'multer';
import {
    createProduct,
    getProduct,
    listProducts,
    updateProduct,
    deleteProduct,
    addProductImage,
    deleteProductImage
} from '../services/productService.js';
import { savePhoto, deletePhoto } from '../services/fileService.js';
import { validate, schemas } from '../middleware/validator.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

/**
 * @swagger
 * /api/products:
 *   get:
 *     summary: List products with optional filters
 *     tags: [Products]
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [product, service]
 *         description: Filter by type
 *       - in: query
 *         name: categoryId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by category
 *     responses:
 *       200:
 *         description: List of products
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Product'
 */
router.get('/', (req, res, next) => {
    try {
        const filters = {
            type: req.query.type,
            categoryId: req.query.categoryId
        };

        const products = listProducts(filters);
        res.json(products);
    } catch (error) {
        next(error);
    }
});

/**
 * @swagger
 * /api/products/{id}:
 *   get:
 *     summary: Get product with images
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Product details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Product'
 *       404:
 *         description: Product not found
 */
router.get('/:id', (req, res, next) => {
    try {
        const product = getProduct(req.params.id);

        if (!product) {
            return res.status(404).json({
                error: 'Product not found',
                requestId: req.requestId
            });
        }

        res.json(product);
    } catch (error) {
        next(error);
    }
});

/**
 * @swagger
 * /api/products:
 *   post:
 *     summary: Create new product
 *     tags: [Products]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Product'
 *     responses:
 *       201:
 *         description: Product created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Product'
 */
router.post('/', validate(schemas.product), (req, res, next) => {
    try {
        const product = createProduct(req.body);
        res.status(201).json(product);
    } catch (error) {
        next(error);
    }
});

/**
 * @swagger
 * /api/products/{id}:
 *   put:
 *     summary: Update product
 *     tags: [Products]
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
 *             $ref: '#/components/schemas/Product'
 *     responses:
 *       200:
 *         description: Product updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Product'
 */
router.put('/:id', validate(schemas.product), (req, res, next) => {
    try {
        const product = updateProduct(req.params.id, req.body);
        res.json(product);
    } catch (error) {
        next(error);
    }
});

/**
 * @swagger
 * /api/products/{id}:
 *   delete:
 *     summary: Soft delete product
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       204:
 *         description: Product deleted
 */
router.delete('/:id', (req, res, next) => {
    try {
        deleteProduct(req.params.id);
        res.status(204).send();
    } catch (error) {
        next(error);
    }
});

/**
 * @swagger
 * /api/products/{id}/images:
 *   post:
 *     summary: Upload product image
 *     tags: [Products]
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
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: Image uploaded
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   format: uuid
 *                 url:
 *                   type: string
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 */
router.post('/:id/images', upload.single('image'), (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                error: 'No image file provided',
                requestId: req.requestId
            });
        }

        const { filePath, checksum } = savePhoto(req.file.buffer, req.file.originalname);
        const image = addProductImage(req.params.id, filePath, checksum);

        res.status(201).json(image);
    } catch (error) {
        next(error);
    }
});

/**
 * @swagger
 * /api/products/{productId}/images/{imageId}:
 *   delete:
 *     summary: Delete product image
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: path
 *         name: imageId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       204:
 *         description: Image deleted
 */
router.delete('/:productId/images/:imageId', (req, res, next) => {
    try {
        const filePath = deleteProductImage(req.params.imageId);
        deletePhoto(filePath);

        res.status(204).send();
    } catch (error) {
        next(error);
    }
});

export default router;
