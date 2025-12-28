import express from 'express';
import cors from 'cors';
import { networkInterfaces } from 'os';
import { config } from './config/index.js';
import { initDatabase, closeDatabase } from './db/init.js';
import { errorHandler, notFoundHandler, requestIdMiddleware } from './middleware/errorHandler.js';
import { logger, createHttpLogger } from './utils/logger.js';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger.js';
import { setupAdminJS } from './admin/index.js';

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
import setupRoutes from './routes/setup.js';

// Initialize Express app
const app = express();

// Initialize database
logger.info('Initializing database...');
initDatabase();
logger.info('Database initialized successfully');

// CORS must come first
app.use(cors());

// AdminJS Panel - MUST be mounted BEFORE body-parser middleware
// to avoid middleware conflicts
(async () => {
    try {
        await setupAdminJS(app);
        logger.info({ adminPath: '/admin' }, 'AdminJS panel initialized');
    } catch (error) {
        logger.error({ error: error.message }, 'Failed to initialize AdminJS');
    }

    // Body-parser middleware (AFTER AdminJS to avoid conflicts)
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
    app.use('/api/setup', setupRoutes);

    // 404 handler (must come after all routes including AdminJS)
    app.use(notFoundHandler);

    // Global error handler (must be last)
    app.use(errorHandler);

    // Helper to get local LAN IP address
    function getLocalIPAddress() {
        const nets = networkInterfaces();
        for (const name of Object.keys(nets)) {
            for (const net of nets[name]) {
                // Skip internal and non-IPv4 addresses
                if (net.family === 'IPv4' && !net.internal) {
                    return net.address;
                }
            }
        }
        return null;
    }

    // Start server
    const server = app.listen(config.port, config.host, () => {
        const lanIP = getLocalIPAddress();
        const lanUrl = lanIP ? `http://${lanIP}:${config.port}` : 'unavailable';

        logger.info({
            environment: config.nodeEnv,
            host: config.host,
            port: config.port,
            database: config.databasePath,
            storage: config.storagePath,
            localUrl: `http://localhost:${config.port}`,
            lanUrl: lanUrl,
            apiBase: `http://localhost:${config.port}/api`,
            health: `http://localhost:${config.port}/health`,
            apiDocs: `http://localhost:${config.port}/api-docs`,
            adminPanel: `http://localhost:${config.port}/admin`
        }, '🚀 Swipe Backend Server Running');

        if (lanIP) {
            logger.info({ lanIP, lanHealth: `${lanUrl}/health`, lanApiDocs: `${lanUrl}/api-docs` }, '📱 LAN Access Available');
        }
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
})();
