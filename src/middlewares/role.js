const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    // req.user sudah di-set sebelumnya oleh middleware auth (authenticateToken)
    // Cek apakah informasi user tersedia dan apakah role-nya termasuk dalam daftar role yang diizinkan untuk endpoint ini
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Forbidden: You do not have enough permissions.' });
    }
    
    // Jika role sesuai dengan yang diizinkan, izinkan proses berlanjut ke controller
    next();
  };
};

module.exports = authorizeRoles;
