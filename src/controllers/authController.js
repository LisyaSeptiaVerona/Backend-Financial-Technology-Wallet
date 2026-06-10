const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const userModel = require('../models/userModel');

// Controller untuk proses Pendaftaran (Register) pengguna baru
const register = async (req, res) => {
  try {
    // Ambil data yang dikirimkan client melalui body request
    let { name, email, password } = req.body;

    // Validasi dasar: Pastikan tidak ada data yang kosong
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required' });
    }
    
    // Standarisasi email menjadi huruf kecil semua agar tidak terjadi case-sensitive issue di database
    email = email.toLowerCase();

    // Periksa apakah email tersebut sudah pernah didaftarkan sebelumnya
    const existingUser = await userModel.getUserByEmail(email);
    if (existingUser) {
      // HTTP 409 Conflict: data sudah ada
      return res.status(409).json({ message: 'Email already registered' });
    }

    // Hash (Enkripsi) password menggunakan library bcrypt agar aman
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Paksa pengguna baru untuk selalu memiliki role 'user' (menghindari manipulasi role melalui request)
    const userRole = 'user';

    // Buat data pengguna (user) di database beserta wallet awalnya
    const userId = await userModel.createUser(name, email, hashedPassword, userRole);

    // Kirimkan response berhasil (HTTP 201 Created)
    res.status(201).json({
      message: 'User registered successfully',
      data: { userId, name, email, role: userRole }
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Controller untuk proses Masuk (Login) pengguna
const login = async (req, res) => {
  try {
    let { email, password } = req.body;

    // Pastikan data email dan password dikirim
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }
    
    // Standarisasi pencarian email ke huruf kecil
    email = email.toLowerCase();

    // Cari pengguna di database berdasarkan email tersebut
    const user = await userModel.getUserByEmail(email);
    if (!user) {
      // Jika tidak ditemukan, tolak akses (HTTP 401 Unauthorized)
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Bandingkan password yang diketik dengan password yang dienkripsi (hash) di database
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      // Jika password tidak cocok, tolak akses
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Buat (Generate) JWT token. Token ini memuat payload: id dan role user
    // Token akan expired (kadaluarsa) dalam 1 jam
    const payload = { id: user.id, role: user.role };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });

    // Kirim token kembali ke client agar dapat digunakan untuk mengakses endpoint yang dilindungi
    res.status(200).json({
      message: 'Login successful',
      token,
      data: { id: user.id, name: user.name, role: user.role }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = {
  register,
  login
};
