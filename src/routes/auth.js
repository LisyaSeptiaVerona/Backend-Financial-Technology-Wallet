const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Route untuk mendaftarkan akun baru (register)
router.post('/register', authController.register);

// Route untuk masuk ke dalam sistem (login)
router.post('/login', authController.login);

module.exports = router;
