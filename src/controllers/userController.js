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

// Fungsi bantuan untuk menghitung statistik seluruh sistem (user, wallet, transaksi)
const getSystemStats = async () => {
  const users = await userModel.getAllUsers();
  const wallets = await userModel.getAllWallets();
  const transactions = await transactionModel.getTransactions();
  const detailedTransactions = await transactionModel.getAllTransactionsWithDetails();

  // 1. User role counts
  const totalUsers = users.length;
  const totalAdmins = users.filter(u => u.role === 'admin').length;
  const totalAuditors = users.filter(u => u.role === 'auditor').length;
  const totalRegularUsers = users.filter(u => u.role === 'user').length;

  // 2. Wallet counts & status
  const totalWallets = wallets.length;
  const activeWallets = wallets.filter(w => w.status === 'active').length;
  const suspendedWallets = wallets.filter(w => w.status === 'suspended').length;
  const totalSystemBalance = wallets.reduce((sum, w) => sum + Number(w.balance), 0);

  // 3. Transactions counts
  const totalTransactions = transactions.length;
  const totalTopUp = transactions.filter(tx => tx.type === 'topup').length;
  const totalTransfer = transactions.filter(tx => tx.type === 'transfer').length;
  const totalPayment = transactions.filter(tx => tx.type === 'payment').length;

  const successTxs = transactions.filter(tx => tx.status === 'success');
  const totalSuccess = successTxs.length;
  const totalFailed = transactions.filter(tx => tx.status === 'failed').length;
  const totalPending = transactions.filter(tx => tx.status === 'pending').length;

  // 4. Volume breakdown (hanya untuk transaksi berstatus success)
  const volumeTopUp = successTxs.filter(tx => tx.type === 'topup').reduce((sum, tx) => sum + Number(tx.amount), 0);
  const volumeTransfer = successTxs.filter(tx => tx.type === 'transfer').reduce((sum, tx) => sum + Number(tx.amount), 0);
  const volumePayment = successTxs.filter(tx => tx.type === 'payment').reduce((sum, tx) => sum + Number(tx.amount), 0);
  const totalVolume = volumeTopUp + volumeTransfer + volumePayment;

  // 5. 10 Transaksi terbaru di sistem
  const recentTransactions = detailedTransactions.slice(0, 10).map(tx => ({
    transaction_id: tx.id,
    user_name: tx.user_name,
    wallet_number: tx.wallet_number,
    transaction_type: tx.type === 'topup' ? 'Top Up' : tx.type === 'transfer' ? 'Transfer' : tx.type === 'payment' ? 'Payment' : tx.type,
    amount: Number(tx.amount),
    status: tx.status,
    description: tx.description,
    date_and_time: tx.created_at
  }));

  return {
    users_summary: {
      total_users: totalUsers,
      total_admins: totalAdmins,
      total_auditors: totalAuditors,
      total_regular_users: totalRegularUsers
    },
    wallets_summary: {
      total_wallets: totalWallets,
      active_wallets: activeWallets,
      suspended_wallets: suspendedWallets,
      total_system_balance: totalSystemBalance
    },
    transactions_summary: {
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
      }
    },
    volume_summary: {
      successful_volume_topup: volumeTopUp,
      successful_volume_transfer: volumeTransfer,
      successful_volume_payment: volumePayment,
      total_successful_volume: totalVolume
    },
    recent_transactions: recentTransactions
  };
};

// Endpoint simulasi Dashboard khusus role Admin
const getAdminDashboard = async (req, res) => {
  try {
    const stats = await getSystemStats();
    res.status(200).json({
      message: 'Dashboard data retrieved successfully',
      data: stats
    });
  } catch (error) {
    console.error('Get admin dashboard error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Endpoint simulasi Dashboard khusus role User biasa (Dashboard Transaksi dan Saldo)
const getUserDashboard = async (req, res) => {
  try {
    const userId = req.user.id;

    // 1. Ambil data wallet user beserta informasi user (nama, email)
    const wallet = await userModel.getUserWallet(userId);
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

    const currentBalance = Number(wallet.balance);

    res.status(200).json({
      message: 'Dashboard data retrieved successfully',
      data: {
        user_name: wallet.user_name,
        wallet_number: wallet.wallet_number,
        current_balance: currentBalance,
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
        }
      }
    });
  } catch (error) {
    console.error('Get user dashboard error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};


// Endpoint simulasi Dashboard khusus role Auditor
const getAuditorDashboard = async (req, res) => {
  try {
    const stats = await getSystemStats();
    res.status(200).json({
      message: 'Dashboard data retrieved successfully',
      data: stats
    });
  } catch (error) {
    console.error('Get auditor dashboard error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
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

// Controller untuk mendapatkan profil user beserta daftar permissions sesuai role-nya
const getProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await userModel.getUserById(userId);
    if (!user) {
      return res.status(404).json({ status: 'error', message: 'User not found' });
    }

    // Daftar permissions berdasarkan role (sesuai seluruh fitur yang tersedia di sistem)
    const permissionsMap = {
      // USER: Fitur transaksi pribadi & manajemen akun sendiri
      user: [
        'view_own_profile',
        'view_own_wallet',
        'view_own_transaction_history',
        'view_dashboard',
        'create_topup',
        'create_transfer',
        'make_payment',
        'change_password',
        'set_pin'
      ],
      // ADMIN: Pengelolaan seluruh sistem, user, wallet, dan transaksi
      admin: [
        'view_own_profile',
        'view_admin_dashboard',
        'create_user',
        'update_user',
        'delete_user',
        'view_all_users',
        'view_all_wallets',
        'view_all_wallet_balances',
        'view_wallet_by_user_id',
        'view_all_transactions',
        'update_topup_status',
        'update_transfer_status',
        'update_payment_status',
        'update_transaction_status',
        'view_audit_log'
      ],
      // AUDITOR: Pemantauan dan audit log (read-only)
      auditor: [
        'view_own_profile',
        'view_auditor_dashboard',
        'view_all_users',
        'view_all_wallets',
        'view_all_wallet_balances',
        'view_wallet_by_user_id',
        'view_all_transactions',
        'view_audit_log'
      ]
    };

    const roleMessages = {
      user: 'User authorization successful',
      admin: 'Admin authorization successful',
      auditor: 'Auditor authorization successful'
    };

    const role = user.role;
    const permissions = permissionsMap[role] || [];
    const message = roleMessages[role] || 'Authorization successful';

    return res.status(200).json({
      status: 'success',
      message,
      data: {
        user_id: user.id,
        name: user.name,
        email: user.email,
        role,
        permissions
      }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ status: 'error', message: 'Internal server error' });
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
  getAllWalletsBalance,
  getProfile
};
