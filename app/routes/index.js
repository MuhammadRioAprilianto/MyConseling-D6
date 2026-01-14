const express = require('express');
const router = express.Router();
const db = require('../config/database');

// Middleware Auth
const auth = (role) => {
    return (req, res, next) => {
        if (req.session.user && req.session.user.role === role) {
            next();
        } else {
            res.send("<script>alert('Sesi Berakhir, Silakan Login!'); window.location='/';</script>");
        }
    };
};

// Helper Validasi Hari
const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
function isDayInRange(dateString, scheduleString) {
    const selectedDate = new Date(dateString);
    const selectedDayName = days[selectedDate.getDay()];
    if (!scheduleString.includes(' - ')) return true;
    const [startDay, endDay] = scheduleString.split(',')[0].split(' - ').map(d => d.trim());
    const startIndex = days.indexOf(startDay);
    const endIndex = days.indexOf(endDay);
    const currentIndex = days.indexOf(selectedDayName);
    return startIndex <= endIndex ? (currentIndex >= startIndex && currentIndex <= endIndex) : (currentIndex >= startIndex || currentIndex <= endIndex);
}

// --- ROUTES ---
router.get('/', (req, res) => res.render('login'));

router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const [users] = await db.query('SELECT * FROM users WHERE username = ? AND password = ?', [username, password]);
        if (users.length > 0) {
            req.session.user = users[0];
            req.session.save(() => {
                const u = users[0];
                if (u.role === 'admin') return res.redirect('/admin/' + u.id);
                if (u.role === 'psikolog') return res.redirect('/psikolog/' + u.id);
                if (u.role === 'mahasiswa') return res.redirect('/mahasiswa/' + u.id);
            });
        } else { res.send("<script>alert('Gagal Login!'); window.location='/';</script>"); }
    } catch (err) { res.status(500).send("DB Error"); }
});

router.get('/mahasiswa/:id', auth('mahasiswa'), async (req, res) => {
    try {
        const [psikolog] = await db.query('SELECT * FROM psikolog_status WHERE is_active = 1');
        const [reservasi] = await db.query('SELECT * FROM reservasi WHERE mahasiswa_id = ?', [req.params.id]);
        res.render('mahasiswa_dashboard', { psikolog, reservasi, mhsId: req.params.id });
    } catch (err) { res.status(500).send("Error Load Dashboard"); }
});

// LOGIKA UPDATE FIXED
router.post('/reservasi/update', auth('mahasiswa'), async (req, res) => {
    const { resId, mhsId, psikologId, tanggal, waktu } = req.body;
    try {
        // 1. Validasi Input
        if (!resId || !psikologId || !tanggal || !waktu) {
            return res.send("<script>alert('Data tidak lengkap!'); window.history.back();</script>");
        }

        // 2. Cek Hari Kerja
        const [psi] = await db.query('SELECT jadwal_tugas FROM psikolog_status WHERE id = ?', [psikologId]);
        if (!isDayInRange(tanggal, psi[0].jadwal_tugas)) {
            return res.send("<script>alert('Psikolog tidak bertugas di hari tersebut!'); window.history.back();</script>");
        }

        // 3. Cek Bentrok
        const [cek] = await db.query(
            'SELECT * FROM reservasi WHERE tanggal=? AND waktu=? AND psikolog_id=? AND id != ? AND status != "ditolak"', 
            [tanggal, waktu, psikologId, resId]
        );
        if (cek.length > 0) {
            return res.send("<script>alert('Jadwal sudah penuh/bentrok!'); window.history.back();</script>");
        }

        // 4. Eksekusi Update
        await db.query(
            'UPDATE reservasi SET psikolog_id=?, tanggal=?, waktu=?, status="menunggu", pesan_tolak=NULL WHERE id=?', 
            [psikologId, tanggal, waktu, resId]
        );
        
        res.send(`<script>alert('Update Berhasil!'); window.location='/mahasiswa/${mhsId}';</script>`);
    } catch (err) {
        console.error("DEBUG UPDATE ERROR:", err); // Cek error di terminal Pi
        res.status(500).send("Terjadi kesalahan sistem saat update.");
    }
});

router.get('/logout', (req, res) => { req.session.destroy(); res.redirect('/'); });

module.exports = router;