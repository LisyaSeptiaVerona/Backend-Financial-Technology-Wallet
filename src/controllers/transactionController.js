const transactionModel = require('../models/transactionModel');
const walletModel = require('../models/walletModel');
const userModel = require('../models/userModel');
const auditLogModel = require('../models/auditLogModel');
const db = require('../config/database');

// Fungsi bantuan (helper) untuk memverifikasi apakah PIN yang dimasukkan benar
const verifyPin = async (userId, pin) => {
  const user = await userModel.getUserById(userId);
  // Jika user tidak ditemukan atau PIN tidak cocok, kembalikan false
  if (!user || user.pin !== pin) {
    return false;
  }
  return true;
};

// Controller untuk proses Top Up (Isi Saldo)
const topUp = async (req, res) => {
  // Gunakan connection untuk memastikan semua query berjalan dalam 1 transaksi (menghindari data terpotong jika error)
  const connection = await db.getConnection();
  try {
    const userId = req.user.id;
    const { amount, description } = req.body;

    // Validasi dasar: jumlah top up harus lebih dari 0
    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Amount must be greater than 0' });
    }

    // Cari wallet milik user yang sedang request
    const wallet = await walletModel.getWalletByUserId(userId);
    if (!wallet) {
      return res.status(404).json({ message: 'Wallet not found' });
    }

    // Mulai transaksi database
    await connection.beginTransaction();

    // 1. Buat catatan transaksi baru dengan tipe 'topup'
    const transactionId = await transactionModel.createTransaction(wallet.id, 'topup', amount, description || 'Top Up', null, connection);
    // 2. Tambahkan saldo ke wallet user
    await walletModel.updateBalance(wallet.id, amount, connection);
    // 3. Ubah status transaksi menjadi 'success'
    await transactionModel.updateTransactionStatus(transactionId, 'success', connection);
    
    // 4. Catat aktivitas ini ke dalam audit log
    await auditLogModel.createAuditLog(transactionId, 'Top Up', { userId, amount, status: 'success' }, connection);

    // Simpan semua perubahan ke database secara permanen
    await connection.commit();
    res.status(200).json({ message: 'Top up successful', transactionId });
  } catch (error) {
    // Jika terjadi error di salah satu langkah, batalkan semua perubahan yang belum di-commit
    await connection.rollback();
    console.error('Top up error:', error);
    res.status(500).json({ message: 'Internal server error or invalid input' });
  } finally {
    // Kembalikan koneksi ke pool
    connection.release();
  }
};

// Controller untuk proses Transfer Saldo antar Pengguna
const transfer = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const userId = req.user.id;
    const { recipientUserId, amount, pin, description } = req.body;

    // Validasi input: pastikan semua field yang dibutuhkan terisi dengan benar
    if (!recipientUserId || !amount || amount <= 0 || !pin) {
      return res.status(400).json({ message: 'Recipient, amount (>0), and pin are required' });
    }

    // Verifikasi PIN sebelum memproses transfer
    if (!(await verifyPin(userId, pin))) {
      return res.status(401).json({ message: 'Invalid PIN' });
    }

    // Cegah user melakukan transfer ke dirinya sendiri
    if (userId === recipientUserId) {
      return res.status(400).json({ message: 'Cannot transfer to yourself' });
    }

    // Ambil data wallet pengirim (sender)
    const senderWallet = await walletModel.getWalletByUserId(userId);
    if (!senderWallet) {
      return res.status(404).json({ message: 'Sender wallet not found' });
    }

    // Ambil data wallet penerima (recipient)
    const recipientWallet = await walletModel.getWalletByUserId(recipientUserId);
    if (!recipientWallet) {
      return res.status(404).json({ message: 'Recipient wallet not found' });
    }

    await connection.beginTransaction();

    // 1. Catat transaksi dengan tipe 'transfer' yang melibatkan dompet pengirim dan penerima
    const transactionId = await transactionModel.createTransaction(senderWallet.id, 'transfer', amount, description || 'Transfer', recipientWallet.id, connection);

    // 2. Coba kurangi saldo pengirim (updateBalance mengembalikan false jika saldo jadi minus)
    const success = await walletModel.updateBalance(senderWallet.id, -amount, connection);
    if (!success) {
      // Jika saldo tidak cukup, ubah status transaksi menjadi 'failed' dan log kegagalan
      await transactionModel.updateTransactionStatus(transactionId, 'failed', connection);
      await auditLogModel.createAuditLog(transactionId, 'Transfer', { sender: userId, recipient: recipientUserId, amount, status: 'failed - insufficient balance' }, connection);
      await connection.commit();
      return res.status(400).json({ message: 'Insufficient balance' });
    }

    // 3. Tambahkan saldo ke penerima jika pemotongan saldo pengirim berhasil
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

// Controller untuk proses Pembayaran (Payment) tagihan atau layanan
const payment = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const userId = req.user.id;
    const { amount, pin, description } = req.body;

    if (!amount || amount <= 0 || !pin) {
      return res.status(400).json({ message: 'Amount (>0) and pin are required' });
    }

    // Verifikasi PIN demi keamanan
    if (!(await verifyPin(userId, pin))) {
      return res.status(401).json({ message: 'Invalid PIN' });
    }

    const wallet = await walletModel.getWalletByUserId(userId);
    if (!wallet) {
      return res.status(404).json({ message: 'Wallet not found' });
    }

    await connection.beginTransaction();

    // 1. Buat catatan transaksi dengan tipe 'payment'
    const transactionId = await transactionModel.createTransaction(wallet.id, 'payment', amount, description || 'Payment', null, connection);

    // 2. Kurangi saldo user (mengembalikan false jika saldo tidak mencukupi)
    const success = await walletModel.updateBalance(wallet.id, -amount, connection);
    if (!success) {
      // Saldo kurang, gagalkan transaksi
      await transactionModel.updateTransactionStatus(transactionId, 'failed', connection);
      await auditLogModel.createAuditLog(transactionId, 'Payment', { userId, amount, status: 'failed - insufficient balance' }, connection);
      await connection.commit();
      return res.status(400).json({ message: 'Insufficient balance' });
    }

    // Pembayaran berhasil
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

// Controller untuk mendapatkan daftar transaksi
const getTransactions = async (req, res) => {
  try {
    if (req.user.role === 'auditor') {
      // Auditor memiliki izin tertinggi untuk melihat SEMUA transaksi, termasuk yang sudah dihapus secara sistem
      const transactions = await transactionModel.getTransactions(true);
      return res.status(200).json({ data: transactions });
    } else if (req.user.role === 'admin') {
      // Admin hanya melihat semua transaksi yang berstatus aktif (belum terhapus)
      const transactions = await transactionModel.getTransactions(false);
      return res.status(200).json({ data: transactions });
    } else {
      // User biasa hanya boleh melihat riwayat transaksi miliknya sendiri
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

// Controller khusus Admin untuk mengubah status dari sebuah transaksi
const updateTransactionStatus = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const { id } = req.params;
    const { status } = req.body;

    // Pastikan status yang dikirim adalah valid
    if (!['pending', 'success', 'failed', 'reversed'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    await connection.beginTransaction();

    const transaction = await transactionModel.getTransactionById(id);
    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    // Logika Pengembalian Saldo (Refund) jika transaksi dibatalkan / di-reverse
    if (status === 'reversed' && transaction.status === 'success') {
      if (transaction.type === 'topup') {
        // Jika top up dibatalkan, kurangi kembali saldo user
        const success = await walletModel.updateBalance(transaction.wallet_id, -transaction.amount, connection);
        if (!success) {
          await connection.rollback();
          return res.status(400).json({ message: 'Cannot reverse topup: user has insufficient balance' });
        }
      } else if (transaction.type === 'payment') {
        // Jika payment dibatalkan, kembalikan uangnya
        await walletModel.updateBalance(transaction.wallet_id, transaction.amount, connection);
      } else if (transaction.type === 'transfer') {
        // Jika transfer dibatalkan, ambil uang dari penerima dan kembalikan ke pengirim
        const deductSuccess = await walletModel.updateBalance(transaction.recipient_wallet_id, -transaction.amount, connection);
        if (!deductSuccess) {
          await connection.rollback();
          return res.status(400).json({ message: 'Cannot reverse transfer: recipient has insufficient balance' });
        }
        await walletModel.updateBalance(transaction.wallet_id, transaction.amount, connection);
      }
    }

    // Simpan status baru
    await transactionModel.updateTransactionStatus(id, status, connection);
    // Catat perubahan status ini ke audit log agar terekam siapa Admin yang merubahnya
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

// Controller khusus Admin untuk menghapus (soft delete) sebuah transaksi
const deleteTransaction = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const { id } = req.params;

    const transaction = await transactionModel.getTransactionById(id);
    if (!transaction) {
      connection.release();
      return res.status(404).json({ message: 'Transaction not found' });
    }

    // Jika deleted_at sudah ada isinya, berarti transaksi sudah pernah dihapus
    if (transaction.deleted_at !== null) {
      connection.release();
      return res.status(400).json({ message: 'Transaction already deleted' });
    }

    await connection.beginTransaction();

    // Ambil info admin yang melakukan penghapusan untuk keperluan logging
    const admin = await userModel.getUserById(req.user.id);
    // Ambil info user pemilik wallet (pemilik transaksi yang akan dihapus)
    const ownerWallet = await walletModel.getWalletById(transaction.wallet_id);

    // Catat aktivitas penghapusan ini secara mendetail ke audit log
    await auditLogModel.createAuditLog(
      id,
      'Delete Transaction',
      {
        deletedBy: {
          adminId: req.user.id,
          adminName: admin ? admin.name : 'Unknown',
          adminEmail: admin ? admin.email : 'Unknown'
        },
        transactionOwner: {
          userId: ownerWallet ? ownerWallet.user_id : null,
          userName: ownerWallet ? ownerWallet.user_name : 'Unknown'
        },
        transactionType: transaction.type,
        amount: transaction.amount,
        status: transaction.status
      },
      connection
    );

    // Tandai transaksi sebagai terhapus (Soft delete: hanya diupdate tanggal hapusnya, tidak di-DELETE dari tabel)
    await transactionModel.deleteTransaction(id, connection);

    await connection.commit();
    res.status(200).json({ message: 'Transaction deleted successfully' });
  } catch (error) {
    await connection.rollback();
    console.error('Delete transaction error:', error);
    res.status(500).json({ message: 'Internal server error' });
  } finally {
    connection.release();
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
