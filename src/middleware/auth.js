// Middleware to check if user is authenticated
const requireAuth = (req, res, next) => {
    if (req.session && req.session.userId) {
        return next();
    }
    return res.status(401).json({ error: 'Unauthorized: Please log in' });
};

// Middleware for role-based access control
const requireRole = (roles) => {
    return (req, res, next) => {
        if (!req.session || !req.session.userId) {
            return res.status(401).json({ error: 'Unauthorized: Please log in' });
        }
        
        if (!roles.includes(req.session.role)) {
            return res.status(403).json({ error: 'Forbidden: Insufficient privileges' });
        }
        
        next();
    };
};

module.exports = {
    requireAuth,
    requireRole
};
