# Gopay – Backend Financial Technology Wallet

## 📖 Deskripsi
Aplikasi **Gopay** adalah backend API berbasis **Node.js** dan **Express.js** yang menyediakan fitur transaksi keuangan digital (Top‑up, Transfer, Payment), manajemen wallet, serta kontrol akses berbasis role (User, Admin, Auditor). Semua data disimpan di **MySQL**.

---

## 🚀 Cara Menjalankan
1. **Clone repository**
   ```bash
   git clone <repo_url>
   cd 2311103022_Gopay
   ```
2. **Install dependencies**
   ```bash
   npm install
   ```
3. **Siapkan environment**
   - Salin file contoh `.env.example` menjadi `.env` (jika tidak ada, buat manual) dan isi nilai berikut:
     ```env
     DB_HOST=localhost
     DB_USER=root
     DB_PASSWORD=your_password
     DB_NAME=gopay
     JWT_SECRET=your_jwt_secret
     PORT=3000
     ```
4. **Migrasi & seed database**
   ```bash
   node migrate.js   # atau npm run migrate (jika script ada)
   ```
5. **Jalankan server**
   ```bash
   npm start   # atau node server.js
   ```
   Server akan tersedia di `http://localhost:3000`.

---

## 📂 Struktur Folder
```
2311103022_Gopay/
│   .env                # ← variabel lingkungan (rahasia, tidak di‑git)
│   .gitignore          # file/folder yang tidak di‑track Git
│   database.sql        # skrip schema & seed data MySQL
│   migrate.js          # utility untuk membuat/seed tabel DB
│   package.json
│   package-lock.json
│   server.js           # entry‑point, mem‑boot Express
│
└── src/                # kode sumber (MVC)
    ├── config/          # konfigurasi DB, dsb.
    │   └── database.js
    ├── controllers/     # logic bisnis per resource
    │   ├── authController.js
    │   ├── userController.js
    │   ├── transactionController.js
    │   ├── walletController.js
    │   └── auditLogController.js
    ├── middlewares/    # middleware pre‑processing
    │   ├── auth.js        # verifikasi JWT
    │   └── role.js        # RBAC checker
    ├── models/         # query DB (CRUD)
    │   ├── userModel.js
    │   ├── transactionModel.js
    │   ├── walletModel.js
    │   └── auditLogModel.js
    ├── routes/         # definisi endpoint REST
    │   ├── auth.js
    │   ├── user.js
    │   ├── transaction.js
    │   ├── wallet.js
    │   └── auditLog.js
    └── app.js          # konfigurasi Express, middleware, route mounting
```

---

## 📚 Dokumentasi API (Postman Collection)
Semua endpoint didefinisikan dalam folder **`docs/`**:
- **`docs/API_DOC.md`** – deskripsi lengkap tiap endpoint, contoh request/response, dan role yang di‑otorisasi.
- **`docs/Gopay_API_Collection.json`** – file Postman Collection (import ke Postman).
- **`docs/Gopay_API_Doc.pdf`** – PDF yang di‑generate dari Postman (untuk referensi offline).

> **Catatan:** Anda dapat meng‑import `docs/Gopay_API_Collection.json` ke Postman, men‑set lingkungan (`environment`) dengan variabel `baseUrl` (`http://localhost:3000`) serta men‑ambahkan token JWT yang sesuai (`user`, `admin`, atau `auditor`).

---

## 🗄️ Dokumentasi Basis Data
- **`docs/DB_ErDiagram.png`** – diagram ER yang menggambarkan tabel `users`, `wallets`, `transactions`, `audit_logs` dan relasinya.
- **`docs/Database_Schema.md`** – penjelasan singkat tiap tabel (field, tipe, kunci utama, foreign key).

---

## 🧪 Pengujian (Postman)
1. **Import collection** (`docs/Gopay_API_Collection.json`).
2. **Buat environment** dengan variabel:
   - `baseUrl` → `http://localhost:3000`
   - `token_user`, `token_admin`, `token_auditor` (isi JWT yang didapat setelah login).
3. **Jalankan folder “Role & Authorization”** dalam collection untuk memverifikasi:
   - `200 OK` untuk endpoint yang di‑otorisasi.
   - `403 Forbidden` bila role tidak memiliki izin.
   - `401 Unauthorized` bila token tidak ada atau tidak valid.

---

## 📦 Skrip Migrasi (`migrate.js`)
`migrate.js` berisi perintah yang mengeksekusi `database.sql` untuk membuat tabel, menambah constraint, dan meng‑seed data awal (contoh user admin, auditor, dan user biasa). Jalankan sekali setelah membuat database kosong.

---

## 🛡️ Keamanan
- **JWT** digunakan untuk otentikasi, disimpan di header `Authorization: Bearer <token>`.
- **Middleware `auth.js`** memverifikasi token dan men‑attach `req.user`.
- **Middleware `role.js`** memeriksa `req.user.role` terhadap role yang di‑izinkan per route (User, Admin, Auditor).
- Semua **credential** berada di `.env` yang **tidak** di‑track oleh Git (terdaftar di `.gitignore`).

---

## 📧 Kontak & Kontribusi
Jika menemukan bug atau ingin menambah fitur, silakan buat *issue* atau *pull request* pada repository.

---

*Dibuat pada 2026‑06‑25*
