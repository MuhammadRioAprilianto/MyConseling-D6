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

// Helper: Validasi Hari Kerja Psikolog
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
    if (startIndex <= endIndex) return currentIndex >= startIndex && currentIndex <= endIndex;
    return currentIndex >= startIndex || currentIndex <= endIndex;
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
        } else { res.send("<script>alert('Gagal Login!'); window.location='/';</script>"); }
    } catch (err) { res.status(500).send("Database Error"); }
});

router.get('/logout', (req, res) => { req.session.destroy(); res.redirect('/'); });

// --- DASHBOARD MAHASISWA ---
router.get('/mahasiswa/:id', auth('mahasiswa'), async (req, res) => {
    const [psikolog] = await db.query('SELECT * FROM psikolog_status WHERE is_active = 1');
    const [reservasi] = await db.query('SELECT * FROM reservasi WHERE mahasiswa_id = ?', [req.params.id]);
    res.render('mahasiswa_dashboard', { psikolog, reservasi, mhsId: req.params.id });
});

// TAMBAH RESERVASI
router.post('/reservasi/add', auth('mahasiswa'), async (req, res) => {
    const { mhsId, nim, nama, tanggal, waktu, psikologId } = req.body;
    try {
        const [psi] = await db.query('SELECT jadwal_tugas FROM psikolog_status WHERE id = ?', [psikologId]);
        if (!isDayInRange(tanggal, psi[0].jadwal_tugas)) return res.send("<script>alert('Bukan hari tugas psikolog!'); window.history.back();</script>");
        
        const [cek] = await db.query('SELECT * FROM reservasi WHERE tanggal=? AND waktu=? AND psikolog_id=? AND status!="ditolak"', [tanggal, waktu, psikologId]);
        if (cek.length > 0) return res.send("<script>alert('Jadwal bentrok!'); window.history.back();</script>");
        
        await db.query('INSERT INTO reservasi (mahasiswa_id, nama_mhs, nim, tanggal, waktu, psikolog_id) VALUES (?,?,?,?,?,?)', [mhsId, nama, nim, tanggal, waktu, psikologId]);
        res.redirect(`/mahasiswa/${mhsId}`);
    } catch (err) { res.status(500).send("Gagal menambah data"); }
});

// UPDATE RESERVASI (FIXED)
router.post('/reservasi/update', auth('mahasiswa'), async (req, res) => {
    const { resId, mhsId, psikologId, tanggal, waktu } = req.body;
    try {
        const [psi] = await db.query('SELECT jadwal_tugas FROM psikolog_status WHERE id = ?', [psikologId]);
        if (!isDayInRange(tanggal, psi[0].jadwal_tugas)) return res.send("<script>alert('Hari tidak sesuai jadwal psikolog!'); window.history.back();</script>");

        const [cek] = await db.query('SELECT * FROM reservasi WHERE tanggal=? AND waktu=? AND psikolog_id=? AND id != ? AND status != "ditolak"', [tanggal, waktu, psikologId, resId]);
        if (cek.length > 0) return res.send("<script>alert('Jadwal bentrok!'); window.history.back();</script>");

        // Update data & reset status ke 'menunggu'
        await db.query(
            'UPDATE reservasi SET psikolog_id=?, tanggal=?, waktu=?, status="menunggu", pesan_tolak=NULL WHERE id=?', 
            [psikologId, tanggal, waktu, resId]
        );
        res.send(`<script>alert('Data berhasil diperbarui!'); window.location='/mahasiswa/${mhsId}';</script>`);
    } catch (err) { res.status(500).send("Update Gagal"); }
});

router.get('/reservasi/delete/:id/:mhsId', auth('mahasiswa'), async (req, res) => {
    await db.query('DELETE FROM reservasi WHERE id = ?', [req.params.id]);
    res.redirect(`/mahasiswa/${req.params.mhsId}`);
});

module.exports = router;