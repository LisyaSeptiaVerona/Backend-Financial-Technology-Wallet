const db = require('../config/database');

const createAuditLog = async (transactionId, action, details, connection = null) => {
  const dbConn = connection || db;
  await dbConn.query(
    'INSERT INTO audit_logs (transaction_id, action, details) VALUES (?, ?, ?)',
    [transactionId, action, JSON.stringify(details)]
  );
};

const getAllAuditLogs = async () => {
  const [rows] = await db.query('SELECT * FROM audit_logs ORDER BY created_at DESC');
  return rows;
};

module.exports = {
  createAuditLog,
  getAllAuditLogs
};
