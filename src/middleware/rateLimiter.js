import rateLimit from 'express-rate-limit';

/**
 * Strict rate limiter for authentication endpoints
 * 10 requests per 10 minutes per IP address
 */
export const authRateLimiter = rateLimit({
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: 10, // Limit each IP to 10 requests per windowMs
    message: {
        error: 'Too many authentication requests from this IP, please try again later.',
        requestId: undefined // Will be populated by handler
    },
    standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
    legacyHeaders: false, // Disable `X-RateLimit-*` headers
    // Custom handler to include requestId
    handler: (req, res) => {
        res.status(429).json({
            error: 'Too many authentication requests from this IP, please try again later.',
            requestId: req.requestId
        });
    }
});

/**
 * General rate limiter for all API endpoints
 * 100 requests per 15 minutes per IP address
 */
export const generalApiRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: {
        error: 'Too many requests from this IP, please try again later.',
        requestId: undefined
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        res.status(429).json({
            error: 'Too many requests from this IP, please try again later.',
            requestId: req.requestId
        });
    }
});
