const db = require('../config/database');

// Fungsi untuk membuat user baru di database beserta wallet awalnya
const createUser = async (name, email, hashedPassword, role = 'user') => {
  // Gunakan connection dari pool untuk bisa melakukan transaksi (transaction) database
  const connection = await db.getConnection();
  try {
    // Memulai transaksi agar jika terjadi error di tengah jalan, semua perubahan bisa dibatalkan (rollback)
    await connection.beginTransaction();

    // Menyimpan data user baru ke tabel users
    const [userResult] = await connection.query(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
      [name, email, hashedPassword, role]
    );

    // Dapatkan ID user yang baru saja dibuat
    const userId = userResult.insertId;

    // Wallet hanya dibuat otomatis untuk nasabah biasa (role: 'user')
    // Admin dan Auditor tidak memerlukan wallet karena mereka adalah akun staf/sistem
    if (role === 'user') {
      // Generate nomor wallet unik, contoh: W-timestamp-random
      const walletNumber = 'W' + Date.now().toString().slice(-6) + Math.floor(1000 + Math.random() * 9000);

      // Secara otomatis membuatkan wallet untuk user tersebut dengan saldo awal 0
      await connection.query(
        'INSERT INTO wallets (user_id, wallet_number, balance, status) VALUES (?, ?, 0, "active")',
        [userId, walletNumber]
      );
    }

    // Jika semua perintah berhasil, commit (simpan permanen) ke database
    await connection.commit();
    return userId;
  } catch (error) {
    // Jika ada error (misal gagal insert wallet), batalkan semua operasi sebelumnya
    await connection.rollback();
    throw error;
  } finally {
    // Pastikan connection dikembalikan ke pool agar bisa digunakan oleh request lain
    connection.release();
  }
};

// Fungsi untuk mencari user berdasarkan email (berguna saat login atau pengecekan duplikasi)
const getUserByEmail = async (email) => {
  const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
  return rows[0];
};

// Fungsi untuk mengambil wallet user
const getUserWallet = async (userId) => {
  const [rows] = await db.query(`
    SELECT 
      w.id,
      w.user_id,
      u.name AS user_name,
      u.email,
      w.wallet_number,
      w.balance,
      u.pin,
      w.status,
      w.created_at,
      w.updated_at
    FROM wallets w 
    JOIN users u ON w.user_id = u.id
    WHERE w.user_id = ?
  `, [userId]);
  return rows[0];
};

// Fungsi untuk mencari user berdasarkan ID
const getUserById = async (userId) => {
  const [rows] = await db.query('SELECT * FROM users WHERE id = ?', [userId]);
  return rows[0];
};

// Fungsi untuk memperbarui password user di database
const updatePassword = async (userId, newHashedPassword) => {
  await db.query('UPDATE users SET password = ? WHERE id = ?', [newHashedPassword, userId]);
};

// Fungsi untuk menghapus user secara permanen dari database
const deleteUserById = async (userId) => {
  await db.query('DELETE FROM users WHERE id = ?', [userId]);
};

// Fungsi untuk mendapatkan semua daftar user (biasanya untuk Admin)
const getAllUsers = async () => {
  const [rows] = await db.query('SELECT id, name, email, role, created_at FROM users');
  return rows;
};

// Fungsi untuk memperbarui data dasar user (nama, email, role)
const updateUser = async (id, name, email, role) => {
  await db.query(
    'UPDATE users SET name = ?, email = ?, role = ? WHERE id = ?',
    [name, email, role, id]
  );
};

// Fungsi untuk mendapatkan wallet milik user tertentu berdasarkan user ID
const getWalletByUserId = async (userId) => {
  const [rows] = await db.query(`
    SELECT 
      w.id,
      w.user_id,
      u.name AS user_name,
      u.email AS user_email,
      w.wallet_number,
      w.balance,
      w.status,
      w.created_at,
      w.updated_at
    FROM wallets w
    JOIN users u ON w.user_id = u.id
    WHERE w.user_id = ?
  `, [userId]);
  return rows[0];
};

// Fungsi untuk mendapatkan semua wallet dari semua user (untuk Admin & Auditor)
const getAllWallets = async () => {
  const [rows] = await db.query(`
    SELECT 
      w.id,
      w.user_id,
      u.name AS user_name,
      u.email AS user_email,
      w.wallet_number,
      w.balance,
      w.status,
      w.created_at,
      w.updated_at
    FROM wallets w
    JOIN users u ON w.user_id = u.id
    ORDER BY w.id ASC
  `);
  return rows;
};

module.exports = {
  createUser,
  getUserByEmail,
  getUserWallet,
  getUserById,
  updatePassword,
  deleteUserById,
  getAllUsers,
  updateUser,
  getAllWallets,
  getWalletByUserId
};
