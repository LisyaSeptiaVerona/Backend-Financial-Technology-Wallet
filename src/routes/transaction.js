const express = require('express');
const router = express.Router();
const transactionController = require('../controllers/transactionController');
const authenticateToken = require('../middlewares/auth');
const authorizeRoles = require('../middlewares/role');

// Operasi transaksi yang bisa dilakukan oleh user yang sudah login
router.post('/topup', authenticateToken, authorizeRoles('user'), transactionController.topUp);
router.post('/transfer', authenticateToken, authorizeRoles('user'), transactionController.transfer);
router.post('/payment', authenticateToken, authorizeRoles('user'), transactionController.payment);
// Route untuk mendapatkan riwayat transaksi
// Catatan: Admin/Auditor dapat melihat semua transaksi, sedangkan User biasa hanya dapat melihat transaksinya sendiri
router.get('/', authenticateToken, transactionController.getTransactions);

// Route khusus untuk Admin dalam mengelola (memperbarui status) transaksi secara terpisah
router.put('/topup/:id/status', authenticateToken, authorizeRoles('admin'), transactionController.updateTopUpStatus);
router.put('/payment/:id/status', authenticateToken, authorizeRoles('admin'), transactionController.updatePaymentStatus);
router.put('/transfer/:id/status', authenticateToken, authorizeRoles('admin'), transactionController.updateTransferStatus);

// Route khusus untuk Admin dalam mengelola (memperbarui status) sebuah transaksi
router.put('/:id/status', authenticateToken, authorizeRoles('admin'), transactionController.updateTransactionStatus);

module.exports = router;
