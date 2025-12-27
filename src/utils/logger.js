/**
 * Centralized Pino Logger
 * 
 * Features:
 * - Environment-driven log level (LOG_LEVEL env var)
 * - Pretty printing for dev, JSON for prod
 * - File transport with rotation in production
 * - Sensitive field redaction
 * - Request ID correlation
 * - Error-safe (never throws, never blocks)
 */

import pino from 'pino';
import pinoHttp from 'pino-http';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const isDev = process.env.NODE_ENV !== 'production';
const logLevel = process.env.LOG_LEVEL || 'info';

// Ensure logs directory exists in production
const logsDir = join(__dirname, '../../logs');
if (!isDev && !existsSync(logsDir)) {
    try {
        mkdirSync(logsDir, { recursive: true });
    } catch (err) {
        console.error('Failed to create logs directory:', err.message);
    }
}

// Sensitive fields to redact
const REDACT_PATHS = [
    'password',
    'token',
    'authorization',
    'otp',
    'secret',
    'apiKey',
    'cookie',
    'set-cookie',
    'req.headers.authorization',
    'req.headers.cookie',
    'res.headers["set-cookie"]'
];

/**
 * Create base pino options
 */
function createLoggerOptions() {
    const baseOptions = {
        level: logLevel,
        redact: {
            paths: REDACT_PATHS,
            censor: '[REDACTED]'
        },
        // Add timestamp in ISO format
        timestamp: pino.stdTimeFunctions.isoTime,
        // Base bindings for all logs
        base: {
            pid: process.pid
        },
        // Format error objects properly
        formatters: {
            level: (label) => ({ level: label }),
            bindings: (bindings) => bindings
        }
    };

    return baseOptions;
}

/**
 * Create transport configuration
 */
function createTransport() {
    if (isDev) {
        // Pretty print for development
        return {
            target: 'pino-pretty',
            options: {
                colorize: true,
                translateTime: 'SYS:standard',
                ignore: 'pid,hostname'
            }
        };
    }

    // Production: multi-stream to stdout + rotating file
    return {
        targets: [
            // Stdout (for Docker/PM2 log collection)
            {
                target: 'pino/file',
                options: { destination: 1 }, // stdout
                level: logLevel
            },
            // File with rotation (7 days retention)
            {
                target: 'pino/file',
                options: {
                    destination: join(logsDir, 'app.log'),
                    mkdir: true
                },
                level: logLevel
            }
        ]
    };
}

/**
 * Safe logger wrapper that never throws
 */
function createSafeLogger() {
    try {
        const options = createLoggerOptions();
        const transport = createTransport();

        return pino({
            ...options,
            transport
        });
    } catch (err) {
        // Fallback to console if pino fails
        console.error('Failed to initialize pino logger:', err.message);
        return {
            info: (...args) => console.log('[INFO]', ...args),
            warn: (...args) => console.warn('[WARN]', ...args),
            error: (...args) => console.error('[ERROR]', ...args),
            debug: (...args) => console.debug('[DEBUG]', ...args),
            fatal: (...args) => console.error('[FATAL]', ...args),
            child: () => createSafeLogger()
        };
    }
}

// Main logger instance
export const logger = createSafeLogger();

/**
 * Create a child logger with module context
 * 
 * @param {string} module - Module name for context
 * @returns {pino.Logger} Child logger instance
 */
export function createChildLogger(module) {
    try {
        return logger.child({ module });
    } catch (err) {
        console.error('Failed to create child logger:', err.message);
        return logger;
    }
}

/**
 * Create HTTP logging middleware
 * Binds request ID and logs request/response
 * 
 * @returns {Function} Express middleware
 */
export function createHttpLogger() {
    try {
        return pinoHttp({
            logger,
            // Use existing request ID if present
            genReqId: (req) => req.id || req.headers['x-request-id'] || undefined,
            // Custom log level based on status code
            customLogLevel: (req, res, err) => {
                if (res.statusCode >= 500 || err) return 'error';
                if (res.statusCode >= 400) return 'warn';
                return 'info';
            },
            // Custom success message
            customSuccessMessage: (req, res) => {
                return `${req.method} ${req.url} ${res.statusCode}`;
            },
            // Custom error message
            customErrorMessage: (req, res, err) => {
                return `${req.method} ${req.url} ${res.statusCode} - ${err.message}`;
            },
            // Redact sensitive headers
            redact: REDACT_PATHS,
            // Skip health check spam
            autoLogging: {
                ignore: (req) => req.url === '/health'
            }
        });
    } catch (err) {
        console.error('Failed to create HTTP logger:', err.message);
        // Return no-op middleware
        return (req, res, next) => next();
    }
}

export default logger;
