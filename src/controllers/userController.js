const bcrypt = require('bcrypt');
const userModel = require('../models/userModel');

const getProfile = async (req, res) => {
  try {
    const userId = req.user.id; // From auth middleware

    const profile = await userModel.getUserProfile(userId);
    
    if (!profile) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json({
      message: 'Profile retrieved successfully',
      data: profile
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

const getAdminDashboard = async (req, res) => {
  res.status(200).json({
    message: 'Welcome Admin! This data is top secret and only visible to admin role.',
    data: { total_users: 100, system_status: 'Online' }
  });
};

const getUserDashboard = async (req, res) => {
  res.status(200).json({
    message: 'Welcome User! Ini halaman khusus untuk nasabah/user biasa.',
    data: { info: 'Anda tidak bisa mengakses menu Admin.' }
  });
};

const getAuditorDashboard = async (req, res) => {
  res.status(200).json({
    message: 'Welcome Auditor! Anda memiliki akses read-only untuk mengecek laporan.',
    data: { logs_reviewed: 42, pending_audits: 5 }
  });
};

const createUserByAdmin = async (req, res) => {
  try {
    let { name, email, password, role } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: 'Name, email, password, and role are required' });
    }
    
    email = email.toLowerCase();

    const existingUser = await userModel.getUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({ message: 'Email already registered' });
    }

    if (!['admin', 'user', 'auditor'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

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

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Incorrect old password' });
    }

    const saltRounds = 10;
    const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

    await userModel.updatePassword(userId, hashedNewPassword);

    res.status(200).json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await userModel.getUserById(id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

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

const getAllUsers = async (req, res) => {
  try {
    const users = await userModel.getAllUsers();
    res.status(200).json({ data: users });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

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

const setPin = async (req, res) => {
  try {
    const userId = req.user.id;
    const { pin } = req.body;

    // Enforce GoPay standard: exactly 6 digits (numeric only)
    if (!pin || !/^\d{6}$/.test(pin)) {
      return res.status(400).json({ message: 'PIN must be 6 numeric digits' });
    }

    const db = require('../config/database');
    await db.query('UPDATE users SET pin = ? WHERE id = ?', [pin, userId]);

    res.status(200).json({ message: 'PIN set successfully' });
  } catch (error) {
    console.error('Set PIN error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = {
  getProfile,
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
