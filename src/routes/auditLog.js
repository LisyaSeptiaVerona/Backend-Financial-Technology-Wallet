const express = require('express');
const router = express.Router();
const auditLogController = require('../controllers/auditLogController');
const authenticateToken = require('../middlewares/auth');
const authorizeRoles = require('../middlewares/role');

// Hanya Admin dan Auditor yang diizinkan untuk melihat semua catatan audit (audit logs)
router.get('/', authenticateToken, authorizeRoles('admin', 'auditor'), auditLogController.getAuditLogs);

module.exports = router;
