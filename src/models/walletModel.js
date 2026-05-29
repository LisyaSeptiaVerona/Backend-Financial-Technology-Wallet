const db = require('../config/database');

const getAllWallets = async () => {
  const [rows] = await db.query("SELECT w.id, w.user_id, w.balance, u.name as user_name FROM wallets w JOIN users u ON w.user_id = u.id WHERE u.role = 'user'");
  return rows;
};

const getWalletById = async (id) => {
  const [rows] = await db.query('SELECT w.id, w.user_id, w.balance, u.name as user_name FROM wallets w JOIN users u ON w.user_id = u.id WHERE w.id = ?', [id]);
  return rows[0];
};

const getWalletByUserId = async (userId) => {
  const [rows] = await db.query('SELECT * FROM wallets WHERE user_id = ?', [userId]);
  return rows[0];
};

const updateBalance = async (walletId, amount, connection) => {
  const query = 'UPDATE wallets SET balance = balance + ? WHERE id = ? AND balance + ? >= 0';
  const dbConn = connection || db;
  const [result] = await dbConn.query(query, [amount, walletId, amount]);
  return result.affectedRows > 0;
};

module.exports = {
  getAllWallets,
  getWalletById,
  getWalletByUserId,
  updateBalance
};
