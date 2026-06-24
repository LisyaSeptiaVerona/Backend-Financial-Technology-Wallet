const db = require('../config/database');

// Fungsi untuk membuat / merekam transaksi baru ke dalam database
const createTransaction = async (walletId, type, amount, description, balanceBefore, balanceAfter, recipientWalletId = null, connection = null) => {
  // Gunakan connection yang diberikan (jika ada, biasanya untuk transaksi database yang berangkai/bersama-sama) 
  // atau gunakan koneksi db default
  const dbConn = connection || db;
  
  const [result] = await dbConn.query(
    'INSERT INTO transactions (wallet_id, type, amount, status, description, balance_before, balance_after, recipient_wallet_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    // Status awal selalu di-set 'pending' saat pertama kali transaksi dibuat
    [walletId, type, amount, 'pending', description, balanceBefore, balanceAfter, recipientWalletId]
  );
  return result.insertId;
};

// Fungsi untuk memperbarui status transaksi (misal dari 'pending' menjadi 'success' atau 'failed')
const updateTransactionStatus = async (transactionId, status, connection = null) => {
  const dbConn = connection || db;
  await dbConn.query('UPDATE transactions SET status = ? WHERE id = ?', [status, transactionId]);
};

// Fungsi untuk mendapatkan semua transaksi yang ada di sistem
const getTransactions = async () => {
  // Menampilkan semua transaksi tanpa kecuali (karena transaksi bersifat permanen dan tidak bisa dihapus)
  const [rows] = await db.query('SELECT * FROM transactions ORDER BY created_at DESC');
  return rows;
};

// Fungsi untuk mencari sebuah transaksi secara spesifik menggunakan ID transaksi tersebut
const getTransactionById = async (id) => {
  const [rows] = await db.query('SELECT * FROM transactions WHERE id = ?', [id]);
  return rows[0];
};

// Fungsi untuk mendapatkan riwayat transaksi untuk dompet (wallet) tertentu.
// Transaksi yang diambil mencakup saat wallet menjadi pengirim (wallet_id) atau penerima (recipient_wallet_id)
const getTransactionsByWalletId = async (walletId) => {
  const [rows] = await db.query(
    'SELECT * FROM transactions WHERE wallet_id = ? OR recipient_wallet_id = ? ORDER BY created_at DESC',
    [walletId, walletId]
  );
  return rows;
};

module.exports = {
  createTransaction,
  updateTransactionStatus,
  getTransactions,
  getTransactionById,
  getTransactionsByWalletId
};
