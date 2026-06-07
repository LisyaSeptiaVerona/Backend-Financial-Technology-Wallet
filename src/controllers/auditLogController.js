const auditLogModel = require('../models/auditLogModel');

const getAuditLogs = async (req, res) => {
  try {
    const logs = await auditLogModel.getAllAuditLogs();
    // Filter out 'Delete Transaction' logs so they are not visible
    const filteredLogs = logs.filter(log => log.action !== 'Delete Transaction');
    res.status(200).json({ data: filteredLogs });
  } catch (error) {
    console.error('Get audit logs error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = {
  getAuditLogs
};
