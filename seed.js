const bcrypt = require('bcrypt');
const db = require('./src/db');

async function seed() {
    console.log('Seeding database...');
    
    // Clear existing
    await db.query('DELETE FROM audit_logs');
    await db.query('DELETE FROM expenses');
    await db.query('DELETE FROM contributions');
    await db.query('DELETE FROM contributors');
    await db.query('DELETE FROM users');
    
    // 1. Create Users
    const adminHash = await bcrypt.hash('admin123', 10);
    const collectorHash = await bcrypt.hash('collector123', 10);
    
    const akshat = (await db.query(
        "INSERT INTO users (username, password_hash, role, full_name) VALUES ('akshat', $1, 'admin', 'Akshat Admin') RETURNING id",
        [adminHash]
    )).rows[0].id;
    
    const sakshi = (await db.query(
        "INSERT INTO users (username, password_hash, role, full_name) VALUES ('sakshi', $1, 'collector', 'Sakshi Collector') RETURNING id",
        [collectorHash]
    )).rows[0].id;
    
    const varuni = (await db.query(
        "INSERT INTO users (username, password_hash, role, full_name) VALUES ('varuni', $1, 'collector', 'Varuni Collector') RETURNING id",
        [collectorHash]
    )).rows[0].id;
    
    // 2. Create Contributors
    const contrib1 = (await db.query(
        "INSERT INTO contributors (name, class, section, expected_amount) VALUES ('Student A', '10', 'A', 500) RETURNING id"
    )).rows[0].id;
    
    const contrib2 = (await db.query(
        "INSERT INTO contributors (name, class, section, expected_amount) VALUES ('Student B', '10', 'B', 500) RETURNING id"
    )).rows[0].id;

    const contrib3 = (await db.query(
        "INSERT INTO contributors (name, class, section, expected_amount) VALUES ('Student C', '11', 'A', 1000) RETURNING id"
    )).rows[0].id;
    
    // 3. Create Contributions
    await db.query("SELECT nextval('contribution_seq')");
    await db.query(
        "INSERT INTO contributions (transaction_code, contributor_id, amount, collected_by, payment_method, upi_reference) VALUES ('CON-000001', $1, 200, $2, 'Cash', NULL)",
        [contrib1, sakshi]
    ); // Partial
    
    await db.query("SELECT nextval('contribution_seq')");
    await db.query(
        "INSERT INTO contributions (transaction_code, contributor_id, amount, collected_by, payment_method, upi_reference) VALUES ('CON-000002', $1, 500, $2, 'UPI', 'UPI123456789')",
        [contrib2, varuni]
    ); // Paid
    
    // 4. Create Expenses
    await db.query("SELECT nextval('expense_seq')");
    await db.query(
        "INSERT INTO expenses (expense_code, category, description, amount, paid_by, status, created_by, verified_by, verified_at, verification_notes) VALUES ('EXP-000001', 'Decorations', 'Event decorations', 100, 'Sakshi', 'verified', $1, $2, CURRENT_TIMESTAMP, 'Looks good')",
        [sakshi, akshat]
    );
    
    console.log('Database seeded successfully!');
    process.exit(0);
}

seed().catch(err => {
    console.error(err);
    process.exit(1);
});
