const db = require('../config/database');

// Fungsi untuk mencatat aktivitas log audit untuk setiap transaksi yang terjadi
const createAuditLog = async (transactionId, action, details, connection = null) => {
  // Jika ada connection dari transaksi database yang sedang berjalan, gunakan itu. 
  // Jika tidak ada, gunakan default db pool.
  const dbConn = connection || db;
  
  await dbConn.query(
    'INSERT INTO audit_logs (transaction_id, action, details) VALUES (?, ?, ?)',
    // Detail transaksi disimpan dalam format JSON agar fleksibel dan memuat banyak data pendukung
    [transactionId, action, JSON.stringify(details)]
  );
};

// Fungsi untuk mendapatkan seluruh log audit (biasanya untuk kebutuhan Admin / Auditor)
const getAllAuditLogs = async () => {
  // Mengambil data log audit diurutkan dari yang terbaru
  const [rows] = await db.query('SELECT * FROM audit_logs ORDER BY created_at DESC');
  return rows;
};

module.exports = {
  createAuditLog,
  getAllAuditLogs
};
