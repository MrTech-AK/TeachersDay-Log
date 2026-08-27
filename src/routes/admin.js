const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// Middleware to ensure admin role for all routes in this file
router.use(requireAuth, requireRole(['admin']));

// 1. Dashboard Overview Stats
router.get('/stats', async (req, res) => {
    try {
        const expectedRes = await db.query('SELECT COALESCE(SUM(expected_amount), 0) as total_expected FROM contributors WHERE is_active = true');
        const totalExpected = parseFloat(expectedRes.rows[0].total_expected);

        const collectedRes = await db.query('SELECT COALESCE(SUM(amount), 0) as total_collected FROM contributions');
        const totalCollected = parseFloat(collectedRes.rows[0].total_collected);

        // Aggregate expenses by status
        const expensesRes = await db.query(`
            SELECT status, COALESCE(SUM(amount), 0) as total 
            FROM expenses 
            GROUP BY status
        `);
        
        let totalVerifiedExpenses = 0;
        let totalPendingExpenses = 0;
        let totalRejectedExpenses = 0;

        expensesRes.rows.forEach(r => {
            const amt = parseFloat(r.total);
            if (r.status === 'verified') totalVerifiedExpenses += amt;
            else if (r.status === 'pending') totalPendingExpenses += amt;
            else if (r.status === 'rejected') totalRejectedExpenses += amt;
        });

        const expectedBalance = totalCollected - totalVerifiedExpenses;
        const totalPending = totalExpected > totalCollected ? totalExpected - totalCollected : 0; 

        // Get category totals for verified expenses
        const categoryRes = await db.query(`
            SELECT category, COALESCE(SUM(amount), 0) as total
            FROM expenses
            WHERE status = 'verified'
            GROUP BY category
            ORDER BY total DESC
        `);

        res.json({
            totalExpected,
            totalCollected,
            totalPending,
            totalVerifiedExpenses,
            totalPendingExpenses,
            totalRejectedExpenses,
            expectedBalance,
            categoryTotals: categoryRes.rows
        });
    } catch (err) {
        console.error('Error fetching admin stats:', err);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

// 2. Collector Summary
router.get('/collectors', async (req, res) => {
    try {
        const query = `
            SELECT 
                u.id, 
                u.username,
                u.full_name,
                COUNT(c.id) as transaction_count,
                COALESCE(SUM(c.amount), 0) as total_collected,
                COALESCE(SUM(CASE WHEN c.payment_method = 'UPI' THEN c.amount ELSE 0 END), 0) as upi_total,
                COALESCE(SUM(CASE WHEN c.payment_method = 'Cash' THEN c.amount ELSE 0 END), 0) as cash_total,
                (SELECT COALESCE(SUM(amount), 0) FROM expenses WHERE created_by = u.id AND status = 'verified') as total_verified_expenses
            FROM users u
            LEFT JOIN contributions c ON u.id = c.collected_by
            WHERE u.role = 'collector'
            GROUP BY u.id, u.username, u.full_name
            ORDER BY u.username
        `;
        const result = await db.query(query);
        const collectors = result.rows.map(row => ({
            ...row,
            ledger_balance: parseFloat(row.total_collected) - parseFloat(row.total_verified_expenses)
        }));
        res.json(collectors);
    } catch (err) {
        console.error('Error fetching collector summary:', err);
        res.status(500).json({ error: 'Failed to fetch collector summary' });
    }
});

// 3. Contributor Management
// Get all contributors with their derived status
router.get('/contributors', async (req, res) => {
    try {
        const query = `
            SELECT 
                ct.id, ct.name, ct.class, ct.section, ct.expected_amount, ct.is_active,
                COALESCE(SUM(c.amount), 0) as total_paid
            FROM contributors ct
            LEFT JOIN contributions c ON ct.id = c.contributor_id
            GROUP BY ct.id
            ORDER BY ct.class, ct.section, ct.name
        `;
        const result = await db.query(query);
        
        // Derive status
        const contributors = result.rows.map(row => {
            let status = 'PENDING';
            const paid = parseFloat(row.total_paid);
            const expected = parseFloat(row.expected_amount);
            
            if (paid >= expected && expected > 0) {
                status = 'PAID';
            } else if (paid > 0) {
                status = 'PARTIAL';
            } else if (paid > 0 && expected === 0) {
                status = 'PAID';
            }

            return {
                ...row,
                status
            };
        });

        res.json(contributors);
    } catch (err) {
        console.error('Error fetching contributors for admin:', err);
        res.status(500).json({ error: 'Failed to fetch contributors' });
    }
});

router.post('/contributors', async (req, res) => {
    try {
        const { name, class: className, section, expected_amount, is_active } = req.body;
        
        if (!name || !className || !section) {
            return res.status(400).json({ error: 'Name, class, and section are required' });
        }
        
        const expected = parseFloat(expected_amount) || 0;
        if (expected < 0) return res.status(400).json({ error: 'Expected amount cannot be negative' });
        
        const insertQuery = `
            INSERT INTO contributors (name, class, section, expected_amount, is_active)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id, name, class, section, expected_amount, is_active
        `;
        
        const result = await db.query(insertQuery, [
            name, className, section, expected, is_active !== false
        ]);
        
        // Audit log
        await db.query(`
            INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values, ip_address)
            VALUES ($1, 'create', 'contributor', $2, $3, $4)
        `, [
            req.session.userId, 
            result.rows[0].id, 
            JSON.stringify(result.rows[0]),
            req.ip
        ]);

        res.status(201).json({ message: 'Contributor added', contributor: result.rows[0] });
    } catch (err) {
        console.error('Error adding contributor:', err);
        res.status(500).json({ error: 'Failed to add contributor' });
    }
});

router.put('/contributors/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, class: className, section, expected_amount, is_active } = req.body;
        
        if (!name || !className || !section) {
            return res.status(400).json({ error: 'Name, class, and section are required' });
        }
        
        const expected = parseFloat(expected_amount) || 0;
        if (expected < 0) return res.status(400).json({ error: 'Expected amount cannot be negative' });
        
        const updateQuery = `
            UPDATE contributors 
            SET name = $1, class = $2, section = $3, expected_amount = $4, is_active = $5
            WHERE id = $6
            RETURNING id, name, class, section, expected_amount, is_active
        `;
        
        const result = await db.query(updateQuery, [
            name, className, section, expected, is_active !== false, id
        ]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Contributor not found' });
        }
        
        // Audit log
        await db.query(`
            INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values, ip_address)
            VALUES ($1, 'update', 'contributor', $2, $3, $4)
        `, [
            req.session.userId, 
            result.rows[0].id, 
            JSON.stringify(result.rows[0]),
            req.ip
        ]);

        res.json({ message: 'Contributor updated', contributor: result.rows[0] });
    } catch (err) {
        console.error('Error updating contributor:', err);
        res.status(500).json({ error: 'Failed to update contributor' });
    }
});

// 4. Contributions Table
router.get('/contributions', async (req, res) => {
    try {
        const query = `
            SELECT 
                c.id, c.transaction_code, c.amount, c.payment_method, c.upi_reference, c.note, c.created_at,
                ct.name as contributor_name, ct.class, ct.section,
                u.full_name as collector_name
            FROM contributions c
            JOIN contributors ct ON c.contributor_id = ct.id
            JOIN users u ON c.collected_by = u.id
            ORDER BY c.created_at DESC
        `;
        const result = await db.query(query);
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching contributions for admin:', err);
        res.status(500).json({ error: 'Failed to fetch contributions' });
    }
});

// 5. Expenses Management
router.get('/expenses', async (req, res) => {
    try {
        const query = `
            SELECT 
                e.id, e.expense_code, e.category, e.description, e.amount, e.paid_by, 
                e.receipt_path, e.status, e.created_at, e.verification_notes,
                u.full_name as created_by_name, u.username as created_by_username,
                v.full_name as verified_by_name
            FROM expenses e
            JOIN users u ON e.created_by = u.id
            LEFT JOIN users v ON e.verified_by = v.id
            ORDER BY e.created_at DESC
        `;
        const result = await db.query(query);
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching admin expenses:', err);
        res.status(500).json({ error: 'Failed to fetch expenses' });
    }
});

router.patch('/expenses/:id/verify', async (req, res) => {
    const client = await db.pool.connect();
    try {
        const { id } = req.params;
        const { status, verification_notes } = req.body;
        
        if (!['verified', 'rejected'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        await client.query('BEGIN');

        // Verify the expense exists and is pending (or allow re-verification, up to business logic, let's allow overwrite but only by admin)
        const expRes = await client.query('SELECT * FROM expenses WHERE id = $1', [id]);
        if (expRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Expense not found' });
        }

        const exp = expRes.rows[0];

        const updateRes = await client.query(`
            UPDATE expenses 
            SET status = $1, verification_notes = $2, verified_by = $3, verified_at = CURRENT_TIMESTAMP
            WHERE id = $4
            RETURNING *
        `, [status, verification_notes, req.session.userId, id]);

        const updatedExp = updateRes.rows[0];

        // Audit Log
        await client.query(`
            INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values, ip_address)
            VALUES ($1, $2, 'expense', $3, $4, $5)
        `, [
            req.session.userId, 
            status, // 'verified' or 'rejected'
            id, 
            JSON.stringify({ status, verification_notes, old_status: exp.status }),
            req.ip
        ]);

        await client.query('COMMIT');
        res.json({ message: `Expense ${status}`, expense: updatedExp });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error verifying expense:', err);
        res.status(500).json({ error: 'Failed to update expense' });
    } finally {
        client.release();
    }
});

// 6. Reconciliation
router.get('/reconciliations', async (req, res) => {
    try {
        const query = `
            SELECT r.*, u.full_name as performed_by_name
            FROM reconciliation_records r
            JOIN users u ON r.performed_by = u.id
            ORDER BY r.created_at DESC
        `;
        const result = await db.query(query);
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching reconciliations:', err);
        res.status(500).json({ error: 'Failed to fetch reconciliations' });
    }
});

router.post('/reconciliations', async (req, res) => {
    const client = await db.pool.connect();
    try {
        const { actual_amount, notes } = req.body;
        const numActual = parseFloat(actual_amount);
        
        if (isNaN(numActual) || numActual < 0) {
            return res.status(400).json({ error: 'Valid actual balance is required' });
        }

        await client.query('BEGIN');

        // Calculate expected balance
        const collectedRes = await client.query('SELECT COALESCE(SUM(amount), 0) as total FROM contributions');
        const expensesRes = await client.query("SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE status = 'verified'");
        
        const expected = parseFloat(collectedRes.rows[0].total) - parseFloat(expensesRes.rows[0].total);
        const discrepancy = numActual - expected;

        const insertRes = await client.query(`
            INSERT INTO reconciliation_records (performed_by, expected_amount, actual_amount, discrepancy, notes)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
        `, [req.session.userId, expected, numActual, discrepancy, notes || '']);

        const record = insertRes.rows[0];

        // Audit Log
        await client.query(`
            INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values, ip_address)
            VALUES ($1, 'create', 'reconciliation', $2, $3, $4)
        `, [
            req.session.userId, 
            record.id, 
            JSON.stringify({ expected_amount: expected, actual_amount: numActual, discrepancy }),
            req.ip
        ]);

        await client.query('COMMIT');
        res.status(201).json({ message: 'Reconciliation recorded', record });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error recording reconciliation:', err);
        res.status(500).json({ error: 'Failed to record reconciliation' });
    } finally {
        client.release();
    }
});

// 7. Audit Logs
router.get('/audit-logs', async (req, res) => {
    try {
        const query = `
            SELECT a.*, u.full_name as actor_name
            FROM audit_logs a
            LEFT JOIN users u ON a.user_id = u.id
            ORDER BY a.created_at DESC
            LIMIT 500
        `;
        const result = await db.query(query);
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching audit logs:', err);
        res.status(500).json({ error: 'Failed to fetch audit logs' });
    }
});

// 8. Reports & Exports
router.get('/reports', async (req, res) => {
    try {
        const report = await generateReportData();
        res.json(report);
    } catch (err) {
        console.error('Error fetching report:', err);
        res.status(500).json({ error: 'Failed to fetch report data' });
    }
});

router.get('/reports/csv', async (req, res) => {
    try {
        const report = await generateReportData();
        
        let csv = 'TEACHERS DAY 2026 - FINANCIAL REPORT\n';
        csv += `Generated On: ${new Date().toISOString()}\n\n`;
        
        csv += '--- SUMMARY ---\n';
        csv += 'Total Expected,Total Collected,Total Pending,Total Verified Expenses,Total Pending Expenses,Total Rejected Expenses,Expected Remaining Balance\n';
        csv += `${report.summary.totalExpected},${report.summary.totalCollected},${report.summary.totalPending},${report.summary.totalVerifiedExpenses},${report.summary.totalPendingExpenses},${report.summary.totalRejectedExpenses},${report.summary.expectedBalance}\n\n`;
        
        csv += '--- CONTRIBUTIONS BY CLASS ---\n';
        csv += 'Class,Total Amount\n';
        report.contributions.byClass.forEach(row => csv += `"${row.class}",${row.total}\n`);
        csv += '\n';

        csv += '--- CONTRIBUTIONS BY COLLECTOR ---\n';
        csv += 'Collector,Total Amount\n';
        report.contributions.byCollector.forEach(row => csv += `"${row.collector}",${row.total}\n`);
        csv += '\n';
        
        csv += '--- CONTRIBUTIONS BY METHOD ---\n';
        csv += 'Method,Total Amount\n';
        report.contributions.byMethod.forEach(row => csv += `"${row.payment_method}",${row.total}\n`);
        csv += '\n';

        csv += '--- EXPENSES BY CATEGORY (VERIFIED ONLY) ---\n';
        csv += 'Category,Total Amount\n';
        report.expenses.byCategory.forEach(row => csv += `"${row.category}",${row.total}\n`);
        csv += '\n';

        csv += '--- EXPENSES BY PAYER (VERIFIED ONLY) ---\n';
        csv += 'Payer,Total Amount\n';
        report.expenses.byPayer.forEach(row => csv += `"${row.paid_by}",${row.total}\n`);
        csv += '\n';

        csv += '--- EXPENSES BY STATUS ---\n';
        csv += 'Status,Total Amount\n';
        report.expenses.byStatus.forEach(row => csv += `"${row.status}",${row.total}\n`);
        csv += '\n';

        csv += '--- LATEST RECONCILIATION ---\n';
        if (report.reconciliation) {
            csv += 'Date,Performed By,Expected Balance,Reported Balance,Difference\n';
            csv += `"${report.reconciliation.created_at}","${report.reconciliation.performed_by_name}",${report.reconciliation.expected_amount},${report.reconciliation.actual_amount},${report.reconciliation.discrepancy}\n`;
        } else {
            csv += 'No reconciliations recorded.\n';
        }

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="td2026_financial_report.csv"');
        res.send(csv);
    } catch (err) {
        console.error('Error generating CSV report:', err);
        res.status(500).send('Failed to generate CSV report');
    }
});

async function generateReportData() {
    // Summary logic (similar to /stats)
    const expectedRes = await db.query('SELECT COALESCE(SUM(expected_amount), 0) as total_expected FROM contributors WHERE is_active = true');
    const totalExpected = parseFloat(expectedRes.rows[0].total_expected);

    const collectedRes = await db.query('SELECT COALESCE(SUM(amount), 0) as total_collected FROM contributions');
    const totalCollected = parseFloat(collectedRes.rows[0].total_collected);

    const expensesRes = await db.query('SELECT status, COALESCE(SUM(amount), 0) as total FROM expenses GROUP BY status');
    
    let totalVerifiedExpenses = 0, totalPendingExpenses = 0, totalRejectedExpenses = 0;
    expensesRes.rows.forEach(r => {
        const amt = parseFloat(r.total);
        if (r.status === 'verified') totalVerifiedExpenses += amt;
        else if (r.status === 'pending') totalPendingExpenses += amt;
        else if (r.status === 'rejected') totalRejectedExpenses += amt;
    });

    const expectedBalance = totalCollected - totalVerifiedExpenses;
    const totalPending = totalExpected > totalCollected ? totalExpected - totalCollected : 0; 

    // Contributions breakdown
    const contribByClass = await db.query('SELECT ct.class, COALESCE(SUM(c.amount), 0) as total FROM contributions c JOIN contributors ct ON c.contributor_id = ct.id GROUP BY ct.class ORDER BY ct.class');
    const contribByCollector = await db.query('SELECT u.full_name as collector, COALESCE(SUM(c.amount), 0) as total FROM contributions c JOIN users u ON c.collected_by = u.id GROUP BY u.full_name ORDER BY u.full_name');
    const contribByMethod = await db.query('SELECT payment_method, COALESCE(SUM(amount), 0) as total FROM contributions GROUP BY payment_method ORDER BY payment_method');

    // Expenses breakdown
    const expByCategory = await db.query("SELECT category, COALESCE(SUM(amount), 0) as total FROM expenses WHERE status = 'verified' GROUP BY category ORDER BY category");
    const expByPayer = await db.query("SELECT paid_by, COALESCE(SUM(amount), 0) as total FROM expenses WHERE status = 'verified' GROUP BY paid_by ORDER BY paid_by");
    const expByStatus = await db.query('SELECT status, COALESCE(SUM(amount), 0) as total FROM expenses GROUP BY status ORDER BY status');

    // Latest reconciliation
    const reconRes = await db.query('SELECT r.*, u.full_name as performed_by_name FROM reconciliation_records r JOIN users u ON r.performed_by = u.id ORDER BY r.created_at DESC LIMIT 1');

    return {
        summary: {
            totalExpected,
            totalCollected,
            totalPending,
            totalVerifiedExpenses,
            totalPendingExpenses,
            totalRejectedExpenses,
            expectedBalance
        },
        contributions: {
            byClass: contribByClass.rows,
            byCollector: contribByCollector.rows,
            byMethod: contribByMethod.rows
        },
        expenses: {
            byCategory: expByCategory.rows,
            byPayer: expByPayer.rows,
            byStatus: expByStatus.rows
        },
        reconciliation: reconRes.rows.length ? reconRes.rows[0] : null
    };
}

module.exports = router;
