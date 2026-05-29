const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authenticateToken = require('../middlewares/auth');
const authorizeRoles = require('../middlewares/role');

// Protected route, requires valid JWT token
router.get('/profile', authenticateToken, userController.getProfile);
router.put('/change-password', authenticateToken, userController.changePassword);
router.put('/set-pin', authenticateToken, userController.setPin);

// Admin only route to prove role middleware works
router.get('/admin-dashboard', authenticateToken, authorizeRoles('admin'), userController.getAdminDashboard);

// User only route to prove role middleware works
router.get('/user-dashboard', authenticateToken, authorizeRoles('user'), userController.getUserDashboard);

// Auditor only route to prove role middleware works
router.get('/auditor-dashboard', authenticateToken, authorizeRoles('auditor'), userController.getAuditorDashboard);

// Admin only route for creating users with specific roles
router.post('/', authenticateToken, authorizeRoles('admin'), userController.createUserByAdmin);

// Admin only route for deleting a user by ID
router.delete('/:id', authenticateToken, authorizeRoles('admin'), userController.deleteUser);

// Admin and Auditor route for getting all users
router.get('/', authenticateToken, authorizeRoles('admin', 'auditor'), userController.getAllUsers);

// Admin only route for updating user
router.put('/:id', authenticateToken, authorizeRoles('admin'), userController.updateUser);

module.exports = router;
