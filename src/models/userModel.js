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

    // Secara otomatis membuatkan wallet untuk user tersebut dengan saldo awal 0
    await connection.query(
      'INSERT INTO wallets (user_id, balance) VALUES (?, 0)',
      [userId]
    );

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

// Fungsi untuk mengambil profil user lengkap beserta saldo wallet-nya
const getUserProfile = async (userId) => {
  const [rows] = await db.query(`
    SELECT u.id, u.name, u.email, u.role, u.created_at, w.balance 
    FROM users u 
    LEFT JOIN wallets w ON u.id = w.user_id 
    WHERE u.id = ?
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

module.exports = {
  createUser,
  getUserByEmail,
  getUserProfile,
  getUserById,
  updatePassword,
  deleteUserById,
  getAllUsers,
  updateUser
};
