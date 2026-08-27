const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Get contributions for the logged-in collector
router.get('/my-activity', requireAuth, async (req, res) => {
    try {
        const query = `
            SELECT c.id, c.transaction_code, c.amount, c.payment_method, 
                   c.upi_reference, c.note, c.created_at,
                   ct.name as contributor_name, ct.class, ct.section
            FROM contributions c
            JOIN contributors ct ON c.contributor_id = ct.id
            WHERE c.collected_by = $1
            ORDER BY c.created_at DESC
            LIMIT 50
        `;
        const result = await db.query(query, [req.session.userId]);
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching activity:', err);
        res.status(500).json({ error: 'Failed to fetch activity' });
    }
});

// Create a new contribution
router.post('/', requireAuth, async (req, res) => {
    const client = await db.pool.connect();
    try {
        let { contributor_id, amount, payment_method, upi_reference, note } = req.body;
        
        // 1. Validation
        if (!contributor_id || typeof contributor_id !== 'string' || contributor_id.length > 36) {
            return res.status(400).json({ error: 'Invalid or missing contributor' });
        }
        
        const numAmount = parseFloat(amount);
        if (isNaN(numAmount) || numAmount <= 0 || numAmount > 100000) { // arbitrary reasonable limit
            return res.status(400).json({ error: 'Invalid amount' });
        }
        
        if (!['UPI', 'Cash'].includes(payment_method)) {
            return res.status(400).json({ error: 'Invalid payment method' });
        }
        
        if (payment_method === 'UPI') {
            if (!upi_reference || typeof upi_reference !== 'string' || upi_reference.trim().length === 0 || upi_reference.length > 50) {
                return res.status(400).json({ error: 'Invalid UPI reference' });
            }
        } else {
            upi_reference = null;
        }

        if (note && (typeof note !== 'string' || note.length > 500)) {
            return res.status(400).json({ error: 'Note is too long or invalid' });
        }

        const collected_by = req.session.userId; // NEVER trust client for this

        await client.query('BEGIN');

        // Check if contributor exists and lock the row to prevent race conditions on duplicate check
        const contribCheck = await client.query('SELECT id FROM contributors WHERE id = $1 FOR UPDATE', [contributor_id]);
        if (contribCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Invalid contributor' });
        }

        // Prevent duplicate accidental submissions (same contributor, amount, collector within 2 minutes)
        const dupCheck = await client.query(`
            SELECT id FROM contributions 
            WHERE contributor_id = $1 
              AND amount = $2 
              AND collected_by = $3 
              AND created_at > NOW() - INTERVAL '2 minutes'
        `, [contributor_id, numAmount, collected_by]);
        
        if (dupCheck.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: 'Duplicate submission detected. Please wait before submitting again.' });
        }

        // Generate Transaction Code
        const seqRes = await client.query("SELECT nextval('contribution_seq')");
        const seqNum = seqRes.rows[0].nextval.padStart(6, '0');
        const transaction_code = `CON-${seqNum}`;

        // Insert contribution
        const insertQuery = `
            INSERT INTO contributions (transaction_code, contributor_id, amount, collected_by, payment_method, upi_reference, note)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id, transaction_code, created_at
        `;
        
        const insertRes = await client.query(insertQuery, [
            transaction_code, contributor_id, numAmount, collected_by, payment_method, upi_reference, note
        ]);
        
        const newContribution = insertRes.rows[0];

        // Audit Log
        await client.query(`
            INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values, ip_address)
            VALUES ($1, 'create', 'contribution', $2, $3, $4)
        `, [
            collected_by, 
            newContribution.id, 
            JSON.stringify({ transaction_code, contributor_id, amount: numAmount, payment_method, upi_reference, note }),
            req.ip
        ]);

        await client.query('COMMIT');
        
        res.status(201).json({
            message: 'Contribution recorded successfully',
            contribution: newContribution
        });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error creating contribution:', err);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        client.release();
    }
});

module.exports = router;
