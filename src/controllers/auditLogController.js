const auditLogModel = require('../models/auditLogModel');

// Controller untuk mengambil semua data audit log
const getAuditLogs = async (req, res) => {
  try {
    // Meminta model auditLogModel untuk mengambil semua rekaman dari database
    const logs = await auditLogModel.getAllAuditLogs();
    
    // Mengembalikan response sukses (HTTP 200) beserta datanya ke client
    res.status(200).json({ data: logs });
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
