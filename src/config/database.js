const mysql = require('mysql2/promise');
require('dotenv').config();

// Membuat connection pool dengan dukungan environment variabel cloud (seperti Railway)
const pool = mysql.createPool({
  host: process.env.DB_HOST || process.env.MYSQLHOST,
  user: process.env.DB_USER || process.env.MYSQLUSER,
  password: process.env.DB_PASSWORD || process.env.MYSQLPASSWORD,
  database: process.env.DB_NAME || process.env.MYSQLDATABASE,
  port: process.env.DB_PORT || process.env.MYSQLPORT,
  
  waitForConnections: true, // Menunggu jika semua koneksi di pool sedang terpakai
  connectionLimit: 10,      // Maksimal 10 koneksi bersamaan untuk mencegah overload
  queueLimit: 0
});

module.exports = pool;