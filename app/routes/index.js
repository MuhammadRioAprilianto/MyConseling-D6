const express = require('express');
const router = express.Router();
const db = require('../config/database');

// Middleware Proteksi: Solusi untuk "Akses Ditolak!"
const auth = (role) => {
    return (req, res, next) => {
        if (req.session.user && req.session.user.role === role) {
            next();
        } else {
            res.send("<script>alert('Akses Ditolak! Sesi Anda mungkin berakhir.'); window.location='/';</script>");
        }
    };
};

// Helper Validasi Jadwal
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

// --- LOGIN & LOGOUT ---
router.get('/', (req, res) => res.render('login'));
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const [users] = await db.query('SELECT * FROM users WHERE username = ? AND password = ?', [username, password]);
        if (users.length > 0) {
            req.session.user = users[0];
            const u = users[0];
            // Simpan sesi sebelum redirect untuk kestabilan
            req.session.save(() => {
                if (u.role === 'admin') return res.redirect('/admin/' + u.id);
                if (u.role === 'psikolog') return res.redirect('/psikolog/' + u.id);
                if (u.role === 'mahasiswa') return res.redirect('/mahasiswa/' + u.id);
            });
        } else { res.send("<script>alert('Gagal Login!'); window.location='/';</script>"); }
    } catch (err) { res.status(500).send("Error System"); }
});
router.get('/logout', (req, res) => { req.session.destroy(); res.redirect('/'); });

// --- DASHBOARD MAHASISWA & UPDATE ---
router.get('/mahasiswa/:id', auth('mahasiswa'), async (req, res) => {
    const [psikolog] = await db.query('SELECT * FROM psikolog_status WHERE is_active = 1');
    const [reservasi] = await db.query('SELECT * FROM reservasi WHERE mahasiswa_id = ?', [req.params.id]);
    res.render('mahasiswa_dashboard', { psikolog, reservasi, mhsId: req.params.id });
});

// FIX: Solusi untuk screenshot "Update Gagal"
router.post('/reservasi/update', auth('mahasiswa'), async (req, res) => {
    try {
        const { resId, mhsId, tanggal, waktu, psikologId } = req.body;
        const [psi] = await db.query('SELECT jadwal_tugas FROM psikolog_status WHERE id = ?', [psikologId]);
        
        if (!isDayInRange(tanggal, psi[0].jadwal_tugas)) {
            return res.send(`<script>alert('Hari tidak sesuai jadwal tugas psikolog!'); window.history.back();</script>`);
        }

        const [cek] = await db.query('SELECT * FROM reservasi WHERE tanggal=? AND waktu=? AND psikolog_id=? AND id!=? AND status!="ditolak"', [tanggal, waktu, psikologId, resId]);
        if (cek.length > 0) return res.send("<script>alert('Jadwal bentrok!'); window.history.back();</script>");

        await db.query('UPDATE reservasi SET tanggal=?, waktu=?, psikolog_id=?, status="menunggu" WHERE id=?', [tanggal, waktu, psikologId, resId]);
        res.redirect(`/mahasiswa/${mhsId}`);
    } catch (err) { 
        console.error(err);
        res.status(500).send("Terjadi kesalahan sistem saat update."); 
    }
});

// --- DASHBOARD PSIKOLOG ---
// FIX: Solusi untuk "Cannot GET /psikolog/5"
router.get('/psikolog/:id', auth('psikolog'), async (req, res) => {
    const [daftar] = await db.query('SELECT * FROM reservasi WHERE psikolog_id = ?', [req.params.id]);
    res.render('psikolog_dashboard', { daftar, psiId: req.params.id });
});

// FIX: Solusi untuk "Cannot POST /psikolog/update-status"
router.post('/psikolog/update-status', auth('psikolog'), async (req, res) => {
    try {
        const { resId, status, psiId } = req.body;
        await db.query('UPDATE reservasi SET status = ? WHERE id = ?', [status, resId]);
        res.redirect(`/psikolog/${psiId}`);
    } catch (err) { res.status(500).send("Gagal Update Status"); }
});

// --- ADMIN ROUTES ---
router.get('/admin/:id', auth('admin'), async (req, res) => {
    const [psikolog] = await db.query(`SELECT ps.*, u.username, u.password FROM psikolog_status ps JOIN users u ON ps.id = u.id`);
    const [mahasiswa] = await db.query("SELECT * FROM users WHERE role = 'mahasiswa'");
    const [totalRes] = await db.query('SELECT COUNT(*) as total FROM reservasi');
    res.render('admin_dashboard', { psikolog, mahasiswa, total: totalRes[0].total, adminId: req.params.id });
});

module.exports = router;