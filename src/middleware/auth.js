import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';

/**
 * JWT authentication middleware
 * Verifies JWT token and attaches user to request
 */
export function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({
            error: 'Authentication required',
            requestId: req.requestId
        });
    }

    try {
        const decoded = jwt.verify(token, config.jwtSecret);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(403).json({
            error: 'Invalid or expired token',
            requestId: req.requestId
        });
    }
}

/**
 * Role-based access control middleware
 * Requires authenticateToken middleware to run first
 */
export function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                error: 'Authentication required',
                requestId: req.requestId
            });
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                error: 'Insufficient permissions',
                requestId: req.requestId
            });
        }

        next();
    };
}
