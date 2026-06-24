const walletModel = require('../models/walletModel');

// Controller khusus Admin/Auditor untuk melihat semua daftar wallet yang ada di sistem
const getAllWallets = async (req, res) => {
  try {
    const wallets = await walletModel.getAllWallets();
    res.status(200).json({
      message: 'All wallet balances retrieved successfully',
      data: wallets.map(w => ({
        id: w.id,
        user_id: w.user_id,
        user_name: w.user_name,
        wallet_number: w.wallet_number,
        balance: w.balance,
        status: w.status
      }))
    });
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

    const responseData = {
      wallet_number: wallet.wallet_number,
      balance: wallet.balance,
      status: wallet.status
    };

    // Jika yang mengakses adalah admin atau auditor, berikan informasi kepemilikan wallet
    if (req.user.role === 'admin' || req.user.role === 'auditor') {
      responseData.id = wallet.id;
      responseData.user_id = wallet.user_id;
      responseData.user_name = wallet.user_name;
    }

    res.status(200).json({
      message: 'Wallet balance retrieved successfully',
      data: responseData
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
