const express = require('express');
const router = express.Router();
const db = require('../config/database');

// Middleware Proteksi Halaman
const auth = (role) => {
    return (req, res, next) => {
        if (req.session.user && req.session.user.role === role) {
            next();
        } else {
            res.send("<script>alert('Akses Ditolak! Silakan Login Kembali.'); window.location='/';</script>");
        }
    };
};

// --- AUTH ROUTES ---
router.get('/', (req, res) => res.render('login'));
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const [users] = await db.query('SELECT * FROM users WHERE username = ? AND password = ?', [username, password]);
        if (users.length > 0) {
            req.session.user = users[0];
            const u = users[0];
            req.session.save(() => {
                if (u.role === 'admin') return res.redirect('/admin/' + u.id);
                if (u.role === 'psikolog') return res.redirect('/psikolog/' + u.id);
                if (u.role === 'mahasiswa') return res.redirect('/mahasiswa/' + u.id);
            });
        } else { res.send("<script>alert('Login Gagal!'); window.location='/';</script>"); }
    } catch (err) { res.status(500).send("Error Login"); }
});

// --- ADMIN DASHBOARD (SOLUSI: Cannot GET /admin/:id) ---
router.get('/admin/:id', auth('admin'), async (req, res) => {
    try {
        // Ambil data psikolog gabungan dari tabel users dan psikolog_status
        const [dataPsikolog] = await db.query(`
            SELECT ps.*, u.username, u.password 
            FROM psikolog_status ps 
            JOIN users u ON ps.id = u.id
        `);
        // Ambil data mahasiswa
        const [dataMahasiswa] = await db.query("SELECT * FROM users WHERE role = 'mahasiswa'");
        // Hitung total reservasi untuk statistik
        const [totalRes] = await db.query('SELECT COUNT(*) as total FROM reservasi');

        res.render('admin_dashboard', { 
            psikolog: dataPsikolog, 
            mahasiswa: dataMahasiswa, 
            total: totalRes[0].total, 
            adminId: req.params.id 
        });
    } catch (err) {
        console.error(err);
        res.status(500).send("Error Load Admin Dashboard");
    }
});

// --- ADMIN: TAMBAH PSIKOLOG ---
router.post('/admin/psikolog/add', auth('admin'), async (req, res) => {
    const { nama, hari_mulai, hari_sampai, jam_mulai, jam_selesai, username, password, adminId } = req.body;
    const jadwal = `${hari_mulai} - ${hari_sampai}, ${jam_mulai} - ${jam_selesai}`;
    try {
        // 1. Simpan ke tabel users
        const [result] = await db.query('INSERT INTO users (username, password, role) VALUES (?, ?, "psikolog")', [username, password]);
        // 2. Simpan ke tabel psikolog_status menggunakan ID yang baru dibuat
        await db.query('INSERT INTO psikolog_status (id, nama_psikolog, jadwal_tugas, is_active) VALUES (?, ?, ?, 1)', [result.insertId, nama, jadwal]);
        
        res.redirect('/admin/' + adminId);
    } catch (err) { res.send("<script>alert('Gagal Tambah Psikolog!'); window.history.back();</script>"); }
});

// --- ADMIN: TAMBAH MAHASISWA ---
router.post('/admin/mahasiswa/add', auth('admin'), async (req, res) => {
    const { username, password, adminId } = req.body;
    try {
        await db.query('INSERT INTO users (username, password, role) VALUES (?, ?, "mahasiswa")', [username, password]);
        res.redirect('/admin/' + adminId);
    } catch (err) { res.send("<script>alert('Gagal Tambah Mahasiswa!'); window.history.back();</script>"); }
});

// --- ADMIN: UPDATE USER ---
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

// --- ADMIN: DELETE USER ---
router.get('/admin/user/delete/:userId/:adminId', auth('admin'), async (req, res) => {
    try {
        const { userId, adminId } = req.params;
        // Karena kita pakai ON DELETE CASCADE di database, hapus di tabel users otomatis menghapus di psikolog_status
        await db.query('DELETE FROM users WHERE id = ?', [userId]); 
        res.redirect('/admin/' + adminId);
    } catch (err) { res.send("<script>alert('Gagal Hapus!'); window.history.back();</script>"); }
});

router.get('/logout', (req, res) => { req.session.destroy(); res.redirect('/'); });

module.exports = router;