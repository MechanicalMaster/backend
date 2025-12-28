/**
 * AdminJS Setup Module
 * 
 * Ops console approach: custom resources backed by services,
 * no DB adapter, global action guards, ADMIN-only auth.
 */

import AdminJS from 'adminjs';
import AdminJSExpress from '@adminjs/express';
import session from 'express-session';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { createChildLogger } from '../utils/logger.js';
import { getDatabase } from '../db/init.js';
import { createBackup, listBackups } from '../services/backupService.js';
import { getRecentLogs } from '../services/logService.js';
import * as customerService from '../services/customerService.js';
import * as vendorService from '../services/vendorService.js';
import * as productService from '../services/productService.js';
import * as invoiceService from '../services/invoiceService.js';
import * as paymentService from '../services/paymentService.js';
import * as settingsService from '../services/settingsService.js';
import { listUsers } from '../services/userService.js';

const adminLogger = createChildLogger('admin');

/**
 * Global action guard - disable all destructive actions
 */
const DISABLED_ACTIONS = ['new', 'edit', 'delete', 'bulkDelete'];

/**
 * Create a virtual resource for AdminJS (no DB adapter)
 * Returns data via service calls
 */
function createVirtualResource(name, options) {
    return {
        id: name,
        name: name,
        ...options,
        actions: {
            // Disable destructive actions globally
            new: { isAccessible: false },
            edit: { isAccessible: false },
            delete: { isAccessible: false },
            bulkDelete: { isAccessible: false },
            ...options.actions
        }
    };
}

/**
 * Setup AdminJS with custom resources
 */
export async function setupAdminJS(app) {
    // Define resources backed by services
    const resources = [];

    // AdminJS configuration
    const adminJs = new AdminJS({
        rootPath: '/admin',
        loginPath: '/admin/login',
        logoutPath: '/admin/logout',
        branding: {
            companyName: 'Swipe Admin',
            softwareBrothers: false,
            logo: false
        },
        dashboard: {
            handler: async () => {
                // Dashboard data
                const db = getDatabase();
                const stats = {
                    users: db.prepare('SELECT COUNT(*) as count FROM users').get().count,
                    customers: db.prepare('SELECT COUNT(*) as count FROM customers WHERE deleted_at IS NULL').get().count,
                    vendors: db.prepare('SELECT COUNT(*) as count FROM vendors WHERE deleted_at IS NULL').get().count,
                    products: db.prepare('SELECT COUNT(*) as count FROM products WHERE deleted_at IS NULL').get().count,
                    invoices: db.prepare('SELECT COUNT(*) as count FROM invoices WHERE deleted_at IS NULL').get().count,
                    payments: db.prepare('SELECT COUNT(*) as count FROM payments').get().count
                };
                return { stats };
            },
            component: false // Use default dashboard
        },
        resources: resources,
        pages: {
            // System status page
            'System Status': {
                handler: async (request, response, context) => {
                    const healthResponse = await fetch(`http://localhost:${config.port}/health`);
                    const health = await healthResponse.json();
                    return { health };
                },
                component: false
            }
        }
    });

    // Custom authenticate function - validates OTP + ADMIN role
    const authenticate = async (email, password) => {
        // For AdminJS, we use phone as email field
        // In local dev, OTP is static '111111'
        const db = getDatabase();
        const user = db.prepare('SELECT * FROM users WHERE phone = ? AND deleted_at IS NULL').get(email);

        if (!user) {
            adminLogger.warn({ phone: email }, 'Admin login attempt - user not found');
            return null;
        }

        // Verify OTP (static for dev)
        if (password !== '111111') {
            adminLogger.warn({ phone: email }, 'Admin login attempt - invalid OTP');
            return null;
        }

        // Check ADMIN role
        if (user.role !== 'ADMIN') {
            adminLogger.warn({ phone: email, role: user.role }, 'Admin login attempt - insufficient permissions (only ADMIN allowed)');
            return null;
        }

        adminLogger.info({ userId: user.id, shopId: user.shop_id, phone: email }, 'Admin login successful');

        return {
            id: user.id,
            email: user.phone,
            role: user.role,
            shopId: user.shop_id
        };
    };

    // Create router with session auth
    const adminRouter = AdminJSExpress.buildAuthenticatedRouter(
        adminJs,
        {
            authenticate,
            cookieName: 'adminjs',
            cookiePassword: config.jwtSecret || 'session-secret-change-me'
        },
        null, // No custom router
        {
            resave: false,
            saveUninitialized: false,
            secret: config.jwtSecret || 'session-secret-change-me',
            cookie: {
                httpOnly: true,
                secure: config.nodeEnv === 'production'
            }
        }
    );

    // Add custom API routes for admin actions
    adminRouter.get('/api/health', (req, res) => {
        if (!req.session || !req.session.adminUser) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        adminLogger.info({ userId: req.session.adminUser.id, requestId: req.requestId }, 'Admin action: health check');

        res.json({
            status: 'ok',
            timestamp: new Date().toISOString(),
            environment: config.nodeEnv,
            database: 'connected'
        });
    });

    adminRouter.post('/api/backup', (req, res) => {
        if (!req.session || !req.session.adminUser) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        try {
            adminLogger.info({ userId: req.session.adminUser.id, requestId: req.requestId }, 'Admin action: trigger backup');
            const backup = createBackup();
            adminLogger.info({ userId: req.session.adminUser.id, backup }, 'Backup created successfully');
            res.json({ success: true, backup });
        } catch (error) {
            adminLogger.error({ error: error.message }, 'Backup failed');
            res.status(500).json({ error: 'Backup failed', message: error.message });
        }
    });

    adminRouter.get('/api/backups', (req, res) => {
        if (!req.session || !req.session.adminUser) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        adminLogger.info({ userId: req.session.adminUser.id }, 'Admin action: list backups');
        const backups = listBackups();
        res.json({ backups });
    });

    adminRouter.get('/api/logs', (req, res) => {
        if (!req.session || !req.session.adminUser) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        adminLogger.info({ userId: req.session.adminUser.id }, 'Admin action: view logs');
        const logs = getRecentLogs();
        res.json(logs);
    });

    // Data browser endpoints (read-only)
    adminRouter.get('/api/data/users', (req, res) => {
        if (!req.session || !req.session.adminUser) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const users = listUsers();
        res.json({ data: users, total: users.length });
    });

    adminRouter.get('/api/data/customers', (req, res) => {
        if (!req.session || !req.session.adminUser) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const customers = customerService.listCustomers();
        res.json({ data: customers, total: customers.length });
    });

    adminRouter.get('/api/data/vendors', (req, res) => {
        if (!req.session || !req.session.adminUser) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const vendors = vendorService.listVendors();
        res.json({ data: vendors, total: vendors.length });
    });

    adminRouter.get('/api/data/products', (req, res) => {
        if (!req.session || !req.session.adminUser) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const products = productService.listProducts();
        res.json({ data: products, total: products.length });
    });

    adminRouter.get('/api/data/invoices', (req, res) => {
        if (!req.session || !req.session.adminUser) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const invoices = invoiceService.listInvoices();
        res.json({ data: invoices, total: invoices.length });
    });

    adminRouter.get('/api/data/payments', (req, res) => {
        if (!req.session || !req.session.adminUser) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const payments = paymentService.listPayments();
        res.json({ data: payments, total: payments.length });
    });

    adminRouter.get('/api/data/settings', (req, res) => {
        if (!req.session || !req.session.adminUser) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const settings = settingsService.getAllSettings();
        res.json({ data: settings });
    });

    // Mount admin router
    app.use(adminJs.options.rootPath, adminRouter);

    adminLogger.info({ rootPath: adminJs.options.rootPath }, 'AdminJS mounted successfully');

    return adminJs;
}
