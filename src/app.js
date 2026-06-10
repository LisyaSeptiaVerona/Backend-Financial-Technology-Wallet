require('dotenv').config();
const express = require('express');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const walletRoutes = require('./routes/wallet');
const transactionRoutes = require('./routes/transaction');
const auditLogRoutes = require('./routes/auditLog');

const app = express();

// Middleware bawaan express untuk membaca request body dalam format JSON
app.use(express.json());

// Mendaftarkan seluruh routing (jalur API) yang ada pada aplikasi
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/wallets', walletRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/audit-logs', auditLogRoutes);

// Route dasar untuk mengecek apakah server / API berjalan dengan normal (Health Check)
app.get('/', (req, res) => {
  res.send('Fintech Wallet API is running');
});

module.exports = app;
