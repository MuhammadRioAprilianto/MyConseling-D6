// TODO: Definisikan semua jalur (Route) aplikasi kalian disini (GET, POST, PUT, DELETE)
const express = require('express');
const router = express.Router();
const db = require('../config/database');

// Middleware Proteksi Halaman
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
        } else { res.send("<script>alert('Gagal!'); window.location='/';</script>"); }
    } catch (err) { res.status(500).send("Error"); }
});
router.get('/logout', (req, res) => { req.session.destroy(); res.redirect('/'); });

// --- MAHASISWA & PSIKOLOG (Logic Tetap) ---
router.get('/mahasiswa/:id', auth('mahasiswa'), async (req, res) => {
    const [psikolog] = await db.query('SELECT * FROM psikolog_status WHERE is_active = 1');
    const [reservasi] = await db.query('SELECT * FROM reservasi WHERE mahasiswa_id = ?', [req.params.id]);
    const [booked] = await db.query('SELECT tanggal, waktu, psikolog_id FROM reservasi WHERE status != "ditolak"');
    res.render('mahasiswa_dashboard', { psikolog, reservasi, mhsId: req.params.id, booked });
});
router.get('/psikolog/:id', auth('psikolog'), async (req, res) => {
    const [daftar] = await db.query('SELECT * FROM reservasi WHERE psikolog_id = ?', [req.params.id]);
    res.render('psikolog_dashboard', { daftar, psiId: req.params.id });
});

// --- ADMIN ROUTES (CRUD DENGAN HARI TERPISAH) ---
router.get('/admin/:id', auth('admin'), async (req, res) => {
    const [dataPsikolog] = await db.query(`SELECT ps.*, u.username, u.password FROM psikolog_status ps JOIN users u ON ps.id = u.id`);
    const [dataMahasiswa] = await db.query("SELECT * FROM users WHERE role = 'mahasiswa'");
    const [totalRes] = await db.query('SELECT COUNT(*) as total FROM reservasi');
    res.render('admin_dashboard', { psikolog: dataPsikolog, mahasiswa: dataMahasiswa, total: totalRes[0].total, adminId: req.params.id });
});

// CREATE PSIKOLOG (Hari Dipisah)
router.post('/admin/psikolog/add', auth('admin'), async (req, res) => {
    const { nama, hari_mulai, hari_sampai, jam_mulai, jam_selesai, username, password } = req.body;
    const jadwal = `${hari_mulai} - ${hari_sampai}, ${jam_mulai} - ${jam_selesai}`;
    try {
        const [result] = await db.query('INSERT INTO users (username, password, role) VALUES (?, ?, "psikolog")', [username, password]);
        await db.query('INSERT INTO psikolog_status (id, nama_psikolog, jadwal_tugas, is_active) VALUES (?, ?, ?, 1)', [result.insertId, nama, jadwal]);
        res.redirect('/admin/' + req.params.id);
    } catch (err) { res.send("<script>alert('Gagal!'); window.history.back();</script>"); }
});

router.post('/admin/mahasiswa/add', auth('admin'), async (req, res) => {
    const { username, password } = req.body;
    try {
        await db.query('INSERT INTO users (username, password, role) VALUES (?, ?, "mahasiswa")', [username, password]);
        res.redirect('/admin/' + req.params.id);
    } catch (err) { res.send("<script>alert('Gagal!'); window.history.back();</script>"); }
});

// UPDATE
router.post('/admin/user/update', auth('admin'), async (req, res) => {
    const { userId, username, password, nama, jadwal, role, adminId } = req.body;
    try {
        await db.query('UPDATE users SET username=?, password=? WHERE id=?', [username, password, userId]);
        if (role === 'psikolog') {
            await db.query('UPDATE psikolog_status SET nama_psikolog=?, jadwal_tugas=? WHERE id=?', [nama, jadwal, userId]);
        }
        res.redirect('/admin/' + adminId);
    } catch (err) { res.send("<script>alert('Update Gagal!'); window.history.back();</script>"); }
});

// DELETE
router.get('/admin/user/delete/:userId/:adminId', auth('admin'), async (req, res) => {
    try {
        const { userId, adminId } = req.params;
        await db.query('DELETE FROM users WHERE id = ?', [userId]); 
        await db.query('DELETE FROM psikolog_status WHERE id = ?', [userId]);
        res.redirect('/admin/' + adminId);
    } catch (err) { res.send("<script>alert('Gagal Hapus!'); window.history.back();</script>"); }
});

module.exports = router;