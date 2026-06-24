const bcrypt = require('bcrypt');
const userModel = require('../models/userModel');

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
      message: 'Wallet retrieved successfully',
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

// Endpoint simulasi Dashboard khusus role User biasa
const getUserDashboard = async (req, res) => {
  res.status(200).json({
    message: 'Welcome User! Ini halaman khusus untuk nasabah/user biasa.',
    data: { info: 'Anda tidak bisa mengakses menu Admin.' }
  });
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
  setPin
};
