const express = require('express');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { upload } = require('../middleware/upload');

const router = express.Router();

// 1. Submit an expense
router.post('/', requireAuth, upload.single('receipt'), async (req, res) => {
    const client = await db.pool.connect();
    try {
        const { category, description, amount, paid_by } = req.body;
        const numAmount = parseFloat(amount);

        if (!category || !description || isNaN(numAmount) || numAmount <= 0 || !paid_by) {
            return res.status(400).json({ error: 'Invalid input' });
        }

        let receipt_path = null;
        if (req.file) {
            receipt_path = req.file.filename;
        }

        await client.query('BEGIN');
        
        // Generate Expense Code
        const seqRes = await client.query("SELECT nextval('expense_seq')");
        const seqNum = seqRes.rows[0].nextval.padStart(6, '0');
        const expense_code = `EXP-${seqNum}`;

        const insertQuery = `
            INSERT INTO expenses (expense_code, category, description, amount, paid_by, receipt_path, status, created_by)
            VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7)
            RETURNING id, expense_code, created_at
        `;
        
        const insertRes = await client.query(insertQuery, [
            expense_code, category, description, numAmount, paid_by, receipt_path, req.session.userId
        ]);
        const newExpense = insertRes.rows[0];

        // Audit Log
        await client.query(`
            INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values, ip_address)
            VALUES ($1, 'create', 'expense', $2, $3, $4)
        `, [
            req.session.userId, 
            newExpense.id, 
            JSON.stringify({ expense_code, category, description, amount: numAmount, paid_by, receipt_path }),
            req.ip
        ]);

        await client.query('COMMIT');
        res.status(201).json({ message: 'Expense submitted successfully', expense: newExpense });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error submitting expense:', err);
        res.status(500).json({ error: 'Failed to submit expense' });
    } finally {
        client.release();
    }
});

// 2. Fetch user's own expenses (for Collectors)
router.get('/my-activity', requireAuth, async (req, res) => {
    try {
        const query = `
            SELECT id, expense_code, category, description, amount, paid_by, receipt_path, status, created_at, verification_notes
            FROM expenses
            WHERE created_by = $1
            ORDER BY created_at DESC
        `;
        const result = await db.query(query, [req.session.userId]);
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching expenses:', err);
        res.status(500).json({ error: 'Failed to fetch expenses' });
    }
});

// 3. Securely serve receipts (Only to Admin or Uploader)
router.get('/receipt/:filename', requireAuth, async (req, res) => {
    try {
        const filename = req.params.filename;
        
        // Prevent path traversal attacks
        if (!/^[a-zA-Z0-9-]+\.[a-zA-Z0-9]+$/.test(filename)) {
            return res.status(400).json({ error: 'Invalid filename' });
        }

        const expRes = await db.query('SELECT created_by FROM expenses WHERE receipt_path = $1', [filename]);
        
        if (expRes.rows.length === 0) {
            return res.status(404).json({ error: 'Receipt not found' });
        }

        // Must be admin or the creator of the expense
        if (req.session.role !== 'admin' && expRes.rows[0].created_by !== req.session.userId) {
            return res.status(403).json({ error: 'Forbidden. You do not have permission to view this receipt.' });
        }

        const safePath = path.join(__dirname, '../../uploads/receipts', filename);
        if (!fs.existsSync(safePath)) {
            return res.status(404).json({ error: 'File not found on server' });
        }

        res.sendFile(safePath);
    } catch (err) {
        console.error('Error serving receipt:', err);
        res.status(500).json({ error: 'Failed to retrieve receipt' });
    }
});

module.exports = router;
