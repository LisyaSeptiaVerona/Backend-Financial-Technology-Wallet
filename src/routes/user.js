const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authenticateToken = require('../middlewares/auth');
const authorizeRoles = require('../middlewares/role');

// Route terlindungi, memerlukan token JWT yang valid untuk diakses
router.get('/wallets', authenticateToken, userController.getWallets);

// Route untuk mendapatkan profil lengkap user beserta permissions sesuai role
router.get('/profile', authenticateToken, userController.getProfile);

router.put('/change-password', authenticateToken, userController.changePassword);
router.put('/set-pin', authenticateToken, userController.setPin);

// Route khusus Admin, digunakan untuk memastikan bahwa middleware pengecekan role berfungsi
router.get('/admin-dashboard', authenticateToken, authorizeRoles('admin'), userController.getAdminDashboard);

// Route khusus User, digunakan untuk memastikan bahwa middleware pengecekan role berfungsi
router.get('/user-dashboard', authenticateToken, authorizeRoles('user'), userController.getUserDashboard);

// Route khusus Auditor, digunakan untuk memastikan bahwa middleware pengecekan role berfungsi
router.get('/auditor-dashboard', authenticateToken, authorizeRoles('auditor'), userController.getAuditorDashboard);

// Route khusus Admin untuk membuat user baru dengan role tertentu secara manual
router.post('/', authenticateToken, authorizeRoles('admin'), userController.createUserByAdmin);

// Route khusus Admin untuk menghapus seorang user berdasarkan ID-nya
router.delete('/:id', authenticateToken, authorizeRoles('admin'), userController.deleteUser);

// Route untuk Admin dan Auditor guna mendapatkan daftar seluruh user di sistem
router.get('/', authenticateToken, authorizeRoles('admin', 'auditor'), userController.getAllUsers);

// Route untuk Admin dan Auditor guna melihat semua wallet semua user
router.get('/all-wallets', authenticateToken, authorizeRoles('admin', 'auditor'), userController.getAllWallets);

// Route untuk Admin dan Auditor guna melihat seluruh saldo user (fokus ke data saldo saja)
router.get('/all-wallets-balance', authenticateToken, authorizeRoles('admin', 'auditor'), userController.getAllWalletsBalance);

// Route untuk Admin dan Auditor melihat wallet milik user tertentu berdasarkan ID user
router.get('/:id/wallet', authenticateToken, authorizeRoles('admin', 'auditor'), userController.getWalletByUserId);

// Route khusus Admin untuk memperbarui data user (seperti nama, email, role)
router.put('/:id', authenticateToken, authorizeRoles('admin'), userController.updateUser);

module.exports = router;
