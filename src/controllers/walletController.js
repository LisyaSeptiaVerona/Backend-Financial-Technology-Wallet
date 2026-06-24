const walletModel = require('../models/walletModel');

// Controller khusus Admin/Auditor untuk melihat semua daftar wallet yang ada di sistem
const getAllWallets = async (req, res) => {
  try {
    const wallets = await walletModel.getAllWallets();
    res.status(200).json({ data: wallets });
  } catch (error) {
    console.error('Get all wallets error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Controller untuk mengambil data dari sebuah wallet berdasarkan ID-nya
const getWalletById = async (req, res) => {
  try {
    const { id } = req.params;
    const wallet = await walletModel.getWalletById(id);

    if (!wallet) {
      return res.status(404).json({ message: 'Wallet not found' });
    }

    // Keamanan (Authorization Check): 
    // Jika yang mengakses memiliki role 'user' biasa, sistem memastikan ia HANYA BISA melihat
    // wallet yang user_id-nya sama dengan akunnya (tidak bisa mengintip saldo orang lain)
    if (req.user.role === 'user' && wallet.user_id !== req.user.id) {
      return res.status(403).json({ message: 'Forbidden: You can only view your own wallet' });
    }

    res.status(200).json({
      message: 'Saldo Wallet',
      data: {
        wallet_number: wallet.wallet_number,
        balance: wallet.balance,
        status: wallet.status
      }
    });
  } catch (error) {
    console.error('Get wallet by ID error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = {
  getAllWallets,
  getWalletById
};
