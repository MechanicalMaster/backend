/**
 * Shop Scope Middleware
 * Extracts shopId from authenticated JWT and injects into request context
 * 
 * CRITICAL: This middleware must run AFTER authenticateToken
 * Order: authenticateToken → injectShopScope → role middleware → handler
 */

/**
 * Inject shop scope from JWT into request
 * If shopId is missing after authentication, returns 500 (never falls back to default)
 */
export function injectShopScope(req, res, next) {
    // Only inject if user is authenticated
    if (req.user) {
        if (!req.user.shopId) {
            // SECURITY: Never fall back to a default shop
            return res.status(500).json({
                error: 'Internal error: Shop context missing from token',
                requestId: req.requestId
            });
        }
        req.shopId = req.user.shopId;
    }
    next();
}

/**
 * Require shop scope for protected routes
 * Use this as a safety check on routes that absolutely require shop context
 */
export function requireShopScope(req, res, next) {
    if (!req.shopId) {
        return res.status(500).json({
            error: 'Internal error: Shop scope required but missing',
            requestId: req.requestId
        });
    }
    next();
}
