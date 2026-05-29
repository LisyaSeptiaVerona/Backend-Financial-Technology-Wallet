const db = require('../config/database');

const createUser = async (name, email, hashedPassword, role = 'user') => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // Insert user
    const [userResult] = await connection.query(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
      [name, email, hashedPassword, role]
    );

    const userId = userResult.insertId;

    // Insert wallet with default balance 0
    await connection.query(
      'INSERT INTO wallets (user_id, balance) VALUES (?, 0)',
      [userId]
    );

    await connection.commit();
    return userId;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const getUserByEmail = async (email) => {
  const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
  return rows[0];
};

const getUserProfile = async (userId) => {
  const [rows] = await db.query(`
    SELECT u.id, u.name, u.email, u.role, u.created_at, w.balance 
    FROM users u 
    LEFT JOIN wallets w ON u.id = w.user_id 
    WHERE u.id = ?
  `, [userId]);
  return rows[0];
};

const getUserById = async (userId) => {
  const [rows] = await db.query('SELECT * FROM users WHERE id = ?', [userId]);
  return rows[0];
};

const updatePassword = async (userId, newHashedPassword) => {
  await db.query('UPDATE users SET password = ? WHERE id = ?', [newHashedPassword, userId]);
};

const deleteUserById = async (userId) => {
  await db.query('DELETE FROM users WHERE id = ?', [userId]);
};

const getAllUsers = async () => {
  const [rows] = await db.query('SELECT id, name, email, role, created_at FROM users');
  return rows;
};

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
