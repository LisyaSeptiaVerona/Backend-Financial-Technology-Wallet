const fs = require('fs');
const path = require('path');
const pool = require('./src/config/database');

async function runMigration() {
  try {
    const sqlPath = path.join(__dirname, 'database.sql');
    let sqlFile = fs.readFileSync(sqlPath, 'utf8');

    // Remove CREATE DATABASE and USE statements because Railway already provides a specific database
    sqlFile = sqlFile.replace(/CREATE DATABASE IF NOT EXISTS[^;]+;/g, '');
    sqlFile = sqlFile.replace(/USE[^;]+;/g, '');

    // Split by semicolon to get individual queries
    const queries = sqlFile.split(';').filter(query => query.trim() !== '');

    console.log('Running database migrations...');
    
    for (const query of queries) {
      if (query.trim()) {
        await pool.query(query);
      }
    }
    
    // Patch khusus untuk menghapus kolom deleted_at jika masih ada (terutama di Railway)
    try {
      await pool.query('ALTER TABLE transactions DROP COLUMN deleted_at');
      console.log('Successfully dropped deleted_at column from transactions table');
    } catch (e) {
      if (e.code !== 'ER_CANT_DROP_FIELD_OR_KEY') {
        console.warn('Warning: Could not drop deleted_at column:', e.message);
      }
    }

    console.log('Database migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
