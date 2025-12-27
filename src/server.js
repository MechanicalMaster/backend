import express from 'express';
import cors from 'cors';
import { config } from './config/index.js';
import { initDatabase, closeDatabase } from './db/init.js';
import { errorHandler, notFoundHandler, requestIdMiddleware } from './middleware/errorHandler.js';
import { logger, createHttpLogger } from './utils/logger.js';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger.js';

// Import routes
import invoiceRoutes from './routes/invoices.js';
import customerRoutes from './routes/customers.js';
import productRoutes from './routes/products.js';
import paymentRoutes from './routes/payments.js';
import photoRoutes from './routes/photos.js';
import settingsRoutes from './routes/settings.js';
import categoryRoutes from './routes/categories.js';
import vendorRoutes from './routes/vendors.js';
import purchaseRoutes from './routes/purchases.js';
import attendanceRoutes from './routes/attendance.js';
import authRoutes from './routes/auth.js';

// Initialize Express app
const app = express();

// Initialize database
logger.info('Initializing database...');
initDatabase();
logger.info('Database initialized successfully');

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(requestIdMiddleware);
app.use(createHttpLogger());

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        environment: config.nodeEnv
    });
});

// Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/products', productRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/photos', photoRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api/purchases', purchaseRoutes);
app.use('/api/attendance', attendanceRoutes);

// 404 handler
app.use(notFoundHandler);

// Global error handler (must be last)
app.use(errorHandler);

// Start server
const server = app.listen(config.port, () => {
    logger.info({
        environment: config.nodeEnv,
        port: config.port,
        database: config.databasePath,
        storage: config.storagePath,
        apiBase: `http://localhost:${config.port}/api`,
        health: `http://localhost:${config.port}/health`
    }, '🚀 Swipe Backend Server Running');
});

// Graceful shutdown
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

function shutdown() {
    logger.info('Shutting down gracefully...');

    server.close(() => {
        logger.info('HTTP server closed');
        closeDatabase();
        process.exit(0);
    });

    // Force shutdown after 10 seconds
    setTimeout(() => {
        logger.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
    }, 10000);
}
