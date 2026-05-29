const auditLogModel = require('../models/auditLogModel');

const getAuditLogs = async (req, res) => {
  try {
    const logs = await auditLogModel.getAllAuditLogs();
    res.status(200).json({ data: logs });
  } catch (error) {
    console.error('Get audit logs error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = {
  getAuditLogs
};
