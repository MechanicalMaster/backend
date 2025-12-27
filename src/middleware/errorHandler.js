import crypto from 'crypto';

/**
 * Global error handler middleware
 * Must be registered last in the middleware chain
 */
export function errorHandler(err, req, res, next) {
    console.error('Error:', err);

    // Joi validation errors
    if (err.isJoi) {
        return res.status(400).json({
            error: 'Validation failed',
            details: err.details.map(d => ({
                field: d.path.join('.'),
                message: d.message
            })),
            requestId: req.requestId
        });
    }

    // SQLite constraint errors
    if (err.code && err.code.startsWith('SQLITE_')) {
        return res.status(400).json({
            error: 'Database constraint violation',
            details: err.message,
            requestId: req.requestId
        });
    }

    // Default error
    const statusCode = err.statusCode || 500;
    const message = err.message || 'Internal server error';

    res.status(statusCode).json({
        error: message,
        requestId: req.requestId,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
}

/**
 * 404 Not Found handler
 */
export function notFoundHandler(req, res) {
    res.status(404).json({
        error: 'Endpoint not found',
        requestId: req.requestId
    });
}

/**
 * Request ID middleware
 * Generates a unique ID for each request for tracing
 */
export function requestIdMiddleware(req, res, next) {
    req.requestId = crypto.randomUUID();
    next();
}
