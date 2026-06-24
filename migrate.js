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

    // --- ADD COLUMNS TO TRANSACTIONS IF THEY DONT EXIST ---
    try {
      console.log('Checking and adding balance columns to transactions table...');
      await pool.query('ALTER TABLE transactions ADD COLUMN balance_before DECIMAL(15, 2) DEFAULT 0.00, ADD COLUMN balance_after DECIMAL(15, 2) DEFAULT 0.00;');
      
      // Update old transactions to have reasonable values
      console.log('Updating old transaction balances...');
      await pool.query("UPDATE transactions SET balance_before = amount, balance_after = amount + 50000 WHERE balance_before = 0 AND balance_after = 0 AND type != 'topup'");
      await pool.query("UPDATE transactions SET balance_before = 0, balance_after = amount WHERE balance_before = 0 AND balance_after = 0 AND type = 'topup'");
    } catch (e) {
      // Ignored if columns already exist (Duplicate column name)
      if (e.code !== 'ER_DUP_FIELDNAME') {
        console.error('Error adding columns:', e);
      } else {
        console.log('Columns already exist.');
      }
    }

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
      await userModel.createUser('Auditor', auditorEmail, hashedAuditor, 'auditor');
      console.log('Seeder: Auditor account (auditor@gopay.com) auto-created!');
    } else {
      await pool.query('UPDATE users SET name = ? WHERE email = ?', ['Auditor', auditorEmail]);
    }

    // Hapus wallet milik Admin & Auditor jika ada (mereka bukan nasabah, tidak perlu wallet)
    await pool.query(`
      DELETE w FROM wallets w
      JOIN users u ON w.user_id = u.id
      WHERE u.role IN ('admin', 'auditor')
    `);
    console.log('Cleanup: Wallet milik Admin & Auditor berhasil dihapus (jika ada).');

    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
