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

// Helper Validasi Hari
const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
function isDayInRange(dateString, scheduleString) {
    const selectedDate = new Date(dateString);
    const selectedDayName = days[selectedDate.getDay()];
    const dayPart = scheduleString.split(',')[0];
    if (!dayPart.includes(' - ')) return true;
    const [startDay, endDay] = dayPart.split(' - ').map(d => d.trim());
    const startIndex = days.indexOf(startDay);
    const endIndex = days.indexOf(endDay);
    const currentIndex = days.indexOf(selectedDayName);
    return startIndex <= endIndex ? (currentIndex >= startIndex && currentIndex <= endIndex) : (currentIndex >= startIndex || currentIndex <= endIndex);
}

// --- AUTH ---
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
        } else { res.send("<script>alert('Gagal!'); window.location='/';</script>"); }
    } catch (err) { res.status(500).send("Error"); }
});
router.get('/logout', (req, res) => { req.session.destroy(); res.redirect('/'); });

// --- MAHASISWA (CRUD) ---
router.get('/mahasiswa/:id', auth('mahasiswa'), async (req, res) => {
    const [psikolog] = await db.query('SELECT * FROM psikolog_status WHERE is_active = 1');
    const [reservasi] = await db.query('SELECT * FROM reservasi WHERE mahasiswa_id = ?', [req.params.id]);
    const [booked] = await db.query('SELECT tanggal, waktu, psikolog_id FROM reservasi WHERE status != "ditolak"');
    res.render('mahasiswa_dashboard', { psikolog, reservasi, mhsId: req.params.id, booked });
});

router.post('/reservasi/add', auth('mahasiswa'), async (req, res) => {
    const { mhsId, nim, nama, tanggal, waktu, psikologId } = req.body;
    const [psi] = await db.query('SELECT jadwal_tugas FROM psikolog_status WHERE id = ?', [psikologId]);
    if (!isDayInRange(tanggal, psi[0].jadwal_tugas)) return res.send("<script>alert('Bukan hari tugas!'); window.history.back();</script>");
    const [cek] = await db.query('SELECT * FROM reservasi WHERE tanggal=? AND waktu=? AND psikolog_id=? AND status!="ditolak"', [tanggal, waktu, psikologId]);
    if (cek.length > 0) return res.send("<script>alert('Jadwal bentrok!'); window.history.back();</script>");
    await db.query('INSERT INTO reservasi (mahasiswa_id, nama_mhs, nim, tanggal, waktu, psikolog_id) VALUES (?,?,?,?,?,?)', [mhsId, nama, nim, tanggal, waktu, psikologId]);
    res.redirect(`/mahasiswa/${mhsId}`);
});

// --- PERBAIKAN EDIT DATA MAHASISWA ---
router.post('/reservasi/update', auth('mahasiswa'), async (req, res) => {
    const { resId, mhsId, tanggal, waktu, psikologId } = req.body;
    try {
        // 1. Cek jadwal tugas psikolog yang baru dipilih
        const [psi] = await db.query('SELECT jadwal_tugas FROM psikolog_status WHERE id = ?', [psikologId]);
        if (!isDayInRange(tanggal, psi[0].jadwal_tugas)) {
            return res.send("<script>alert('Update Gagal! Hari tidak sesuai jadwal tugas psikolog.'); window.history.back();</script>");
        }

        // 2. Cek apakah jam baru bentrok dengan reservasi orang lain
        const [cek] = await db.query(
            'SELECT * FROM reservasi WHERE tanggal=? AND waktu=? AND psikolog_id=? AND id != ? AND status != "ditolak"', 
            [tanggal, waktu, psikologId, resId]
        );
        
        if (cek.length > 0) {
            return res.send("<script>alert('Jadwal baru bentrok dengan mahasiswa lain!'); window.history.back();</script>");
        }

        // 3. Update data dan reset status menjadi 'menunggu'
        await db.query(
            'UPDATE reservasi SET tanggal=?, waktu=?, psikolog_id=?, status="menunggu" WHERE id=? AND mahasiswa_id=?', 
            [tanggal, waktu, psikologId, resId, mhsId]
        );
        
        res.send(`<script>alert('Berhasil! Jadwal telah diperbarui.'); window.location='/mahasiswa/${mhsId}';</script>`);
    } catch (err) {
        console.error(err);
        res.status(500).send("Terjadi kesalahan sistem saat update.");
    }
});

router.get('/reservasi/delete/:id/:mhsId', auth('mahasiswa'), async (req, res) => {
    await db.query('DELETE FROM reservasi WHERE id = ?', [req.params.id]);
    res.redirect(`/mahasiswa/${req.params.mhsId}`);
});

// --- PSIKOLOG (KONFIRMASI/TOLAK) ---
router.get('/psikolog/:id', auth('psikolog'), async (req, res) => {
    const [daftar] = await db.query('SELECT * FROM reservasi WHERE psikolog_id = ?', [req.params.id]);
    res.render('psikolog_dashboard', { daftar, psiId: req.params.id });
});

router.post('/psikolog/update-status', auth('psikolog'), async (req, res) => {
    const { resId, status, psiId } = req.body;
    await db.query('UPDATE reservasi SET status = ? WHERE id = ?', [status, resId]);
    res.redirect(`/psikolog/${psiId}`);
});

// --- ADMIN (CRUD USER) ---
router.get('/admin/:id', auth('admin'), async (req, res) => {
    const [dataPsikolog] = await db.query(`SELECT ps.*, u.username, u.password FROM psikolog_status ps JOIN users u ON ps.id = u.id`);
    const [dataMahasiswa] = await db.query("SELECT * FROM users WHERE role = 'mahasiswa'");
    const [totalRes] = await db.query('SELECT COUNT(*) as total FROM reservasi');
    res.render('admin_dashboard', { psikolog: dataPsikolog, mahasiswa: dataMahasiswa, total: totalRes[0].total, adminId: req.params.id });
});

router.post('/admin/psikolog/add', auth('admin'), async (req, res) => {
    const { nama, hari_mulai, hari_sampai, jam_mulai, jam_selesai, username, password, adminId } = req.body;
    const jadwal = `${hari_mulai} - ${hari_sampai}, ${jam_mulai} - ${jam_selesai}`;
    const [result] = await db.query('INSERT INTO users (username, password, role) VALUES (?, ?, "psikolog")', [username, password]);
    await db.query('INSERT INTO psikolog_status (id, nama_psikolog, jadwal_tugas, is_active) VALUES (?, ?, ?, 1)', [result.insertId, nama, jadwal]);
    res.redirect('/admin/' + adminId);
});

router.post('/admin/mahasiswa/add', auth('admin'), async (req, res) => {
    const { username, password, adminId } = req.body;
    await db.query('INSERT INTO users (username, password, role) VALUES (?, ?, "mahasiswa")', [username, password]);
    res.redirect('/admin/' + adminId);
});

router.post('/admin/user/update', auth('admin'), async (req, res) => {
    const { userId, username, password, nama, jadwal, role, adminId } = req.body;
    await db.query('UPDATE users SET username=?, password=? WHERE id=?', [username, password, userId]);
    if (role === 'psikolog') await db.query('UPDATE psikolog_status SET nama_psikolog=?, jadwal_tugas=? WHERE id=?', [nama, jadwal, userId]);
    res.redirect('/admin/' + adminId);
});

router.get('/admin/user/delete/:userId/:adminId', auth('admin'), async (req, res) => {
    await db.query('DELETE FROM users WHERE id = ?', [req.params.userId]);
    res.redirect('/admin/' + req.params.adminId);
});

module.exports = router;