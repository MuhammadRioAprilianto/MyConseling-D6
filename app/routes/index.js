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

// --- AUTH ROUTES ---
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
            res.send("<script>alert('Gagal Login!'); window.location='/';</script>");
        }
    } catch (err) { res.status(500).send("Error"); }
});

router.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

// --- MAHASISWA & PSIKOLOG DASHBOARD (LOGIKA SAMA SEPERTI SEBELUMNYA) ---
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

// --- FITUR RESERVASI ---
router.post('/reservasi/add', auth('mahasiswa'), async (req, res) => {
    try {
        const { mhsId, nim, nama, tanggal, waktu, psikologId } = req.body;
        const [cek] = await db.query('SELECT * FROM reservasi WHERE tanggal=? AND waktu=? AND psikolog_id=? AND status!="ditolak"', [tanggal, waktu, psikologId]);
        if (cek.length > 0) return res.send("<script>alert('Jadwal bentrok!'); window.history.back();</script>");
        await db.query('INSERT INTO reservasi (mahasiswa_id, nama_mhs, nim, tanggal, waktu, psikolog_id) VALUES (?,?,?,?,?,?)', [mhsId, nama, nim, tanggal, waktu, psikologId]);
        res.redirect(`/mahasiswa/${mhsId}`);
    } catch (err) { res.status(500).send("Error"); }
});

router.post('/psikolog/update-status', auth('psikolog'), async (req, res) => {
    const { resId, status, psiId } = req.body;
    if (status === 'ditolak') await db.query('DELETE FROM reservasi WHERE id = ?', [resId]);
    else await db.query('UPDATE reservasi SET status = ? WHERE id = ?', [status, resId]);
    res.redirect(`/psikolog/${psiId}`);
});

// --- ADMIN ROUTES (TABEL TERPISAH) ---
router.get('/admin/:id', auth('admin'), async (req, res) => {
    try {
        // Ambil data Psikolog (Join dengan users untuk ambil username)
        const [dataPsikolog] = await db.query(`
            SELECT ps.nama_psikolog, ps.jadwal_tugas, u.username, u.id 
            FROM psikolog_status ps 
            JOIN users u ON ps.id = u.id 
            WHERE u.role = 'psikolog'
        `);

        // Ambil data Mahasiswa dari tabel users
        const [dataMahasiswa] = await db.query("SELECT id, username FROM users WHERE role = 'mahasiswa'");

        const [totalRes] = await db.query('SELECT COUNT(*) as total FROM reservasi');

        res.render('admin_dashboard', { 
            psikolog: dataPsikolog, 
            mahasiswa: dataMahasiswa, 
            total: totalRes[0].total, 
            adminId: req.params.id 
        });
    } catch (err) { 
        console.error(err);
        res.status(500).send("Admin Error"); 
    }
});

// Aksi Tambah Psikolog
router.post('/admin/psikolog/add', auth('admin'), async (req, res) => {
    const { nama, hari, jam_mulai, jam_selesai, username, password } = req.body;
    const jadwal = `${hari}, ${jam_mulai} - ${jam_selesai}`;
    try {
        const [result] = await db.query('INSERT INTO users (username, password, role) VALUES (?, ?, "psikolog")', [username, password]);
        await db.query('INSERT INTO psikolog_status (id, nama_psikolog, jadwal_tugas, is_active) VALUES (?, ?, ?, 1)', [result.insertId, nama, jadwal]);
        res.redirect('/admin/' + req.params.id);
    } catch (err) { res.send("<script>alert('Gagal! Username mungkin sudah ada.'); window.history.back();</script>"); }
});

// Aksi Tambah Mahasiswa
router.post('/admin/mahasiswa/add', auth('admin'), async (req, res) => {
    const { username, password } = req.body;
    try {
        await db.query('INSERT INTO users (username, password, role) VALUES (?, ?, "mahasiswa")', [username, password]);
        res.redirect('/admin/' + req.params.id);
    } catch (err) { res.send("<script>alert('Gagal menambah mahasiswa.'); window.history.back();</script>"); }
});

module.exports = router;