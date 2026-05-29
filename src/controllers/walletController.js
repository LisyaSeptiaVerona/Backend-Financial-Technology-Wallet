const walletModel = require('../models/walletModel');

const getAllWallets = async (req, res) => {
  try {
    const wallets = await walletModel.getAllWallets();
    res.status(200).json({ data: wallets });
  } catch (error) {
    console.error('Get all wallets error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

const getWalletById = async (req, res) => {
  try {
    const { id } = req.params;
    const wallet = await walletModel.getWalletById(id);

    if (!wallet) {
      return res.status(404).json({ message: 'Wallet not found' });
    }

    if (req.user.role === 'user' && wallet.user_id !== req.user.id) {
      return res.status(403).json({ message: 'Forbidden: You can only view your own wallet' });
    }

    res.status(200).json({ data: wallet });
  } catch (error) {
    console.error('Get wallet by ID error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = {
  getAllWallets,
  getWalletById
};
