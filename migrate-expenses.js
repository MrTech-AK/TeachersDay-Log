require('dotenv').config();
const { pool } = require('./src/db/index');

async function migrate() {
    try {
        console.log('Migrating expenses table...');
        
        await pool.query(`
            DROP TABLE IF EXISTS expenses CASCADE;
            CREATE SEQUENCE IF NOT EXISTS expense_seq START 1;
            CREATE TABLE expenses (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                expense_code VARCHAR(20) UNIQUE NOT NULL,
                category VARCHAR(50) NOT NULL,
                description TEXT NOT NULL,
                amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
                paid_by VARCHAR(100) NOT NULL,
                receipt_path VARCHAR(255),
                status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected')),
                created_by UUID NOT NULL REFERENCES users(id),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                verified_by UUID REFERENCES users(id),
                verified_at TIMESTAMP WITH TIME ZONE,
                verification_notes TEXT
            );
            CREATE INDEX idx_expenses_status ON expenses(status);
        `);
        console.log('Migration complete');
        process.exit(0);
    } catch(e) {
        console.error(e);
        process.exit(1);
    }
}
migrate();
