// File entry point yang menyatukan konfigurasi express dari 'src/app'
const app = require('./src/app');

// Menentukan port untuk menjalankan server. Jika tidak ada di environment variables, gunakan 8080 secara default
const PORT = process.env.PORT || 8080;

// Mulai jalankan server dan dengarkan request pada port yang ditentukan
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
