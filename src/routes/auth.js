const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../db');
const { authLimiter } = require('../middleware/security');

const router = express.Router();

// Login endpoint
router.post('/login', authLimiter, async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }

        const result = await db.query('SELECT id, username, password_hash, role, is_active FROM users WHERE username = $1', [username]);
        
        let user = null;
        let isValid = false;

        if (result.rows.length > 0) {
            user = result.rows[0];
            isValid = await bcrypt.compare(password, user.password_hash);
        } else {
            // Prevent timing attacks
            await bcrypt.compare(password, '$2b$10$dummyDummyDummyDummyDummyDummyDummyDummyDummyDummy');
        }

        if (!user || !isValid) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        if (!user.is_active) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        req.session.regenerate(async (err) => {
            if (err) {
                return res.status(500).json({ error: 'Internal server error' });
            }
            // Set session
            req.session.userId = user.id;
            req.session.role = user.role;
            req.session.username = user.username;

            // Audit log
            await db.query(
                'INSERT INTO audit_logs (user_id, action, entity_type, ip_address) VALUES ($1, $2, $3, $4)',
                [user.id, 'login', 'auth', req.ip]
            );

            res.json({
                message: 'Login successful',
                user: {
                    id: user.id,
                    username: user.username,
                    role: user.role
                }
            });
        });

    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Logout endpoint
router.post('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).json({ error: 'Could not log out' });
        }
        res.clearCookie('connect.sid');
        res.json({ message: 'Logout successful' });
    });
});

// Session check
router.get('/me', (req, res) => {
    if (req.session && req.session.userId) {
        res.json({
            authenticated: true,
            user: {
                id: req.session.userId,
                username: req.session.username,
                role: req.session.role
            }
        });
    } else {
        res.json({ authenticated: false });
    }
});

module.exports = router;
