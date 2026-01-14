// TODO: Definisikan semua jalur (Route) aplikasi kalian disini (GET, POST, PUT, DELETE)
const express = require('express');
const router = express.Router();
const db = require('../config/database');

// --- MIDDLEWARE PROTEKSI ---
// Memastikan user sudah login dan memiliki role yang sesuai sebelum akses halaman
const auth = (role) => {
    return (req, res, next) => {
        if (req.session.user && req.session.user.role === role) {
            next();
        } else {
            res.send("<script>alert('Akses Ditolak! Silakan Login terlebih dahulu.'); window.location='/';</script>");
        }
    };
};

// --- ROUTES AUTH (LOGIN & LOGOUT) ---

// Halaman Utama: Form Login
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

            // Redirect otomatis berdasarkan Role
            if (user.role === 'admin') return res.redirect('/admin/' + user.id);
            if (user.role === 'psikolog') return res.redirect('/psikolog/' + user.id);
            if (user.role === 'mahasiswa') return res.redirect('/mahasiswa/' + user.id);
        } else {
            res.send("<script>alert('Username atau Password salah!'); window.location='/';</script>");
        }
    } catch (err) {
        console.error(err);
        res.status(500).send("Database Error");
    }
});

// Logout: Menghapus session
router.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

// --- ROUTES DASHBOARD MAHASISWA ---

// Tampilan Dashboard Mahasiswa
router.get('/mahasiswa/:id', auth('mahasiswa'), async (req, res) => {
    try {
        const mhsId = req.params.id;
        // Ambil daftar psikolog yang aktif untuk dropdown
        const [psikolog] = await db.query('SELECT * FROM psikolog_status WHERE is_active = 1');
        // Ambil riwayat reservasi milik mahasiswa ini
        const [reservasi] = await db.query('SELECT * FROM reservasi WHERE mahasiswa_id = ?', [mhsId]);
        
        res.render('mahasiswa_dashboard', { psikolog, reservasi, mhsId });
    } catch (err) {
        res.status(500).send("Gagal memuat dashboard mahasiswa");
    }
});

// Aksi: Tambah Reservasi Baru
router.post('/reservasi/add', auth('mahasiswa'), async (req, res) => {
    try {
        const { mhsId, nim, nama, tanggal, waktu, psikologId } = req.body;
        
        if (!psikologId) {
            return res.send("<script>alert('Pilih psikolog!'); window.history.back();</script>");
        }

        await db.query(
            'INSERT INTO reservasi (mahasiswa_id, nama_mhs, nim, tanggal, waktu, psikolog_id) VALUES (?,?,?,?,?,?)', 
            [mhsId, nama, nim, tanggal, waktu, psikologId]
        );
        res.redirect(`/mahasiswa/${mhsId}`);
    } catch (err) {
        console.error(err);
        res.status(500).send("Gagal menyimpan reservasi (Error 502 Protection)");
    }
});

// Aksi: Hapus/Batal Reservasi
router.get('/reservasi/delete/:id/:mhsId', auth('mahasiswa'), async (req, res) => {
    await db.query('DELETE FROM reservasi WHERE id = ?', [req.params.id]);
    res.redirect(`/mahasiswa/${req.params.mhsId}`);
});

// --- ROUTES DASHBOARD PSIKOLOG ---

// Tampilan Dashboard Psikolog: Menampilkan reservasi yang ditujukan padanya
router.get('/psikolog/:id', auth('psikolog'), async (req, res) => {
    try {
        const psiId = req.params.id;
        const [daftar] = await db.query('SELECT * FROM reservasi WHERE psikolog_id = ?', [psiId]);
        res.render('psikolog_dashboard', { daftar, psiId });
    } catch (err) {
        res.status(500).send("Gagal memuat dashboard psikolog");
    }
});

// Aksi: Update Status (Terima/Tolak)
router.post('/psikolog/update-status', auth('psikolog'), async (req, res) => {
    const { resId, status, psiId } = req.body;
    try {
        if (status === 'ditolak') {
            await db.query('DELETE FROM reservasi WHERE id = ?', [resId]); // Hapus jika ditolak
        } else {
            await db.query('UPDATE reservasi SET status = ? WHERE id = ?', [status, resId]); // Update jika diterima
        }
        res.redirect(`/psikolog/${psiId}`);
    } catch (err) {
        res.status(500).send("Gagal update status");
    }
});

// --- ROUTES DASHBOARD ADMIN ---

// Tampilan Dashboard Admin
router.get('/admin/:id', auth('admin'), async (req, res) => {
    try {
        const [psikolog] = await db.query('SELECT * FROM psikolog_status');
        const [totalRes] = await db.query('SELECT COUNT(*) as total FROM reservasi');
        res.render('admin_dashboard', { 
            psikolog, 
            total: totalRes[0].total, 
            adminId: req.params.id 
        });
    } catch (err) {
        res.status(500).send("Gagal memuat dashboard admin");
    }
});

// Aksi: Admin Menambah Psikolog Baru
router.post('/admin/psikolog/add', auth('admin'), async (req, res) => {
    const { nama, jadwal } = req.body;
    const adminId = req.session.user.id;
    await db.query('INSERT INTO psikolog_status (nama_psikolog, jadwal_tugas, is_active) VALUES (?, ?, 1)', [nama, jadwal]);
    res.redirect('/admin/' + adminId);
});

module.exports = router;