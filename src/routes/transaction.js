const express = require('express');
const router = express.Router();
const transactionController = require('../controllers/transactionController');
const authenticateToken = require('../middlewares/auth');
const authorizeRoles = require('../middlewares/role');

// Transaction operations for authenticated users
router.post('/topup', authenticateToken, transactionController.topUp);
router.post('/transfer', authenticateToken, transactionController.transfer);
router.post('/payment', authenticateToken, transactionController.payment);

// Get transactions (Admin/Auditor see all, User sees own)
router.get('/', authenticateToken, transactionController.getTransactions);

// Admin only routes for managing transactions
router.put('/:id/status', authenticateToken, authorizeRoles('admin'), transactionController.updateTransactionStatus);

module.exports = router;
