const express = require('express');
const router = express.Router();
const db = require('../config/database');

// Middleware Auth
const auth = (role) => {
    return (req, res, next) => {
        if (req.session.user && req.session.user.role === role) {
            next();
        } else {
            res.send("<script>alert('Akses Ditolak!'); window.location='/';</script>");
        }
    };
};

// --- AUTH ---
router.get('/', (req, res) => res.render('login'));

router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const [users] = await db.query('SELECT * FROM users WHERE username = ? AND password = ?', [username, password]);
        if (users.length > 0) {
            req.session.user = users[0];
            const u = users[0];
            if (u.role === 'admin') return res.redirect('/admin/' + u.id);
            if (u.role === 'psikolog') return res.redirect('/psikolog/' + u.id);
            if (u.role === 'mahasiswa') return res.redirect('/mahasiswa/' + u.id);
        } else {
            res.send("<script>alert('Gagal!'); window.location='/';</script>");
        }
    } catch (err) { res.status(500).send("Error"); }
});

router.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

// --- MAHASISWA (CREATE, READ, DELETE, UPDATE) ---
router.get('/mahasiswa/:id', auth('mahasiswa'), async (req, res) => {
    const [psikolog] = await db.query('SELECT * FROM psikolog_status WHERE is_active = 1');
    const [reservasi] = await db.query('SELECT * FROM reservasi WHERE mahasiswa_id = ?', [req.params.id]);
    res.render('mahasiswa_dashboard', { psikolog, reservasi, mhsId: req.params.id });
});

router.post('/reservasi/add', auth('mahasiswa'), async (req, res) => {
    try {
        const { mhsId, nim, nama, tanggal, waktu, psikologId } = req.body;
        await db.query('INSERT INTO reservasi (mahasiswa_id, nama_mhs, nim, tanggal, waktu, psikolog_id) VALUES (?,?,?,?,?,?)', [mhsId, nama, nim, tanggal, waktu, psikologId]);
        res.redirect(`/mahasiswa/${mhsId}`);
    } catch (err) { res.status(500).send("Error 502 Protection"); }
});

// FITUR BARU: Update Reservasi
router.post('/reservasi/update', auth('mahasiswa'), async (req, res) => {
    try {
        const { resId, mhsId, tanggal, waktu, psikologId } = req.body;
        // Status kembali ke 'menunggu' agar psikolog bisa memvalidasi ulang
        await db.query(
            'UPDATE reservasi SET tanggal = ?, waktu = ?, psikolog_id = ?, status = "menunggu" WHERE id = ? AND mahasiswa_id = ?',
            [tanggal, waktu, psikologId, resId, mhsId]
        );
        res.redirect(`/mahasiswa/${mhsId}`);
    } catch (err) { res.status(500).send("Update Gagal"); }
});

router.get('/reservasi/delete/:id/:mhsId', auth('mahasiswa'), async (req, res) => {
    await db.query('DELETE FROM reservasi WHERE id = ?', [req.params.id]);
    res.redirect(`/mahasiswa/${req.params.mhsId}`);
});

// --- PSIKOLOG ---
router.get('/psikolog/:id', auth('psikolog'), async (req, res) => {
    // Menampilkan semua reservasi yang ditujukan ke psikolog ini
    const [daftar] = await db.query('SELECT * FROM reservasi WHERE psikolog_id = ?', [req.params.id]);
    res.render('psikolog_dashboard', { daftar, psiId: req.params.id });
});

router.post('/psikolog/update-status', auth('psikolog'), async (req, res) => {
    const { resId, status, psiId } = req.body;
    if (status === 'ditolak') {
        await db.query('DELETE FROM reservasi WHERE id = ?', [resId]);
    } else {
        await db.query('UPDATE reservasi SET status = ? WHERE id = ?', [status, resId]);
    }
    res.redirect(`/psikolog/${psiId}`);
});

// --- ADMIN ---
router.get('/admin/:id', auth('admin'), async (req, res) => {
    const [psikolog] = await db.query('SELECT * FROM psikolog_status');
    const [totalRes] = await db.query('SELECT COUNT(*) as total FROM reservasi');
    res.render('admin_dashboard', { psikolog, total: totalRes[0].total, adminId: req.params.id });
});

router.post('/admin/psikolog/add', auth('admin'), async (req, res) => {
    const { nama, jadwal } = req.body;
    await db.query('INSERT INTO psikolog_status (nama_psikolog, jadwal_tugas, is_active) VALUES (?, ?, 1)', [nama, jadwal]);
    res.redirect('/admin/' + req.session.user.id);
});

module.exports = router;