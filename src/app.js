const express = require('express');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const { pool } = require('./db');
const { securityHeaders, apiLimiter } = require('./middleware/security');
const authRoutes = require('./routes/auth');
const contributionsRoutes = require('./routes/contributions');
const contributorsRoutes = require('./routes/contributors');
const adminRoutes = require('./routes/admin');
const expensesRoutes = require('./routes/expenses');

// Ensure upload directories exist
const receiptDir = path.join(__dirname, '../uploads/receipts');
if (!fs.existsSync(receiptDir)) {
    fs.mkdirSync(receiptDir, { recursive: true });
}

const app = express();

// Trust proxy for Heroku/Cloud Run to get correct IPs for rate limiting
app.set('trust proxy', 1);

// Middleware
app.use(securityHeaders);
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));
app.use(cors({
    origin: process.env.APP_URL || 'http://localhost:3000',
    credentials: true
}));

// Session configuration
const sessionStore = process.env.DATABASE_URL 
    ? new pgSession({
        pool: pool,
        tableName: 'session'
    }) 
    : new session.MemoryStore();

app.use(session({
    store: sessionStore,
    secret: process.env.SESSION_SECRET || 'fallback_development_secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 12 * 60 * 60 * 1000, // 12 hours
        secure: process.env.NODE_ENV === 'production', // true in production
        httpOnly: true,
        sameSite: 'lax' // lax is generally safe and allows navigation, 'strict' if highly sensitive
    }
}));

// API Routes
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
});
app.use('/api/auth', authRoutes);
app.use('/api/contributions', apiLimiter, contributionsRoutes);
app.use('/api/contributors', apiLimiter, contributorsRoutes);
app.use('/api/expenses', apiLimiter, expensesRoutes);
app.use('/api/admin', apiLimiter, adminRoutes);

// Serve static files via Next.js instead
// app.use(express.static(path.join(__dirname, '../public')));
// app.get('*', ...);

// Global error handler (prevents stack traces in prod)
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;
