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

// --- AUTH & DASHBOARD ---
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
    } catch (err) { res.status(500).send("Error Login"); }
});

router.get('/mahasiswa/:id', auth('mahasiswa'), async (req, res) => {
    const [psikolog] = await db.query('SELECT * FROM psikolog_status WHERE is_active = 1');
    const [reservasi] = await db.query('SELECT * FROM reservasi WHERE mahasiswa_id = ?', [req.params.id]);
    res.render('mahasiswa_dashboard', { psikolog, reservasi, mhsId: req.params.id });
});

// --- FIX: UPDATE RESERVASI (MAHASISWA) ---
router.post('/reservasi/update', auth('mahasiswa'), async (req, res) => {
    try {
        const { resId, mhsId, tanggal, waktu, psikologId } = req.body;
        const [psi] = await db.query('SELECT jadwal_tugas FROM psikolog_status WHERE id = ?', [psikologId]);
        
        if (!isDayInRange(tanggal, psi[0].jadwal_tugas)) {
            return res.send(`<script>alert('Gagal! Hari tidak sesuai jadwal.'); window.history.back();</script>`);
        }

        const [cek] = await db.query('SELECT * FROM reservasi WHERE tanggal=? AND waktu=? AND psikolog_id=? AND id!=? AND status!="ditolak"', [tanggal, waktu, psikologId, resId]);
        if (cek.length > 0) return res.send("<script>alert('Jadwal bentrok!'); window.history.back();</script>");

        await db.query('UPDATE reservasi SET tanggal=?, waktu=?, psikolog_id=?, status="menunggu" WHERE id=?', [tanggal, waktu, psikologId, resId]);
        res.redirect(`/mahasiswa/${mhsId}`);
    } catch (err) { res.status(500).send("Update Gagal di Database"); }
});

// --- FIX: UPDATE STATUS (PSIKOLOG) ---
// Rute ini yang tadinya "Cannot POST" di screenshot kamu
router.post('/psikolog/update-status', auth('psikolog'), async (req, res) => {
    try {
        const { resId, status, psiId } = req.body;
        await db.query('UPDATE reservasi SET status = ? WHERE id = ?', [status, resId]);
        res.redirect(`/psikolog/${psiId}`);
    } catch (err) { res.status(500).send("Gagal Update Status"); }
});

router.get('/logout', (req, res) => { req.session.destroy(); res.redirect('/'); });

// Rute Admin (Tetap seperti sebelumnya)
module.exports = router;