const auditLogModel = require('../models/auditLogModel');

// Controller untuk mengambil semua data audit log
const getAuditLogs = async (req, res) => {
  try {
    // Meminta model auditLogModel untuk mengambil semua rekaman dari database
    const logs = await auditLogModel.getAllAuditLogs();
    // Format logs: parse details JSON string and use nice English keys
    const formattedLogs = logs.map(log => {
      let parsedDetails = {};
      try {
        parsedDetails = JSON.parse(log.details);
      } catch (e) {
        // If not valid JSON, just keep the string
        parsedDetails = log.details;
      }
      
      return {
        log_id: log.id,
        transaction_id: log.transaction_id,
        action: log.action,
        details: parsedDetails,
        date_and_time: log.created_at
      };
    });
    
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
