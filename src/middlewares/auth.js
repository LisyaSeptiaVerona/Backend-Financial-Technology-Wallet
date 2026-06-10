const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
  // Ambil token dari header Authorization (format yang diharapkan: "Bearer <token>")
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  // Jika tidak ada token yang dilampirkan, tolak akses
  if (!token) {
    return res.status(401).json({ message: 'Access denied. No token provided.' });
  }

  // Verifikasi keabsahan token JWT menggunakan secret key yang ada di environment variable
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(401).json({ message: 'Invalid or expired token.' });
    }
    
    // Simpan informasi user (seperti id dan role yang ada di dalam token) ke dalam object request (req.user)
    // Hal ini berguna agar data user tersebut bisa diakses oleh controller/endpoint selanjutnya
    req.user = user;
    next();
  });
};

module.exports = authenticateToken;
