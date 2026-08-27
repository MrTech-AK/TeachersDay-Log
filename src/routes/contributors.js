const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Get all contributors (for selection)
router.get('/', requireAuth, async (req, res) => {
    try {
        const query = `
            SELECT id, name, class_section 
            FROM contributors 
            ORDER BY class_section, name ASC
        `;
        const result = await db.query(query);
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching contributors:', err);
        res.status(500).json({ error: 'Failed to fetch contributors' });
    }
});

module.exports = router;
