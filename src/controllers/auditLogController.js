const auditLogModel = require('../models/auditLogModel');

// Controller untuk mengambil semua data audit log
const getAuditLogs = async (req, res) => {
  try {
    // Meminta model auditLogModel untuk mengambil semua rekaman dari database
    const logs = await auditLogModel.getAllAuditLogs();
    
    // Format logs: parse details JSON string and use nice English keys
    const formattedLogs = logs.map(log => ({
      log_id: log.log_id,
      transaction_id: log.transaction_id,
      user_name: log.user_name,
      role: log.role,
      action: log.action,
      status: log.status,
      amount: Number(log.amount),
      description: log.description,
      date_and_time: log.date_and_time
    }));
    
    // Mengembalikan response sukses (HTTP 200) beserta datanya ke client
    res.status(200).json({ data: formattedLogs });
  } catch (error) {
    // Jika ada error (misal query database gagal), catat di terminal server
    console.error('Get audit logs error:', error);
    // Kembalikan response error internal server (HTTP 500)
    res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = {
  getAuditLogs
};
