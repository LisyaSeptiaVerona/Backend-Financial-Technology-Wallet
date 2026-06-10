const express = require('express');
const router = express.Router();
const walletController = require('../controllers/walletController');
const authenticateToken = require('../middlewares/auth');
const authorizeRoles = require('../middlewares/role');

// Route bagi Admin dan Auditor untuk mendapatkan data seluruh wallet pengguna
router.get('/', authenticateToken, authorizeRoles('admin', 'auditor'), walletController.getAllWallets);

// Setiap user yang sudah login bisa mendapatkan data wallet miliknya berdasarkan ID
// (Di dalam controllernya ada pengecekan izin agar user biasa tidak bisa melihat wallet orang lain)
router.get('/:id', authenticateToken, walletController.getWalletById);

module.exports = router;
