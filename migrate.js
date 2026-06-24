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
      await userModel.createUser('Auditor', auditorEmail, hashedAuditor, 'auditor');
      console.log('Seeder: Auditor account (auditor@gopay.com) auto-created!');
    } else {
      await pool.query('UPDATE users SET name = ? WHERE email = ?', ['Auditor', auditorEmail]);
    }

    // --- FORCE EXACT IDs to 1 and 2 ---
    console.log('Forcing exact IDs for Admin (1) and Auditor (2)...');
    try {
      await pool.query('SET FOREIGN_KEY_CHECKS = 0');
      
      const [adminData] = await pool.query('SELECT id FROM users WHERE email = "admin@gopay.com"');
      if (adminData.length > 0 && adminData[0].id !== 1) {
         const oldAdminId = adminData[0].id;
         await pool.query('UPDATE users SET id = 1 WHERE id = ?', [oldAdminId]);
         await pool.query('UPDATE wallets SET id = 1, user_id = 1 WHERE user_id = ?', [oldAdminId]);
      }

      const [auditorData] = await pool.query('SELECT id FROM users WHERE email = "auditor@gopay.com"');
      if (auditorData.length > 0 && auditorData[0].id !== 2) {
         const oldAuditorId = auditorData[0].id;
         await pool.query('UPDATE users SET id = 2 WHERE id = ?', [oldAuditorId]);
         await pool.query('UPDATE wallets SET id = 2, user_id = 2 WHERE user_id = ?', [oldAuditorId]);
      }

      await pool.query('ALTER TABLE users AUTO_INCREMENT = 3');
      await pool.query('ALTER TABLE wallets AUTO_INCREMENT = 3');
      await pool.query('SET FOREIGN_KEY_CHECKS = 1');
      console.log('IDs successfully forced to 1 and 2.');
    } catch (e) {
      console.log('Error forcing IDs:', e);
    }

    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
