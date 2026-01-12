// TODO: Definisikan semua jalur (Route) aplikasi kalian disini (GET, POST, PUT, DELETE)
const express = require('express');
const router = express.Router();
const db = require('../config/database');

// --- MIDDLEWARE PROTEKSI ---
// Mengecek apakah user sudah login dan memiliki role yang sesuai
const auth = (role) => {
    return (req, res, next) => {
        if (req.session.user && req.session.user.role === role) {
            next();
        } else {
            res.send("<script>alert('Akses Ditolak! Silakan Login terlebih dahulu.'); window.location='/';</script>");
        }
    };
};

// --- ROUTES LOGIN & LOGOUT ---

// Halaman Login (Ganti index lama menjadi login)
router.get('/', (req, res) => {
    res.render('login');
});

// Proses Verifikasi Login
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const [users] = await db.query('SELECT * FROM users WHERE username = ? AND password = ?', [username, password]);

        if (users.length > 0) {
            const user = users[0];
            req.session.user = user; // Simpan data user ke session

            // Redirect otomatis sesuai Role
            if (user.role === 'admin') return res.redirect('/admin/' + user.id);
            if (user.role === 'psikolog') return res.redirect('/psikolog/' + user.id);
            if (user.role === 'mahasiswa') return res.redirect('/mahasiswa/' + user.id);
        } else {
            res.send("<script>alert('Username atau Password salah!'); window.location='/';</script>");
        }
    } catch (err) {
        res.status(500).send("Database Error");
    }
});

// Proses Logout
router.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

// --- ROUTES DASHBOARD (DIPROTEKSI) ---

// 1. Dashboard Mahasiswa
router.get('/mahasiswa/:id', auth('mahasiswa'), async (req, res) => {
    const [psikolog] = await db.query('SELECT * FROM psikolog_status WHERE is_active = 1');
    const [reservasi] = await db.query('SELECT * FROM reservasi WHERE mahasiswa_id = ?', [req.params.id]);
    res.render('mahasiswa_dashboard', { psikolog, reservasi, mhsId: req.params.id });
});

// 2. Dashboard Psikolog
router.get('/psikolog/:id', auth('psikolog'), async (req, res) => {
    const [daftar] = await db.query('SELECT * FROM reservasi WHERE psikolog_id = ?', [req.params.id]);
    res.render('psikolog_dashboard', { daftar, psiId: req.params.id });
});

// 3. Dashboard Admin
router.get('/admin/:id', auth('admin'), async (req, res) => {
    const [psikolog] = await db.query('SELECT * FROM psikolog_status');
    const [stats] = await db.query('SELECT status, COUNT(*) as jml FROM reservasi GROUP BY status');
    const [totalRes] = await db.query('SELECT COUNT(*) as total FROM reservasi');
    res.render('admin_dashboard', { 
        psikolog, 
        stats, 
        total: totalRes[0].total, 
        adminId: req.params.id 
    });
});

// --- FITUR AKSI ---

// Mahasiswa: Tambah Reservasi [cite: 6]
router.post('/reservasi/add', auth('mahasiswa'), async (req, res) => {
    const { mhsId, nim, nama, tanggal, waktu, psikologId } = req.body;
    await db.query('INSERT INTO reservasi (mahasiswa_id, nama_mhs, nim, tanggal, waktu, psikolog_id) VALUES (?,?,?,?,?,?)', 
    [mhsId, nama, nim, tanggal, waktu, psikologId]);
    res.redirect(`/mahasiswa/${mhsId}`);
});

// Mahasiswa: Hapus/Batal Reservasi [cite: 10]
router.get('/reservasi/delete/:id/:mhsId', auth('mahasiswa'), async (req, res) => {
    await db.query('DELETE FROM reservasi WHERE id = ?', [req.params.id]);
    res.redirect(`/mahasiswa/${req.params.mhsId}`);
});

// Psikolog: Update Status (Terima/Tolak) [cite: 14, 18]
router.post('/psikolog/update-status', auth('psikolog'), async (req, res) => {
    const { resId, status, psiId } = req.body;
    if (status === 'ditolak') {
        // Jika ditolak, otomatis terhapus sesuai spesifikasi [cite: 18]
        await db.query('DELETE FROM reservasi WHERE id = ?', [resId]);
    } else {
        await db.query('UPDATE reservasi SET status = ? WHERE id = ?', [status, resId]);
    }
    res.redirect(`/psikolog/${psiId}`);
});

// Admin: Tambah Psikolog [cite: 19]
router.post('/admin/psikolog/add', auth('admin'), async (req, res) => {
    const { nama, jadwal } = req.body;
    await db.query('INSERT INTO psikolog_status (nama_psikolog, jadwal_tugas, is_active) VALUES (?, ?, 1)', [nama, jadwal]);
    res.redirect('/admin/1');
});

module.exports = router;