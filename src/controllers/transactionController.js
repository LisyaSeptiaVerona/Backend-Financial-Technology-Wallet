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
    const { amount, pin, description, wallet_number, payment_method } = req.body;

    // Validasi dasar: jumlah top up harus lebih dari 0 dan PIN wajib ada
    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Amount must be greater than 0' });
    }
    if (!pin) {
      return res.status(400).json({ message: 'PIN is required' });
    }

    // Verifikasi PIN sebelum memproses top up
    if (!(await verifyPin(userId, pin))) {
      return res.status(401).json({ message: 'Invalid PIN' });
    }

    // Cari wallet milik user yang sedang request
    const wallet = await walletModel.getWalletByUserId(userId);
    if (!wallet) {
      return res.status(404).json({ message: 'Wallet not found' });
    }

    // Jika user mengirim wallet_number di request body, validasi agar cocok
    if (wallet_number && wallet.wallet_number !== wallet_number) {
      return res.status(400).json({ message: 'Wallet number does not match your wallet' });
    }

    const balanceBefore = Number(wallet.balance);
    const balanceAfter = balanceBefore + Number(amount);

    // Mulai transaksi database
    await connection.beginTransaction();

    // 1. Buat catatan transaksi baru dengan tipe 'topup'
    const transDesc = description || (payment_method ? `Top Up via ${payment_method}` : 'Top Up');
    const transactionId = await transactionModel.createTransaction(wallet.id, 'topup', amount, transDesc, balanceBefore, balanceAfter, null, connection);
    
    // 2. Tambahkan saldo ke wallet user
    await walletModel.updateBalance(wallet.id, amount, connection);
    
    // 3. Ubah status transaksi menjadi 'success'
    await transactionModel.updateTransactionStatus(transactionId, 'success', connection);
    
    // 4. Catat aktivitas ini ke dalam audit log
    await auditLogModel.createAuditLog(transactionId, 'Top Up', { userId, amount, status: 'success', payment_method }, connection);

    // Simpan semua perubahan ke database secara permanen
    await connection.commit();
    
    res.status(200).json({ 
      message: 'Top up successful',
      data: {
        transaction_id: transactionId,
        wallet_number: wallet.wallet_number,
        payment_method: payment_method || 'bank_transfer',
        amount: Number(amount),
        status: 'success'
      }
    });
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
    const { recipientUserId, recipientWalletNumber, amount, pin, description } = req.body;

    // Validasi input: pastikan ada penerima (ID atau Nomor Wallet), amount (>0), dan PIN
    if ((!recipientUserId && !recipientWalletNumber) || !amount || amount <= 0 || !pin) {
      return res.status(400).json({ message: 'Recipient (ID or Wallet Number), amount (>0), and pin are required' });
    }

    // Verifikasi PIN sebelum memproses transfer
    if (!(await verifyPin(userId, pin))) {
      return res.status(401).json({ message: 'Invalid PIN' });
    }

    // Ambil data wallet pengirim (sender)
    const senderWallet = await walletModel.getWalletByUserId(userId);
    if (!senderWallet) {
      return res.status(404).json({ message: 'Sender wallet not found' });
    }

    // Ambil data wallet penerima (recipient) berdasarkan wallet number atau user ID
    let recipientWallet;
    if (recipientWalletNumber) {
      recipientWallet = await walletModel.getWalletByWalletNumber(recipientWalletNumber);
    } else {
      recipientWallet = await walletModel.getWalletByUserId(recipientUserId);
    }

    if (!recipientWallet) {
      return res.status(404).json({ message: 'Recipient wallet not found' });
    }

    // Cegah user melakukan transfer ke dirinya sendiri
    if (senderWallet.id === recipientWallet.id) {
      return res.status(400).json({ message: 'Cannot transfer to yourself' });
    }

    // Cek saldo SEBELUM memulai transaksi database
    if (Number(amount) > Number(senderWallet.balance)) {
      return res.status(400).json({ message: 'Insufficient balance' });
    }

    await connection.beginTransaction();

    const balanceBefore = Number(senderWallet.balance);
    const balanceAfter = balanceBefore - Number(amount);

    // 1. Catat transaksi dengan tipe 'transfer' yang melibatkan dompet pengirim dan penerima
    const transactionId = await transactionModel.createTransaction(
      senderWallet.id, 
      'transfer', 
      amount, 
      description || 'Transfer', 
      balanceBefore,
      balanceAfter,
      recipientWallet.id, 
      connection
    );

    // 2. Coba kurangi saldo pengirim (updateBalance mengembalikan false jika saldo jadi minus)
    const success = await walletModel.updateBalance(senderWallet.id, -amount, connection);
    if (!success) {
      // Jika saldo tidak cukup, ubah status transaksi menjadi 'failed' dan log kegagalan
      await transactionModel.updateTransactionStatus(transactionId, 'failed', connection);
      await auditLogModel.createAuditLog(transactionId, 'Transfer', { sender: userId, recipient: recipientWallet.user_id, amount, status: 'failed - insufficient balance' }, connection);
      await connection.commit();
      return res.status(400).json({ message: 'Insufficient balance' });
    }

    // 3. Tambahkan saldo ke penerima jika pemotongan saldo pengirim berhasil
    await walletModel.updateBalance(recipientWallet.id, amount, connection);
    await transactionModel.updateTransactionStatus(transactionId, 'success', connection);
    await auditLogModel.createAuditLog(transactionId, 'Transfer', { sender: userId, recipient: recipientWallet.user_id, amount, status: 'success' }, connection);

    await connection.commit();
    
    res.status(200).json({ 
      message: 'Transfer successful',
      data: {
        transaction_id: transactionId,
        sender_wallet_number: senderWallet.wallet_number,
        recipient_wallet_number: recipientWallet.wallet_number,
        amount: Number(amount),
        description: description || 'Transfer',
        status: 'success'
      }
    });
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
    const { amount, pin, description, wallet_number, payment_name } = req.body;

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

    // Jika user mengirim wallet_number di request body, validasi agar cocok
    if (wallet_number && wallet.wallet_number !== wallet_number) {
      return res.status(400).json({ message: 'Wallet number does not match your wallet' });
    }

    const balanceBefore = Number(wallet.balance);
    const balanceAfter = balanceBefore - Number(amount);
    
    // Cek saldo SEBELUM memulai transaksi database
    if (Number(amount) > balanceBefore) {
      return res.status(400).json({ message: 'Insufficient balance' });
    }

    // Identifikasi nama pembayaran (misal Netflix, Spotify)
    const paymentName = payment_name || description || 'Payment';

    await connection.beginTransaction();

    // 1. Buat catatan transaksi dengan tipe 'payment'
    const transactionId = await transactionModel.createTransaction(wallet.id, 'payment', amount, paymentName, balanceBefore, balanceAfter, null, connection);

    // 2. Kurangi saldo user (mengembalikan false jika saldo tidak mencukupi)
    const success = await walletModel.updateBalance(wallet.id, -amount, connection);
    if (!success) {
      // Saldo kurang, gagalkan transaksi
      await transactionModel.updateTransactionStatus(transactionId, 'failed', connection);
      await auditLogModel.createAuditLog(transactionId, 'Payment', { userId, amount, status: 'failed - insufficient balance', payment_name: paymentName }, connection);
      await connection.commit();
      return res.status(400).json({ message: 'Insufficient balance' });
    }

    // Pembayaran berhasil
    await transactionModel.updateTransactionStatus(transactionId, 'success', connection);
    await auditLogModel.createAuditLog(transactionId, 'Payment', { userId, amount, status: 'success', payment_name: paymentName }, connection);

    await connection.commit();
    
    res.status(200).json({ 
      message: 'Payment successful',
      data: {
        transaction_id: transactionId,
        wallet_number: wallet.wallet_number,
        payment_name: paymentName,
        amount: Number(amount),
        status: 'success'
      }
    });
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
    let rawTransactions = [];

    let formattedTransactions = [];

    if (req.user.role === 'auditor') {
      // Auditor memiliki izin tertinggi untuk melihat SEMUA transaksi
      const rawTransactions = await transactionModel.getAllTransactionsWithDetails(true);
      formattedTransactions = rawTransactions.map(tx => ({
        transaction_id: tx.id,
        user_name: tx.user_name,
        wallet_number: tx.wallet_number,
        transaction_type: tx.type,
        amount: Number(tx.amount),
        status: tx.status,
        description: tx.description,
        date_and_time: tx.created_at,
        balance_before: Number(tx.balance_before || 0),
        balance_after: Number(tx.balance_after || 0)
      }));
    } else if (req.user.role === 'admin') {
      // Admin hanya melihat semua transaksi yang berstatus aktif (belum terhapus)
      const rawTransactions = await transactionModel.getAllTransactionsWithDetails(false);
      formattedTransactions = rawTransactions.map(tx => ({
        transaction_id: tx.id,
        user_name: tx.user_name,
        wallet_number: tx.wallet_number,
        transaction_type: tx.type,
        amount: Number(tx.amount),
        status: tx.status,
        description: tx.description,
        date_and_time: tx.created_at,
        balance_before: Number(tx.balance_before || 0),
        balance_after: Number(tx.balance_after || 0)
      }));
    } else {
      // User biasa hanya boleh melihat riwayat transaksi miliknya sendiri
      const wallet = await walletModel.getWalletByUserId(req.user.id);
      if (!wallet) return res.status(404).json({ message: 'Wallet not found' });
      const rawTransactions = await transactionModel.getTransactionsByWalletId(wallet.id);
      formattedTransactions = rawTransactions.map(tx => ({
        transaction_id: tx.id,
        transaction_type: tx.type,
        amount: Number(tx.amount),
        status: tx.status,
        description: tx.description,
        date_and_time: tx.created_at,
        balance_before: Number(tx.balance_before || 0),
        balance_after: Number(tx.balance_after || 0)
      }));
    }

    return res.status(200).json({ data: formattedTransactions });
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
    const newStatus = status ? status.toLowerCase() : '';

    // Pastikan status yang dikirim adalah valid
    if (!['pending', 'success', 'failed', 'reversed'].includes(newStatus)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    await connection.beginTransaction();

    const transaction = await transactionModel.getTransactionById(id);
    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    const oldStatus = transaction.status;

    // Logika penyesuaian saldo berdasarkan perubahan status
    if (oldStatus !== newStatus) {
      const wasSuccess = oldStatus === 'success';
      const isSuccess = newStatus === 'success';

      if (wasSuccess && !isSuccess) {
        // BATALKAN transaksi yang sebelumnya sukses (refund/reverse/fail)
        if (transaction.type === 'topup') {
          // Kurangi kembali saldo user
          const success = await walletModel.updateBalance(transaction.wallet_id, -transaction.amount, connection);
          if (!success) {
            await connection.rollback();
            return res.status(400).json({ message: 'Cannot undo topup: user has insufficient balance' });
          }
        } else if (transaction.type === 'payment') {
          // Kembalikan saldo ke user
          await walletModel.updateBalance(transaction.wallet_id, transaction.amount, connection);
        } else if (transaction.type === 'transfer') {
          // Ambil uang dari penerima, kembalikan ke pengirim
          const deductSuccess = await walletModel.updateBalance(transaction.recipient_wallet_id, -transaction.amount, connection);
          if (!deductSuccess) {
            await connection.rollback();
            return res.status(400).json({ message: 'Cannot undo transfer: recipient has insufficient balance' });
          }
          await walletModel.updateBalance(transaction.wallet_id, transaction.amount, connection);
        }
      } else if (!wasSuccess && isSuccess) {
        // JALANKAN transaksi yang sebelumnya belum sukses/gagal/pending menjadi sukses
        if (transaction.type === 'topup') {
          // Tambah saldo user
          await walletModel.updateBalance(transaction.wallet_id, transaction.amount, connection);
        } else if (transaction.type === 'payment') {
          // Kurangi saldo user
          const success = await walletModel.updateBalance(transaction.wallet_id, -transaction.amount, connection);
          if (!success) {
            await connection.rollback();
            return res.status(400).json({ message: 'Cannot approve payment: user has insufficient balance' });
          }
        } else if (transaction.type === 'transfer') {
          // Kurangi saldo pengirim, tambah saldo penerima
          const deductSuccess = await walletModel.updateBalance(transaction.wallet_id, -transaction.amount, connection);
          if (!deductSuccess) {
            await connection.rollback();
            return res.status(400).json({ message: 'Cannot approve transfer: sender has insufficient balance' });
          }
          await walletModel.updateBalance(transaction.recipient_wallet_id, transaction.amount, connection);
        }
      }
    }

    // Simpan status baru
    await transactionModel.updateTransactionStatus(id, newStatus, connection);
    // Catat perubahan status ini ke audit log agar terekam siapa Admin yang merubahnya
    await auditLogModel.createAuditLog(id, 'Update Status', { oldStatus, newStatus, adminId: req.user.id }, connection);

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

// Controller khusus Admin untuk mengubah status dari sebuah transaksi Top Up secara terpisah
const updateTopUpStatus = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const { id } = req.params;
    const { status } = req.body;
    const newStatus = status ? status.toLowerCase() : '';

    if (!['pending', 'success', 'failed', 'reversed'].includes(newStatus)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    await connection.beginTransaction();

    const transaction = await transactionModel.getTransactionById(id);
    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    if (transaction.type !== 'topup') {
      await connection.rollback();
      return res.status(400).json({ message: 'Transaction is not a topup' });
    }

    const oldStatus = transaction.status;

    if (oldStatus !== newStatus) {
      const wasSuccess = oldStatus === 'success';
      const isSuccess = newStatus === 'success';

      if (wasSuccess && !isSuccess) {
        // BATALKAN topup yang sebelumnya sukses
        const success = await walletModel.updateBalance(transaction.wallet_id, -transaction.amount, connection);
        if (!success) {
          await connection.rollback();
          return res.status(400).json({ message: 'Cannot undo topup: user has insufficient balance' });
        }
      } else if (!wasSuccess && isSuccess) {
        // JALANKAN topup yang sebelumnya pending/failed menjadi sukses
        await walletModel.updateBalance(transaction.wallet_id, transaction.amount, connection);
      }
    }

    await transactionModel.updateTransactionStatus(id, newStatus, connection);
    await auditLogModel.createAuditLog(id, 'Update TopUp Status', { oldStatus, newStatus, adminId: req.user.id }, connection);

    await connection.commit();
    res.status(200).json({ message: 'Top up status updated successfully' });
  } catch (error) {
    await connection.rollback();
    console.error('Update topup status error:', error);
    res.status(500).json({ message: 'Internal server error' });
  } finally {
    connection.release();
  }
};

// Controller khusus Admin untuk mengubah status dari sebuah transaksi Payment secara terpisah
const updatePaymentStatus = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const { id } = req.params;
    const { status } = req.body;
    const newStatus = status ? status.toLowerCase() : '';

    if (!['pending', 'success', 'failed', 'reversed'].includes(newStatus)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    await connection.beginTransaction();

    const transaction = await transactionModel.getTransactionById(id);
    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    if (transaction.type !== 'payment') {
      await connection.rollback();
      return res.status(400).json({ message: 'Transaction is not a payment' });
    }

    const oldStatus = transaction.status;

    if (oldStatus !== newStatus) {
      const wasSuccess = oldStatus === 'success';
      const isSuccess = newStatus === 'success';

      if (wasSuccess && !isSuccess) {
        // BATALKAN payment yang sebelumnya sukses (kembalikan uang ke user)
        await walletModel.updateBalance(transaction.wallet_id, transaction.amount, connection);
      } else if (!wasSuccess && isSuccess) {
        // JALANKAN payment yang sebelumnya pending/failed menjadi sukses
        const success = await walletModel.updateBalance(transaction.wallet_id, -transaction.amount, connection);
        if (!success) {
          await connection.rollback();
          return res.status(400).json({ message: 'Cannot approve payment: user has insufficient balance' });
        }
      }
    }

    await transactionModel.updateTransactionStatus(id, newStatus, connection);
    await auditLogModel.createAuditLog(id, 'Update Payment Status', { oldStatus, newStatus, adminId: req.user.id }, connection);

    await connection.commit();
    res.status(200).json({ message: 'Payment status updated successfully' });
  } catch (error) {
    await connection.rollback();
    console.error('Update payment status error:', error);
    res.status(500).json({ message: 'Internal server error' });
  } finally {
    connection.release();
  }
};

// Controller khusus Admin untuk mengubah status dari sebuah transaksi Transfer secara terpisah
const updateTransferStatus = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const { id } = req.params;
    const { status } = req.body;
    const newStatus = status ? status.toLowerCase() : '';

    if (!['pending', 'success', 'failed', 'reversed'].includes(newStatus)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    await connection.beginTransaction();

    const transaction = await transactionModel.getTransactionById(id);
    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    if (transaction.type !== 'transfer') {
      await connection.rollback();
      return res.status(400).json({ message: 'Transaction is not a transfer' });
    }

    const oldStatus = transaction.status;

    if (oldStatus !== newStatus) {
      const wasSuccess = oldStatus === 'success';
      const isSuccess = newStatus === 'success';

      if (wasSuccess && !isSuccess) {
        // BATALKAN transfer yang sebelumnya sukses (tarik dari penerima, kembalikan ke pengirim)
        const deductSuccess = await walletModel.updateBalance(transaction.recipient_wallet_id, -transaction.amount, connection);
        if (!deductSuccess) {
          await connection.rollback();
          return res.status(400).json({ message: 'Cannot undo transfer: recipient has insufficient balance' });
        }
        await walletModel.updateBalance(transaction.wallet_id, transaction.amount, connection);
      } else if (!wasSuccess && isSuccess) {
        // JALANKAN transfer yang sebelumnya pending/failed menjadi sukses
        const deductSuccess = await walletModel.updateBalance(transaction.wallet_id, -transaction.amount, connection);
        if (!deductSuccess) {
          await connection.rollback();
          return res.status(400).json({ message: 'Cannot approve transfer: sender has insufficient balance' });
        }
        await walletModel.updateBalance(transaction.recipient_wallet_id, transaction.amount, connection);
      }
    }

    await transactionModel.updateTransactionStatus(id, newStatus, connection);
    await auditLogModel.createAuditLog(id, 'Update Transfer Status', { oldStatus, newStatus, adminId: req.user.id }, connection);

    await connection.commit();
    res.status(200).json({ message: 'Transfer status updated successfully' });
  } catch (error) {
    await connection.rollback();
    console.error('Update transfer status error:', error);
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
  updateTopUpStatus,
  updatePaymentStatus,
  updateTransferStatus
};
