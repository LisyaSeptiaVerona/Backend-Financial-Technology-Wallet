const transactionModel = require('../models/transactionModel');
const walletModel = require('../models/walletModel');
const userModel = require('../models/userModel');
const auditLogModel = require('../models/auditLogModel');
const db = require('../config/database');

const verifyPin = async (userId, pin) => {
  const user = await userModel.getUserById(userId);
  if (!user || user.pin !== pin) {
    return false;
  }
  return true;
};

const topUp = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const userId = req.user.id;
    const { amount, description } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Amount must be greater than 0' });
    }

    const wallet = await walletModel.getWalletByUserId(userId);
    if (!wallet) {
      return res.status(404).json({ message: 'Wallet not found' });
    }

    await connection.beginTransaction();

    const transactionId = await transactionModel.createTransaction(wallet.id, 'topup', amount, description || 'Top Up', null, connection);
    await walletModel.updateBalance(wallet.id, amount, connection);
    await transactionModel.updateTransactionStatus(transactionId, 'success', connection);
    
    await auditLogModel.createAuditLog(transactionId, 'Top Up', { userId, amount, status: 'success' }, connection);

    await connection.commit();
    res.status(200).json({ message: 'Top up successful', transactionId });
  } catch (error) {
    await connection.rollback();
    console.error('Top up error:', error);
    res.status(500).json({ message: 'Internal server error or invalid input' });
  } finally {
    connection.release();
  }
};

const transfer = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const userId = req.user.id;
    const { recipientUserId, amount, pin, description } = req.body;

    if (!recipientUserId || !amount || amount <= 0 || !pin) {
      return res.status(400).json({ message: 'Recipient, amount (>0), and pin are required' });
    }

    if (!(await verifyPin(userId, pin))) {
      return res.status(401).json({ message: 'Invalid PIN' });
    }

    if (userId === recipientUserId) {
      return res.status(400).json({ message: 'Cannot transfer to yourself' });
    }

    const senderWallet = await walletModel.getWalletByUserId(userId);
    if (!senderWallet) {
      return res.status(404).json({ message: 'Sender wallet not found' });
    }

    const recipientWallet = await walletModel.getWalletByUserId(recipientUserId);
    if (!recipientWallet) {
      return res.status(404).json({ message: 'Recipient wallet not found' });
    }

    await connection.beginTransaction();

    const transactionId = await transactionModel.createTransaction(senderWallet.id, 'transfer', amount, description || 'Transfer', recipientWallet.id, connection);

    const success = await walletModel.updateBalance(senderWallet.id, -amount, connection);
    if (!success) {
      await transactionModel.updateTransactionStatus(transactionId, 'failed', connection);
      await auditLogModel.createAuditLog(transactionId, 'Transfer', { sender: userId, recipient: recipientUserId, amount, status: 'failed - insufficient balance' }, connection);
      await connection.commit();
      return res.status(400).json({ message: 'Insufficient balance' });
    }

    await walletModel.updateBalance(recipientWallet.id, amount, connection);
    await transactionModel.updateTransactionStatus(transactionId, 'success', connection);
    await auditLogModel.createAuditLog(transactionId, 'Transfer', { sender: userId, recipient: recipientUserId, amount, status: 'success' }, connection);

    await connection.commit();
    res.status(200).json({ message: 'Transfer successful', transactionId });
  } catch (error) {
    await connection.rollback();
    console.error('Transfer error:', error);
    res.status(500).json({ message: 'Internal server error or invalid input' });
  } finally {
    connection.release();
  }
};

const payment = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const userId = req.user.id;
    const { amount, pin, description } = req.body;

    if (!amount || amount <= 0 || !pin) {
      return res.status(400).json({ message: 'Amount (>0) and pin are required' });
    }

    if (!(await verifyPin(userId, pin))) {
      return res.status(401).json({ message: 'Invalid PIN' });
    }

    const wallet = await walletModel.getWalletByUserId(userId);
    if (!wallet) {
      return res.status(404).json({ message: 'Wallet not found' });
    }

    await connection.beginTransaction();

    const transactionId = await transactionModel.createTransaction(wallet.id, 'payment', amount, description || 'Payment', null, connection);

    const success = await walletModel.updateBalance(wallet.id, -amount, connection);
    if (!success) {
      await transactionModel.updateTransactionStatus(transactionId, 'failed', connection);
      await auditLogModel.createAuditLog(transactionId, 'Payment', { userId, amount, status: 'failed - insufficient balance' }, connection);
      await connection.commit();
      return res.status(400).json({ message: 'Insufficient balance' });
    }

    await transactionModel.updateTransactionStatus(transactionId, 'success', connection);
    await auditLogModel.createAuditLog(transactionId, 'Payment', { userId, amount, status: 'success' }, connection);

    await connection.commit();
    res.status(200).json({ message: 'Payment successful', transactionId });
  } catch (error) {
    await connection.rollback();
    console.error('Payment error:', error);
    res.status(500).json({ message: 'Internal server error or invalid input' });
  } finally {
    connection.release();
  }
};

const getTransactions = async (req, res) => {
  try {
    if (req.user.role === 'admin' || req.user.role === 'auditor') {
      const transactions = await transactionModel.getTransactions();
      return res.status(200).json({ data: transactions });
    } else {
      const wallet = await walletModel.getWalletByUserId(req.user.id);
      if (!wallet) return res.status(404).json({ message: 'Wallet not found' });
      const transactions = await transactionModel.getTransactionsByWalletId(wallet.id);
      return res.status(200).json({ data: transactions });
    }
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

const updateTransactionStatus = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['pending', 'success', 'failed', 'reversed'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    await connection.beginTransaction();

    const transaction = await transactionModel.getTransactionById(id);
    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    // Logika Pengembalian Saldo (Refund) jika di-reverse
    if (status === 'reversed' && transaction.status === 'success') {
      if (transaction.type === 'topup') {
        const success = await walletModel.updateBalance(transaction.wallet_id, -transaction.amount, connection);
        if (!success) {
          await connection.rollback();
          return res.status(400).json({ message: 'Cannot reverse topup: user has insufficient balance' });
        }
      } else if (transaction.type === 'payment') {
        await walletModel.updateBalance(transaction.wallet_id, transaction.amount, connection);
      } else if (transaction.type === 'transfer') {
        const deductSuccess = await walletModel.updateBalance(transaction.recipient_wallet_id, -transaction.amount, connection);
        if (!deductSuccess) {
          await connection.rollback();
          return res.status(400).json({ message: 'Cannot reverse transfer: recipient has insufficient balance' });
        }
        await walletModel.updateBalance(transaction.wallet_id, transaction.amount, connection);
      }
    }

    await transactionModel.updateTransactionStatus(id, status, connection);
    await auditLogModel.createAuditLog(id, 'Update Status', { oldStatus: transaction.status, newStatus: status, adminId: req.user.id }, connection);

    await connection.commit();
    res.status(200).json({ message: 'Status updated successfully' });
  } catch (error) {
    await connection.rollback();
    console.error('Update status error:', error);
    res.status(500).json({ message: 'Internal server error' });
  } finally {
    connection.release();
  }
};

const deleteTransaction = async (req, res) => {
  try {
    const { id } = req.params;
    
    const transaction = await transactionModel.getTransactionById(id);
    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    await transactionModel.deleteTransaction(id);
    res.status(200).json({ message: 'Transaction deleted successfully' });
  } catch (error) {
    console.error('Delete transaction error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = {
  topUp,
  transfer,
  payment,
  getTransactions,
  updateTransactionStatus,
  deleteTransaction
};
