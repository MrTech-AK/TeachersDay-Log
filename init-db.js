require('dotenv').config();
const { pool } = require('./src/db/index');
const fs = require('fs');
const path = require('path');

async function initDb() {
    try {
        console.log('Running schema.sql...');
        const schema = fs.readFileSync(path.join(__dirname, 'src', 'db', 'schema.sql'), 'utf8');
        await pool.query(schema);
        console.log('Schema created successfully');
        process.exit(0);
    } catch(e) {
        console.error(e);
        process.exit(1);
    }
}
initDb();
