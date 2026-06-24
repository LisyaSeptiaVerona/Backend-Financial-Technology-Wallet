const db = require('../config/database');

// Fungsi untuk mengambil data semua wallet milik pengguna biasa (bukan admin/auditor)
const getAllWallets = async () => {
  const [rows] = await db.query("SELECT w.id, w.user_id, w.balance, u.name as user_name FROM wallets w JOIN users u ON w.user_id = u.id WHERE u.role = 'user'");
  return rows;
};

// Fungsi untuk mengambil data wallet secara spesifik berdasarkan ID wallet tersebut
const getWalletById = async (id) => {
  const [rows] = await db.query(`
    SELECT 
      w.id,
      w.user_id,
      u.name AS user_name,
      w.wallet_number,
      w.balance,
      w.status
    FROM wallets w 
    JOIN users u ON w.user_id = u.id 
    WHERE w.id = ?
  `, [id]);
  return rows[0];
};

// Fungsi untuk mencari data wallet berdasarkan ID pemiliknya (User ID)
const getWalletByUserId = async (userId) => {
  const [rows] = await db.query('SELECT * FROM wallets WHERE user_id = ?', [userId]);
  return rows[0];
};

// Fungsi untuk mengubah (menambah/mengurangi) saldo dalam sebuah wallet
const updateBalance = async (walletId, amount, connection) => {
  // Query ini sekaligus memastikan saldo tidak akan menjadi minus (balance + amount >= 0)
  // Cara kerjanya: saldo akan ditambah dengan 'amount' (bisa positif untuk topup, atau negatif untuk transfer/payment)
  const query = 'UPDATE wallets SET balance = balance + ? WHERE id = ? AND balance + ? >= 0';
  
  // Gunakan connection yang diberikan jika ini adalah bagian dari transaksi bersambung, jika tidak gunakan koneksi default
  const dbConn = connection || db;
  const [result] = await dbConn.query(query, [amount, walletId, amount]);
  
  // Mengembalikan nilai 'true' jika ada baris yang ter-update (berarti saldo cukup dan berhasil diubah), sebaliknya 'false'
  return result.affectedRows > 0;
};

module.exports = {
  getAllWallets,
  getWalletById,
  getWalletByUserId,
  updateBalance
};
