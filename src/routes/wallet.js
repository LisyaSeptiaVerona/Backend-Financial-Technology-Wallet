const express = require('express');
const router = express.Router();
const walletController = require('../controllers/walletController');
const authenticateToken = require('../middlewares/auth');
const authorizeRoles = require('../middlewares/role');

// Admin and Auditor route for getting all wallets
router.get('/', authenticateToken, authorizeRoles('admin', 'auditor'), walletController.getAllWallets);

// Any authenticated user can get a wallet by ID (with permission check inside controller)
router.get('/:id', authenticateToken, walletController.getWalletById);

module.exports = router;
