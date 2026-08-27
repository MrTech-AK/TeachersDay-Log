const { Pool } = require('pg');
require('dotenv').config();

let poolInstance = null;

function getPool() {
    if (!poolInstance) {
        if (!process.env.DATABASE_URL) {
            console.warn('DATABASE_URL is not set. Database operations will fail.');
            // Do not throw immediately so the server can start, but return a dummy object or throw on query.
            // Returning a dummy pool that throws on query.
            return {
                query: () => { throw new Error('DATABASE_URL is not set. Please configure the database.'); },
                connect: () => { throw new Error('DATABASE_URL is not set. Please configure the database.'); },
                on: () => {}
            };
        }
        poolInstance = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
        });
    }
    return poolInstance;
}

module.exports = {
    query: (text, params) => getPool().query(text, params),
    get pool() {
        return getPool();
    }
};
