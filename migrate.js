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

    console.log('Database migration completed successfully!');

    // --- SEEDER: Auto Create Admin & Auditor ---
    const bcrypt = require('bcrypt');
    const userModel = require('./src/models/userModel');
    
    const adminEmail = 'admin@gopay.com';
    const auditorEmail = 'auditor@gopay.com';

    // Cek apakah Admin sudah ada
    const [adminRows] = await pool.query('SELECT id FROM users WHERE email = ?', [adminEmail]);
    if (adminRows.length === 0) {
      const hashedAdmin = await bcrypt.hash('admin123!', 10);
      await userModel.createUser('Super Admin', adminEmail, hashedAdmin, 'admin');
      console.log('Seeder: Admin account (admin@gopay.com) auto-created!');
    }

    // Cek apakah Auditor sudah ada
    const [auditorRows] = await pool.query('SELECT id FROM users WHERE email = ?', [auditorEmail]);
    if (auditorRows.length === 0) {
      const hashedAuditor = await bcrypt.hash('auditor123!', 10);
      await userModel.createUser('Sang Auditor', auditorEmail, hashedAuditor, 'auditor');
      console.log('Seeder: Auditor account (auditor@gopay.com) auto-created!');
    }

    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
