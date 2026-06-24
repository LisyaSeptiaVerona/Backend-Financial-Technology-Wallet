const bcrypt = require('bcrypt');
const userModel = require('../models/userModel');
const walletModel = require('../models/walletModel');
const transactionModel = require('../models/transactionModel');

// Controller untuk mengambil data wallet pengguna
const getWallets = async (req, res) => {
  try {
    // req.user.id didapatkan dari token JWT (via auth middleware)
    const userId = req.user.id; 

    const wallet = await userModel.getUserWallet(userId);
    
    if (!wallet) {
      return res.status(404).json({ message: 'Wallet not found' });
    }

    res.status(200).json({
      message: 'Wallet account data retrieved successfully',
      data: wallet
    });
  } catch (error) {
    console.error('Get wallet error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Endpoint simulasi Dashboard khusus role Admin
const getAdminDashboard = async (req, res) => {
  res.status(200).json({
    message: 'Welcome Admin! This data is top secret and only visible to admin role.',
    data: { total_users: 100, system_status: 'Online' }
  });
};

// Endpoint simulasi Dashboard khusus role User biasa (Dashboard Transaksi dan Saldo)
const getUserDashboard = async (req, res) => {
  try {
    const userId = req.user.id;

    // 1. Ambil data wallet user beserta informasi user (nama, email)
    const wallet = await userModel.getUserWallet(userId);
    if (!wallet) {
      return res.status(404).json({ message: 'Wallet not found' });
    }

    // 2. Ambil semua riwayat transaksi untuk wallet ini
    const transactions = await transactionModel.getTransactionsByWalletId(wallet.id);

    // 3. Hitung ringkasan transaksi
    const totalTransactions = transactions.length;

    const totalTopUp = transactions.filter(tx => tx.type === 'topup').length;
    const totalTransfer = transactions.filter(tx => tx.type === 'transfer').length;
    const totalPayment = transactions.filter(tx => tx.type === 'payment').length;

    const totalSuccess = transactions.filter(tx => tx.status === 'success').length;
    const totalFailed = transactions.filter(tx => tx.status === 'failed').length;
    const totalPending = transactions.filter(tx => tx.status === 'pending').length;

    // 4. Buat data grafik perkembangan saldo (7 hari terakhir)
    const dates = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      dates.push(dateStr);
    }

    const currentBalance = Number(wallet.balance);
    const events = [{ time: new Date(), balance: currentBalance }];
    let tempBal = currentBalance;

    for (const tx of transactions) {
      if (tx.status !== 'success') continue;
      const txTime = new Date(tx.created_at);
      if (tx.wallet_id === wallet.id) {
        // User adalah pengirim/pembayar (saldo berkurang, sebelum transaksi saldo lebih besar)
        events.push({ time: txTime, balance: Number(tx.balance_after || 0) });
        tempBal = Number(tx.balance_before || 0);
      } else if (tx.recipient_wallet_id === wallet.id) {
        // User adalah penerima transfer (saldo bertambah, sebelum transaksi saldo lebih kecil)
        events.push({ time: txTime, balance: tempBal });
        tempBal = tempBal - Number(tx.amount || 0);
      }
    }
    events.push({ time: new Date(0), balance: tempBal });

    const balanceHistory = dates.map(dateStr => {
      const dayEnd = new Date(dateStr + 'T23:59:59.999Z');
      const sortedEvents = [...events].sort((a, b) => a.time - b.time);
      let dayBalance = tempBal;
      for (const event of sortedEvents) {
        if (event.time <= dayEnd) {
          dayBalance = event.balance;
        } else {
          break;
        }
      }
      return { date: dateStr, balance: dayBalance };
    });

    // 5. Buat data grafik jumlah transaksi berdasarkan jenis transaksi (7 hari terakhir)
    const transactionHistoryChart = dates.map(dateStr => {
      const startOfDay = new Date(dateStr + 'T00:00:00.000Z');
      const endOfDay = new Date(dateStr + 'T23:59:59.999Z');

      const dailyTxs = transactions.filter(tx => {
        const txTime = new Date(tx.created_at);
        return txTime >= startOfDay && txTime <= endOfDay;
      });

      const topupCount = dailyTxs.filter(tx => tx.type === 'topup').length;
      const transferCount = dailyTxs.filter(tx => tx.type === 'transfer').length;
      const paymentCount = dailyTxs.filter(tx => tx.type === 'payment').length;

      return {
        date: dateStr,
        'Top Up': topupCount,
        'Transfer': transferCount,
        'Payment': paymentCount,
        total: dailyTxs.length
      };
    });

    // 6. 5 transaksi terbaru
    const recentTransactions = transactions.slice(0, 5).map(tx => ({
      transaction_id: tx.id,
      transaction_type: tx.type === 'topup' ? 'Top Up' : tx.type === 'transfer' ? 'Transfer' : tx.type === 'payment' ? 'Payment' : tx.type,
      amount: Number(tx.amount),
      status: tx.status,
      description: tx.description,
      date_and_time: tx.created_at,
      balance_before: Number(tx.balance_before || 0),
      balance_after: Number(tx.balance_after || 0)
    }));

    // Jika request meminta format HTML (misal untuk tab Preview di Postman / Browser)
    if (req.query.format === 'html') {
      const balanceHistoryDates = JSON.stringify(balanceHistory.map(h => h.date));
      const balanceHistoryData = JSON.stringify(balanceHistory.map(h => h.balance));

      const txChartDates = JSON.stringify(transactionHistoryChart.map(h => h.date));
      const txChartTopup = JSON.stringify(transactionHistoryChart.map(h => h['Top Up']));
      const txChartTransfer = JSON.stringify(transactionHistoryChart.map(h => h['Transfer']));
      const txChartPayment = JSON.stringify(transactionHistoryChart.map(h => h['Payment']));

      const htmlContent = `
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>GoPay - Dashboard Transaksi & Saldo</title>
    <!-- Google Font: Outfit -->
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <!-- Tailwind CSS CDN -->
    <script src="https://cdn.tailwindcss.com"></script>
    <!-- Chart.js CDN -->
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script>
      tailwind.config = {
        theme: {
          extend: {
            fontFamily: {
              sans: ['Outfit', 'sans-serif'],
            },
          },
        },
      }
    </script>
    <style>
        body {
            background: linear-gradient(135deg, #090d16 0%, #111827 100%);
            min-height: 100vh;
            color: #f3f4f6;
        }
        .glass-card {
            background: rgba(17, 24, 39, 0.6);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border: 1px solid rgba(255, 255, 255, 0.08);
            box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
        }
        .neon-glow-teal {
            box-shadow: 0 0 20px rgba(20, 184, 166, 0.15);
        }
        .neon-glow-indigo {
            box-shadow: 0 0 20px rgba(99, 102, 241, 0.15);
        }
    </style>
</head>
<body class="p-4 md:p-8">
    <div class="max-w-7xl mx-auto space-y-6">
        
        <!-- Header -->
        <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900/40 p-6 rounded-2xl border border-white/5 glass-card">
            <div>
                <h1 class="text-3xl font-bold tracking-tight bg-gradient-to-r from-teal-400 via-cyan-400 to-indigo-400 bg-clip-text text-transparent">
                    GoPay Digital Wallet
                </h1>
                <p class="text-sm text-slate-400 mt-1">Dashboard Transaksi dan Saldo Nasabah</p>
            </div>
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-500 to-teal-500 flex items-center justify-center font-bold text-white text-lg">
                    ${wallet.user_name ? wallet.user_name.charAt(0).toUpperCase() : 'U'}
                </div>
                <div>
                    <h4 class="font-semibold text-slate-200">${wallet.user_name || 'Nasabah GoPay'}</h4>
                    <p class="text-xs text-slate-400">${wallet.email || ''}</p>
                </div>
                <span class="ml-2 px-2.5 py-1 text-xs font-semibold rounded-full bg-teal-500/10 text-teal-400 border border-teal-500/20">
                    Active
                </span>
            </div>
        </div>

        <!-- Row 1: Cards -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            <!-- Card 1: Balance (Credit Card Style) -->
            <div class="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 p-6 shadow-xl text-white transform hover:scale-[1.02] transition-transform duration-300">
                <div class="absolute -right-10 -bottom-10 w-40 h-40 bg-white/10 rounded-full blur-2xl"></div>
                <div class="absolute -left-10 -top-10 w-40 h-40 bg-black/20 rounded-full blur-2xl"></div>
                
                <div class="relative flex justify-between items-start">
                    <span class="text-xs font-semibold tracking-wider text-indigo-100 uppercase">GOPAY BALANCE CARD</span>
                    <span class="text-sm font-bold tracking-widest text-indigo-100">VISA</span>
                </div>
                
                <div class="relative mt-8">
                    <p class="text-xs text-indigo-100/80 tracking-wider">SALDO SAAT INI</p>
                    <h2 class="text-3xl font-extrabold tracking-tight mt-1">
                        Rp ${currentBalance.toLocaleString('id-ID')}
                    </h2>
                </div>
                
                <div class="relative mt-8 flex justify-between items-end">
                    <div>
                        <p class="text-[10px] text-indigo-100/60 uppercase">Nomor Wallet</p>
                        <p class="font-mono text-sm tracking-wider mt-0.5">${wallet.wallet_number}</p>
                    </div>
                    <span class="px-2 py-0.5 text-[10px] font-semibold bg-white/20 rounded-md">Primary</span>
                </div>
            </div>

            <!-- Card 2: Transaction Totals -->
            <div class="glass-card rounded-2xl p-6 flex flex-col justify-between hover:scale-[1.02] transition-transform duration-300">
                <div>
                    <span class="text-xs font-semibold tracking-wider text-slate-400 uppercase">TOTAL TRANSAKSI</span>
                    <div class="flex items-baseline gap-2 mt-2">
                        <span class="text-4xl font-extrabold text-teal-400">${totalTransactions}</span>
                        <span class="text-xs text-slate-400">kali transaksi</span>
                    </div>
                </div>
                
                <div class="grid grid-cols-3 gap-2 mt-6 pt-4 border-t border-white/5">
                    <div class="text-center">
                        <p class="text-[10px] text-slate-400 uppercase">Top Up</p>
                        <p class="text-lg font-bold text-emerald-400 mt-0.5">${totalTopUp}</p>
                    </div>
                    <div class="text-center border-x border-white/5">
                        <p class="text-[10px] text-slate-400 uppercase">Transfer</p>
                        <p class="text-lg font-bold text-indigo-400 mt-0.5">${totalTransfer}</p>
                    </div>
                    <div class="text-center">
                        <p class="text-[10px] text-slate-400 uppercase">Payment</p>
                        <p class="text-lg font-bold text-rose-400 mt-0.5">${totalPayment}</p>
                    </div>
                </div>
            </div>

            <!-- Card 3: Transaction Statuses -->
            <div class="glass-card rounded-2xl p-6 flex flex-col justify-between hover:scale-[1.02] transition-transform duration-300">
                <div>
                    <span class="text-xs font-semibold tracking-wider text-slate-400 uppercase">STATUS TRANSAKSI</span>
                    <p class="text-xs text-slate-500 mt-1">Distribusi status riwayat transaksi</p>
                </div>
                
                <div class="space-y-3 mt-4">
                    <div class="flex justify-between items-center bg-emerald-500/5 px-3 py-1.5 rounded-lg border border-emerald-500/10">
                        <span class="text-xs font-medium text-emerald-400 flex items-center gap-1.5">
                            <span class="w-1.5 h-1.5 bg-emerald-400 rounded-full"></span> Success
                        </span>
                        <span class="text-sm font-bold text-emerald-400">${totalSuccess}</span>
                    </div>
                    <div class="flex justify-between items-center bg-amber-500/5 px-3 py-1.5 rounded-lg border border-amber-500/10">
                        <span class="text-xs font-medium text-amber-400 flex items-center gap-1.5">
                            <span class="w-1.5 h-1.5 bg-amber-400 rounded-full"></span> Pending
                        </span>
                        <span class="text-sm font-bold text-amber-400">${totalPending}</span>
                    </div>
                    <div class="flex justify-between items-center bg-rose-500/5 px-3 py-1.5 rounded-lg border border-rose-500/10">
                        <span class="text-xs font-medium text-rose-400 flex items-center gap-1.5">
                            <span class="w-1.5 h-1.5 bg-rose-400 rounded-full"></span> Failed
                        </span>
                        <span class="text-sm font-bold text-rose-400">${totalFailed}</span>
                    </div>
                </div>
            </div>
        </div>

        <!-- Row 2: Charts -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <!-- Balance Chart -->
            <div class="glass-card rounded-2xl p-5 neon-glow-indigo">
                <h3 class="text-sm font-semibold tracking-wider text-slate-400 uppercase mb-4">Grafik Perkembangan Saldo (7 Hari Terakhir)</h3>
                <div class="relative h-[280px]">
                    <canvas id="balanceChart"></canvas>
                </div>
            </div>

            <!-- Transaction Count Chart -->
            <div class="glass-card rounded-2xl p-5 neon-glow-teal">
                <h3 class="text-sm font-semibold tracking-wider text-slate-400 uppercase mb-4">Grafik Jumlah Transaksi Berdasarkan Jenis</h3>
                <div class="relative h-[280px]">
                    <canvas id="transactionChart"></canvas>
                </div>
            </div>
        </div>

        <!-- Row 3: Recent Transactions Table -->
        <div class="glass-card rounded-2xl overflow-hidden">
            <div class="px-6 py-4 border-b border-white/5 flex justify-between items-center">
                <h3 class="text-sm font-semibold tracking-wider text-slate-400 uppercase">5 Transaksi Terbaru</h3>
                <span class="text-xs font-semibold text-slate-500 uppercase">Live Update</span>
            </div>
            
            <div class="overflow-x-auto">
                <table class="w-full text-left border-collapse">
                    <thead>
                        <tr class="bg-slate-900/50 text-[10px] uppercase tracking-wider text-slate-400 border-b border-white/5">
                            <th class="px-6 py-3 font-semibold">Tipe</th>
                            <th class="px-6 py-3 font-semibold">Deskripsi</th>
                            <th class="px-6 py-3 font-semibold">Nominal</th>
                            <th class="px-6 py-3 font-semibold">Tanggal & Waktu</th>
                            <th class="px-6 py-3 font-semibold">Status</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-white/5 text-sm text-slate-300">
                        ${recentTransactions.map(tx => {
                            let typeBadgeColor = 'bg-blue-500/10 text-blue-400 border-blue-500/20';
                            if (tx.transaction_type === 'Top Up') typeBadgeColor = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
                            if (tx.transaction_type === 'Transfer') typeBadgeColor = 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';
                            if (tx.transaction_type === 'Payment') typeBadgeColor = 'bg-rose-500/10 text-rose-400 border-rose-500/20';

                            let statusBadgeColor = 'bg-amber-500/10 text-amber-400 border-amber-500/20';
                            if (tx.status === 'success') statusBadgeColor = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
                            if (tx.status === 'failed') statusBadgeColor = 'bg-rose-500/10 text-rose-400 border-rose-500/20';

                            let amountSign = '-';
                            let amountColor = 'text-slate-300';
                            if (tx.transaction_type === 'Top Up') {
                                amountSign = '+';
                                amountColor = 'text-emerald-400 font-semibold';
                            } else {
                                amountColor = 'text-rose-400 font-semibold';
                            }

                            const formattedDate = new Date(tx.date_and_time).toLocaleString('id-ID', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                            });

                            return `
                            <tr class="hover:bg-white/5 transition-colors">
                                <td class="px-6 py-4">
                                    <span class="px-2 py-0.5 text-xs font-semibold rounded-md border ${typeBadgeColor}">
                                        ${tx.transaction_type}
                                    </span>
                                </td>
                                <td class="px-6 py-4 max-w-[200px] truncate text-slate-200">
                                    ${tx.description || '-'}
                                </td>
                                <td class="px-6 py-4 ${amountColor}">
                                    ${amountSign} Rp ${tx.amount.toLocaleString('id-ID')}
                                </td>
                                <td class="px-6 py-4 text-xs text-slate-400">
                                    ${formattedDate}
                                </td>
                                <td class="px-6 py-4">
                                    <span class="px-2.5 py-0.5 text-xs font-semibold rounded-full border ${statusBadgeColor} capitalize">
                                        ${tx.status}
                                    </span>
                                </td>
                            </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    </div>

    <!-- Script Chart.js setup -->
    <script>
        // Setup Balance Chart
        const ctxBalance = document.getElementById('balanceChart').getContext('2d');
        new Chart(ctxBalance, {
            type: 'line',
            data: {
                labels: ${balanceHistoryDates},
                datasets: [{
                    label: 'Saldo Akhir (Rp)',
                    data: ${balanceHistoryData},
                    borderColor: 'rgb(99, 102, 241)',
                    backgroundColor: 'rgba(99, 102, 241, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: 'rgb(20, 184, 166)',
                    pointBorderColor: '#ffffff',
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    x: {
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: { color: '#94a3b8' }
                    },
                    y: {
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: {
                            color: '#94a3b8',
                            callback: function(value) {
                                return 'Rp ' + value.toLocaleString('id-ID');
                            }
                        }
                    }
                }
            }
        });

        // Setup Transaction Chart
        const ctxTx = document.getElementById('transactionChart').getContext('2d');
        new Chart(ctxTx, {
            type: 'bar',
            data: {
                labels: ${txChartDates},
                datasets: [
                    {
                        label: 'Top Up',
                        data: ${txChartTopup},
                        backgroundColor: 'rgba(16, 185, 129, 0.85)',
                        borderRadius: 4
                    },
                    {
                        label: 'Transfer',
                        data: ${txChartTransfer},
                        backgroundColor: 'rgba(99, 102, 241, 0.85)',
                        borderRadius: 4
                    },
                    {
                        label: 'Payment',
                        data: ${txChartPayment},
                        backgroundColor: 'rgba(244, 63, 94, 0.85)',
                        borderRadius: 4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: { color: '#e2e8f0' }
                    }
                },
                scales: {
                    x: {
                        stacked: true,
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: { color: '#94a3b8' }
                    },
                    y: {
                        stacked: true,
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: {
                            color: '#94a3b8',
                            stepSize: 1
                        }
                    }
                }
            }
        });
    </script>
</body>
</html>
      `;
      return res.status(200).send(htmlContent);
    }

    res.status(200).json({
      message: 'Dashboard data retrieved successfully',
      data: {
        card_balance: currentBalance,
        wallet_number: wallet.wallet_number,
        total_transactions: totalTransactions,
        transactions_by_category: {
          'Top Up': totalTopUp,
          'Transfer': totalTransfer,
          'Payment': totalPayment
        },
        transactions_by_status: {
          'Success': totalSuccess,
          'Failed': totalFailed,
          'Pending': totalPending
        },
        balance_history: balanceHistory,
        transaction_history_chart: transactionHistoryChart,
        recent_transactions: recentTransactions
      }
    });
  } catch (error) {
    console.error('Get user dashboard error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};


// Endpoint simulasi Dashboard khusus role Auditor
const getAuditorDashboard = async (req, res) => {
  res.status(200).json({
    message: 'Welcome Auditor! Anda memiliki akses read-only untuk mengecek laporan.',
    data: { logs_reviewed: 42, pending_audits: 5 }
  });
};

// Controller untuk Admin membuat user baru secara manual (bisa memilih role admin/auditor/user)
const createUserByAdmin = async (req, res) => {
  try {
    let { name, email, password, role } = req.body;

    // Pastikan admin mengirim semua field yang wajib ada
    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: 'Name, email, password, and role are required' });
    }
    
    email = email.toLowerCase();

    // Pastikan tidak ada duplikasi email
    const existingUser = await userModel.getUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({ message: 'Email already registered' });
    }

    // Validasi role agar hanya boleh diisi oleh tipe role yang tersedia
    if (!['admin', 'user', 'auditor'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }

    // Enkripsi password menggunakan bcrypt
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Proses pembuatan user di database
    const userId = await userModel.createUser(name, email, hashedPassword, role);

    res.status(201).json({
      message: 'User created successfully by Admin',
      data: { userId, name, email, role }
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Controller untuk pengguna mengganti password mereka sendiri
const changePassword = async (req, res) => {
  try {
    const userId = req.user.id;
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ message: 'oldPassword and newPassword are required' });
    }

    const user = await userModel.getUserById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Validasi apakah password lama yang diinputkan benar
    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Incorrect old password' });
    }

    // Hash password baru sebelum disimpan ke database
    const saltRounds = 10;
    const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

    await userModel.updatePassword(userId, hashedNewPassword);

    res.status(200).json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Controller bagi Admin untuk menghapus akun pengguna (user)
const deleteUser = async (req, res) => {
  try {
    // Ambil ID user yang ingin dihapus dari URL Parameter (/:id)
    const { id } = req.params;

    const user = await userModel.getUserById(id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Mencegah admin secara tidak sengaja menghapus akunnya sendiri yang sedang dipakai login
    if (user.id === req.user.id) {
      return res.status(400).json({ message: 'Admin tidak bisa menghapus akunnya sendiri' });
    }

    await userModel.deleteUserById(id);

    res.status(200).json({ message: `User dengan ID ${id} berhasil dihapus` });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Controller untuk melihat daftar semua user di dalam sistem
const getAllUsers = async (req, res) => {
  try {
    const users = await userModel.getAllUsers();
    res.status(200).json({ data: users });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Controller bagi Admin untuk memperbarui profil/role user tertentu
const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, role } = req.body;

    if (!name || !email || !role) {
      return res.status(400).json({ message: 'Name, email, and role are required' });
    }

    const user = await userModel.getUserById(id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!['admin', 'user', 'auditor'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }

    await userModel.updateUser(id, name, email.toLowerCase(), role);
    res.status(200).json({ message: 'User updated successfully' });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Controller agar user dapat mengatur PIN transaksinya (misal untuk kebutuhan transfer/payment)
const setPin = async (req, res) => {
  try {
    const userId = req.user.id;
    const { pin } = req.body;

    // Memaksa format standar PIN: Harus persis 6 digit angka numerik (tanpa huruf/spasi)
    if (!pin || !/^\d{6}$/.test(pin)) {
      return res.status(400).json({ message: 'PIN must be 6 numeric digits' });
    }

    // Simpan PIN langsung ke tabel users (untuk sistem nyata harusnya juga dienkripsi seperti password)
    const db = require('../config/database');
    await db.query('UPDATE users SET pin = ? WHERE id = ?', [pin, userId]);

    res.status(200).json({ message: 'PIN set successfully' });
  } catch (error) {
    console.error('Set PIN error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Controller untuk Admin & Auditor melihat semua wallet semua user
const getAllWallets = async (req, res) => {
  try {
    const wallets = await userModel.getAllWallets();
    res.status(200).json({
      message: 'All wallets retrieved successfully',
      total: wallets.length,
      data: wallets
    });
  } catch (error) {
    console.error('Get all wallets error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Controller untuk Admin & Auditor melihat wallet milik user tertentu berdasarkan ID
const getWalletByUserId = async (req, res) => {
  try {
    const { id } = req.params;

    // Cek apakah user dengan ID tersebut ada di database
    const user = await userModel.getUserById(id);
    if (!user) {
      return res.status(404).json({ message: `User dengan ID ${id} tidak ditemukan` });
    }

    // Ambil data wallet milik user tersebut
    const wallet = await userModel.getWalletByUserId(id);
    if (!wallet) {
      return res.status(404).json({ message: `Wallet untuk user ID ${id} tidak ditemukan` });
    }

    res.status(200).json({
      message: `Wallet milik user ID ${id} berhasil ditemukan`,
      data: wallet
    });
  } catch (error) {
    console.error('Get wallet by user ID error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Controller untuk Admin & Auditor melihat seluruh saldo user (hanya menampilkan data saldo)
const getAllWalletsBalance = async (req, res) => {
  try {
    const wallets = await userModel.getAllWallets();
    res.status(200).json({
      message: 'All wallet balances retrieved successfully',
      data: wallets.map(w => ({
        wallet_number: w.wallet_number,
        balance: w.balance,
        status: w.status
      }))
    });
  } catch (error) {
    console.error('Get all wallets balance error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = {
  getWallets,
  getAdminDashboard,
  getUserDashboard,
  getAuditorDashboard,
  createUserByAdmin,
  changePassword,
  deleteUser,
  getAllUsers,
  updateUser,
  setPin,
  getAllWallets,
  getWalletByUserId,
  getAllWalletsBalance
};
