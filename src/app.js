const express = require('express');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const path = require('path');
const cors = require('cors');
const { pool } = require('./db');
const { securityHeaders, apiLimiter } = require('./middleware/security');
const authRoutes = require('./routes/auth');
const contributionsRoutes = require('./routes/contributions');
const contributorsRoutes = require('./routes/contributors');

const app = express();

// Trust proxy for Heroku/Cloud Run to get correct IPs for rate limiting
app.set('trust proxy', 1);

// Middleware
app.use(securityHeaders);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({
    origin: process.env.APP_URL || 'http://localhost:3000',
    credentials: true
}));

// Session configuration
app.use(session({
    store: new pgSession({
        pool: pool,
        tableName: 'session'
    }),
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
app.use('/api/auth', authRoutes);
app.use('/api/contributions', apiLimiter, contributionsRoutes);
app.use('/api/contributors', apiLimiter, contributorsRoutes);

// Serve static frontend files
app.use(express.static(path.join(__dirname, '../public')));

// Fallback for SPA routing if needed
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Global error handler (prevents stack traces in prod)
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;
