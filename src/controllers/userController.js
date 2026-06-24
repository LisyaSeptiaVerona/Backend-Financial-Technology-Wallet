const bcrypt = require('bcrypt');
const userModel = require('../models/userModel');
const walletModel = require('../models/walletModel');
const transactionModel = require('../models/transactionModel');

// Controller untuk mengambil data wallet pengguna
const getWallets = async (req, res) => {
  try {
    // req.user.id didapatkan dari token JWT (via auth middleware)
    const userId = req.user.id; 

    const wallet = await userModel.getUserWallet(userId);
    
    if (!wallet) {
      return res.status(404).json({ message: 'Wallet not found' });
    }

    res.status(200).json({
      message: 'Wallet account data retrieved successfully',
      data: wallet
    });
  } catch (error) {
    console.error('Get wallet error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Endpoint simulasi Dashboard khusus role Admin
const getAdminDashboard = async (req, res) => {
  res.status(200).json({
    message: 'Welcome Admin! This data is top secret and only visible to admin role.',
    data: { total_users: 100, system_status: 'Online' }
  });
};

// Endpoint simulasi Dashboard khusus role User biasa (Dashboard Transaksi dan Saldo)
const getUserDashboard = async (req, res) => {
  try {
    const userId = req.user.id;

    // 1. Ambil data wallet user
    const wallet = await walletModel.getWalletByUserId(userId);
    if (!wallet) {
      return res.status(404).json({ message: 'Wallet not found' });
    }

    // 2. Ambil semua riwayat transaksi untuk wallet ini
    const transactions = await transactionModel.getTransactionsByWalletId(wallet.id);

    // 3. Hitung ringkasan transaksi
    const totalTransactions = transactions.length;

    const totalTopUp = transactions.filter(tx => tx.type === 'topup').length;
    const totalTransfer = transactions.filter(tx => tx.type === 'transfer').length;
    const totalPayment = transactions.filter(tx => tx.type === 'payment').length;

    const totalSuccess = transactions.filter(tx => tx.status === 'success').length;
    const totalFailed = transactions.filter(tx => tx.status === 'failed').length;
    const totalPending = transactions.filter(tx => tx.status === 'pending').length;

    // 4. Buat data grafik perkembangan saldo (7 hari terakhir)
    const dates = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      dates.push(dateStr);
    }

    const currentBalance = Number(wallet.balance);
    const events = [{ time: new Date(), balance: currentBalance }];
    let tempBal = currentBalance;

    for (const tx of transactions) {
      if (tx.status !== 'success') continue;
      const txTime = new Date(tx.created_at);
      if (tx.wallet_id === wallet.id) {
        // User adalah pengirim/pembayar (saldo berkurang, sebelum transaksi saldo lebih besar)
        events.push({ time: txTime, balance: Number(tx.balance_after || 0) });
        tempBal = Number(tx.balance_before || 0);
      } else if (tx.recipient_wallet_id === wallet.id) {
        // User adalah penerima transfer (saldo bertambah, sebelum transaksi saldo lebih kecil)
        events.push({ time: txTime, balance: tempBal });
        tempBal = tempBal - Number(tx.amount || 0);
      }
    }
    events.push({ time: new Date(0), balance: tempBal });

    const balanceHistory = dates.map(dateStr => {
      const dayEnd = new Date(dateStr + 'T23:59:59.999Z');
      const sortedEvents = [...events].sort((a, b) => a.time - b.time);
      let dayBalance = tempBal;
      for (const event of sortedEvents) {
        if (event.time <= dayEnd) {
          dayBalance = event.balance;
        } else {
          break;
        }
      }
      return { date: dateStr, balance: dayBalance };
    });

    // 5. Buat data grafik jumlah transaksi berdasarkan jenis transaksi (7 hari terakhir)
    const transactionHistoryChart = dates.map(dateStr => {
      const startOfDay = new Date(dateStr + 'T00:00:00.000Z');
      const endOfDay = new Date(dateStr + 'T23:59:59.999Z');

      const dailyTxs = transactions.filter(tx => {
        const txTime = new Date(tx.created_at);
        return txTime >= startOfDay && txTime <= endOfDay;
      });

      const topupCount = dailyTxs.filter(tx => tx.type === 'topup').length;
      const transferCount = dailyTxs.filter(tx => tx.type === 'transfer').length;
      const paymentCount = dailyTxs.filter(tx => tx.type === 'payment').length;

      return {
        date: dateStr,
        'Top Up': topupCount,
        'Transfer': transferCount,
        'Payment': paymentCount,
        total: dailyTxs.length
      };
    });

    // 6. 5 transaksi terbaru
    const recentTransactions = transactions.slice(0, 5).map(tx => ({
      transaction_id: tx.id,
      transaction_type: tx.type === 'topup' ? 'Top Up' : tx.type === 'transfer' ? 'Transfer' : tx.type === 'payment' ? 'Payment' : tx.type,
      amount: Number(tx.amount),
      status: tx.status,
      description: tx.description,
      date_and_time: tx.created_at,
      balance_before: Number(tx.balance_before || 0),
      balance_after: Number(tx.balance_after || 0)
    }));

    res.status(200).json({
      message: 'Dashboard data retrieved successfully',
      data: {
        card_balance: currentBalance,
        wallet_number: wallet.wallet_number,
        total_transactions: totalTransactions,
        transactions_by_category: {
          'Top Up': totalTopUp,
          'Transfer': totalTransfer,
          'Payment': totalPayment
        },
        transactions_by_status: {
          'Success': totalSuccess,
          'Failed': totalFailed,
          'Pending': totalPending
        },
        balance_history: balanceHistory,
        transaction_history_chart: transactionHistoryChart,
        recent_transactions: recentTransactions
      }
    });
  } catch (error) {
    console.error('Get user dashboard error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};


// Endpoint simulasi Dashboard khusus role Auditor
const getAuditorDashboard = async (req, res) => {
  res.status(200).json({
    message: 'Welcome Auditor! Anda memiliki akses read-only untuk mengecek laporan.',
    data: { logs_reviewed: 42, pending_audits: 5 }
  });
};

// Controller untuk Admin membuat user baru secara manual (bisa memilih role admin/auditor/user)
const createUserByAdmin = async (req, res) => {
  try {
    let { name, email, password, role } = req.body;

    // Pastikan admin mengirim semua field yang wajib ada
    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: 'Name, email, password, and role are required' });
    }
    
    email = email.toLowerCase();

    // Pastikan tidak ada duplikasi email
    const existingUser = await userModel.getUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({ message: 'Email already registered' });
    }

    // Validasi role agar hanya boleh diisi oleh tipe role yang tersedia
    if (!['admin', 'user', 'auditor'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }

    // Enkripsi password menggunakan bcrypt
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Proses pembuatan user di database
    const userId = await userModel.createUser(name, email, hashedPassword, role);

    res.status(201).json({
      message: 'User created successfully by Admin',
      data: { userId, name, email, role }
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Controller untuk pengguna mengganti password mereka sendiri
const changePassword = async (req, res) => {
  try {
    const userId = req.user.id;
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ message: 'oldPassword and newPassword are required' });
    }

    const user = await userModel.getUserById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Validasi apakah password lama yang diinputkan benar
    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Incorrect old password' });
    }

    // Hash password baru sebelum disimpan ke database
    const saltRounds = 10;
    const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

    await userModel.updatePassword(userId, hashedNewPassword);

    res.status(200).json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Controller bagi Admin untuk menghapus akun pengguna (user)
const deleteUser = async (req, res) => {
  try {
    // Ambil ID user yang ingin dihapus dari URL Parameter (/:id)
    const { id } = req.params;

    const user = await userModel.getUserById(id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Mencegah admin secara tidak sengaja menghapus akunnya sendiri yang sedang dipakai login
    if (user.id === req.user.id) {
      return res.status(400).json({ message: 'Admin tidak bisa menghapus akunnya sendiri' });
    }

    await userModel.deleteUserById(id);

    res.status(200).json({ message: `User dengan ID ${id} berhasil dihapus` });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Controller untuk melihat daftar semua user di dalam sistem
const getAllUsers = async (req, res) => {
  try {
    const users = await userModel.getAllUsers();
    res.status(200).json({ data: users });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Controller bagi Admin untuk memperbarui profil/role user tertentu
const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, role } = req.body;

    if (!name || !email || !role) {
      return res.status(400).json({ message: 'Name, email, and role are required' });
    }

    const user = await userModel.getUserById(id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!['admin', 'user', 'auditor'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }

    await userModel.updateUser(id, name, email.toLowerCase(), role);
    res.status(200).json({ message: 'User updated successfully' });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Controller agar user dapat mengatur PIN transaksinya (misal untuk kebutuhan transfer/payment)
const setPin = async (req, res) => {
  try {
    const userId = req.user.id;
    const { pin } = req.body;

    // Memaksa format standar PIN: Harus persis 6 digit angka numerik (tanpa huruf/spasi)
    if (!pin || !/^\d{6}$/.test(pin)) {
      return res.status(400).json({ message: 'PIN must be 6 numeric digits' });
    }

    // Simpan PIN langsung ke tabel users (untuk sistem nyata harusnya juga dienkripsi seperti password)
    const db = require('../config/database');
    await db.query('UPDATE users SET pin = ? WHERE id = ?', [pin, userId]);

    res.status(200).json({ message: 'PIN set successfully' });
  } catch (error) {
    console.error('Set PIN error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Controller untuk Admin & Auditor melihat semua wallet semua user
const getAllWallets = async (req, res) => {
  try {
    const wallets = await userModel.getAllWallets();
    res.status(200).json({
      message: 'All wallets retrieved successfully',
      total: wallets.length,
      data: wallets
    });
  } catch (error) {
    console.error('Get all wallets error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Controller untuk Admin & Auditor melihat wallet milik user tertentu berdasarkan ID
const getWalletByUserId = async (req, res) => {
  try {
    const { id } = req.params;

    // Cek apakah user dengan ID tersebut ada di database
    const user = await userModel.getUserById(id);
    if (!user) {
      return res.status(404).json({ message: `User dengan ID ${id} tidak ditemukan` });
    }

    // Ambil data wallet milik user tersebut
    const wallet = await userModel.getWalletByUserId(id);
    if (!wallet) {
      return res.status(404).json({ message: `Wallet untuk user ID ${id} tidak ditemukan` });
    }

    res.status(200).json({
      message: `Wallet milik user ID ${id} berhasil ditemukan`,
      data: wallet
    });
  } catch (error) {
    console.error('Get wallet by user ID error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Controller untuk Admin & Auditor melihat seluruh saldo user (hanya menampilkan data saldo)
const getAllWalletsBalance = async (req, res) => {
  try {
    const wallets = await userModel.getAllWallets();
    res.status(200).json({
      message: 'All wallet balances retrieved successfully',
      data: wallets.map(w => ({
        wallet_number: w.wallet_number,
        balance: w.balance,
        status: w.status
      }))
    });
  } catch (error) {
    console.error('Get all wallets balance error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = {
  getWallets,
  getAdminDashboard,
  getUserDashboard,
  getAuditorDashboard,
  createUserByAdmin,
  changePassword,
  deleteUser,
  getAllUsers,
  updateUser,
  setPin,
  getAllWallets,
  getWalletByUserId,
  getAllWalletsBalance
};
