const db = require('../config/database');

const createTransaction = async (walletId, type, amount, description, recipientWalletId = null, connection = null) => {
  const dbConn = connection || db;
  const [result] = await dbConn.query(
    'INSERT INTO transactions (wallet_id, type, amount, status, description, recipient_wallet_id) VALUES (?, ?, ?, ?, ?, ?)',
    [walletId, type, amount, 'pending', description, recipientWalletId]
  );
  return result.insertId;
};

const updateTransactionStatus = async (transactionId, status, connection = null) => {
  const dbConn = connection || db;
  await dbConn.query('UPDATE transactions SET status = ? WHERE id = ?', [status, transactionId]);
};

const getTransactions = async () => {
  const [rows] = await db.query('SELECT * FROM transactions ORDER BY created_at DESC');
  return rows;
};

const getTransactionById = async (id) => {
  const [rows] = await db.query('SELECT * FROM transactions WHERE id = ?', [id]);
  return rows[0];
};

const getTransactionsByWalletId = async (walletId) => {
  const [rows] = await db.query('SELECT * FROM transactions WHERE wallet_id = ? OR recipient_wallet_id = ? ORDER BY created_at DESC', [walletId, walletId]);
  return rows;
};

const deleteTransaction = async (id) => {
  await db.query('DELETE FROM transactions WHERE id = ?', [id]);
};

module.exports = {
  createTransaction,
  updateTransactionStatus,
  getTransactions,
  getTransactionById,
  getTransactionsByWalletId,
  deleteTransaction
};
