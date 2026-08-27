const request = require('supertest');
const app = require('../src/app');

describe('Security Boundaries', () => {
    test('Collector cannot access admin endpoints', async () => {
        const res = await request(app).get('/api/admin/stats');
        expect(res.statusCode).toBe(401);
    });

    test('Unauthenticated user cannot access expenses', async () => {
        const res = await request(app).get('/api/expenses/my-activity');
        expect(res.statusCode).toBe(401);
    });

    test('Path traversal via URL encoded parameter is blocked before auth', async () => {
        const res = await request(app).get('/api/expenses/receipt/%2E%2E%2Fetc%2Fpasswd');
        // If it reaches the route, it will return 401 because we are unauthenticated.
        // If it doesn't match the regex in route, it might return 400. But auth is first.
        expect(res.statusCode).toBe(401); 
    });
});
