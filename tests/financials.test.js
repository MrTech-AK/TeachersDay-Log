const { pool } = require('../src/db');
const request = require('supertest');
const express = require('express');

// Mock db query
jest.mock('../src/db', () => ({
    pool: {
        connect: jest.fn(),
        query: jest.fn()
    },
    query: jest.fn()
}));

const adminRoutes = require('../src/routes/admin');
const app = express();
app.use(express.json());

// Mock session middleware
app.use((req, res, next) => {
    req.session = { userId: 'mock-admin-id', role: 'admin' };
    req.ip = '127.0.0.1';
    next();
});
app.use('/api/admin', adminRoutes);

describe('Financial and Audit System Tests', () => {
    let mockClient;

    beforeEach(() => {
        mockClient = {
            query: jest.fn(),
            release: jest.fn()
        };
        require('../src/db').pool.connect.mockResolvedValue(mockClient);
        require('../src/db').query.mockReset();
    });

    test('balance calculation logic excludes pending/rejected expenses', async () => {
        // Mock /api/admin/stats responses
        const expectedRes = { rows: [{ total_expected: '1000' }] };
        const collectedRes = { rows: [{ total_collected: '800' }] };
        const expensesRes = { rows: [
            { status: 'verified', total: '200' },
            { status: 'pending', total: '50' },
            { status: 'rejected', total: '100' }
        ] };
        const categoryRes = { rows: [] };

        const db = require('../src/db');
        db.query
            .mockResolvedValueOnce(expectedRes)
            .mockResolvedValueOnce(collectedRes)
            .mockResolvedValueOnce(expensesRes)
            .mockResolvedValueOnce(categoryRes);

        const res = await request(app).get('/api/admin/stats');
        expect(res.status).toBe(200);
        expect(res.body.expectedBalance).toBe(600); // 800 - 200
        expect(res.body.totalVerifiedExpenses).toBe(200);
        expect(res.body.totalPendingExpenses).toBe(50);
        expect(res.body.totalRejectedExpenses).toBe(100);
    });

    test('reconciliation detects discrepancy correctly', async () => {
        // Mock transaction for /api/admin/reconciliations POST
        mockClient.query
            .mockResolvedValueOnce() // BEGIN
            .mockResolvedValueOnce({ rows: [{ total: '1000' }] }) // total collected
            .mockResolvedValueOnce({ rows: [{ total: '200' }] }) // verified expenses
            .mockResolvedValueOnce({ rows: [{ id: 'recon-1' }] }) // insert reconciliation
            .mockResolvedValueOnce({ rows: [] }) // insert audit
            .mockResolvedValueOnce(); // COMMIT

        const res = await request(app).post('/api/admin/reconciliations').send({ actual_amount: 750, notes: 'Missing 50' });
        expect(res.status).toBe(201);
        
        // Discrepancy = actual (750) - expected (1000 - 200 = 800) = -50
        const insertReconCall = mockClient.query.mock.calls[3];
        expect(insertReconCall[0]).toContain('INSERT INTO reconciliation_records');
        expect(insertReconCall[1][1]).toBe(800); // expected
        expect(insertReconCall[1][2]).toBe(750); // actual
        expect(insertReconCall[1][3]).toBe(-50); // discrepancy

        // Audit creation
        const insertAuditCall = mockClient.query.mock.calls[4];
        expect(insertAuditCall[0]).toContain('INSERT INTO audit_logs');
        expect(insertAuditCall[0]).toContain('reconciliation');
    });

    test('reconciliation marks as reconciled if difference is 0', async () => {
        mockClient.query
            .mockResolvedValueOnce() // BEGIN
            .mockResolvedValueOnce({ rows: [{ total: '1000' }] }) // total collected
            .mockResolvedValueOnce({ rows: [{ total: '200' }] }) // verified expenses
            .mockResolvedValueOnce({ rows: [{ id: 'recon-2' }] }) // insert reconciliation
            .mockResolvedValueOnce({ rows: [] }) // insert audit
            .mockResolvedValueOnce(); // COMMIT

        const res = await request(app).post('/api/admin/reconciliations').send({ actual_amount: 800 });
        expect(res.status).toBe(201);
        
        // Discrepancy = actual (800) - expected (800) = 0
        const insertReconCall = mockClient.query.mock.calls[3];
        expect(insertReconCall[1][3]).toBe(0); // discrepancy
    });

    test('expense verification creates audit log', async () => {
        mockClient.query
            .mockResolvedValueOnce() // BEGIN
            .mockResolvedValueOnce({ rows: [{ id: 'exp-1', status: 'pending' }] }) // select expense
            .mockResolvedValueOnce({ rows: [{ id: 'exp-1', status: 'verified' }] }) // update expense
            .mockResolvedValueOnce({ rows: [] }) // insert audit
            .mockResolvedValueOnce(); // COMMIT

        const res = await request(app).patch('/api/admin/expenses/exp-1/verify').send({ status: 'verified', verification_notes: 'Looks good' });
        expect(res.status).toBe(200);

        const insertAuditCall = mockClient.query.mock.calls[3];
        expect(insertAuditCall[0]).toContain('INSERT INTO audit_logs');
        expect(insertAuditCall[1][1]).toBe('verified');
        expect(insertAuditCall[0]).toContain('expense');
        expect(insertAuditCall[1][3]).toContain('"status":"verified"');
    });

    test('expense rejection creates audit log', async () => {
        mockClient.query
            .mockResolvedValueOnce() // BEGIN
            .mockResolvedValueOnce({ rows: [{ id: 'exp-2', status: 'pending' }] }) // select expense
            .mockResolvedValueOnce({ rows: [{ id: 'exp-2', status: 'rejected' }] }) // update expense
            .mockResolvedValueOnce({ rows: [] }) // insert audit
            .mockResolvedValueOnce(); // COMMIT

        const res = await request(app).patch('/api/admin/expenses/exp-2/verify').send({ status: 'rejected', verification_notes: 'Missing receipt' });
        expect(res.status).toBe(200);

        const insertAuditCall = mockClient.query.mock.calls[3];
        expect(insertAuditCall[0]).toContain('INSERT INTO audit_logs');
        expect(insertAuditCall[1][1]).toBe('rejected');
    });
});
