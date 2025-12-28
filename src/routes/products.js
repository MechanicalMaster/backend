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
import { authenticateToken, adminOnly } from '../middleware/auth.js';
import { injectShopScope } from '../middleware/shopScope.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// All routes require authentication and shop scope
router.use(authenticateToken);
router.use(injectShopScope);

/**
 * @swagger
 * /api/products:
 *   get:
 *     summary: List products with optional filters
 *     tags: [Products]
 */
router.get('/', (req, res, next) => {
    try {
        const filters = {
            type: req.query.type,
            categoryId: req.query.categoryId
        };

        const products = listProducts(req.shopId, filters);
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
 */
router.get('/:id', (req, res, next) => {
    try {
        const product = getProduct(req.shopId, req.params.id);

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
 */
router.post('/', validate(schemas.product), (req, res, next) => {
    try {
        const product = createProduct(req.shopId, req.body, req.user.userId);
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
 */
router.put('/:id', validate(schemas.product), (req, res, next) => {
    try {
        const product = updateProduct(req.shopId, req.params.id, req.body, req.user.userId);
        res.json(product);
    } catch (error) {
        next(error);
    }
});

/**
 * @swagger
 * /api/products/{id}:
 *   delete:
 *     summary: Soft delete product (ADMIN only)
 *     tags: [Products]
 */
router.delete('/:id', adminOnly, (req, res, next) => {
    try {
        deleteProduct(req.shopId, req.params.id, req.user.userId);
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
        const image = addProductImage(req.shopId, req.params.id, filePath, checksum);

        res.status(201).json(image);
    } catch (error) {
        next(error);
    }
});

/**
 * @swagger
 * /api/products/{productId}/images/{imageId}:
 *   delete:
 *     summary: Delete product image (ADMIN only)
 *     tags: [Products]
 */
router.delete('/:productId/images/:imageId', adminOnly, (req, res, next) => {
    try {
        const filePath = deleteProductImage(req.shopId, req.params.imageId);
        deletePhoto(filePath);

        res.status(204).send();
    } catch (error) {
        next(error);
    }
});

export default router;
