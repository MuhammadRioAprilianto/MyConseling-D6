const express = require('express');
const router = express.Router();
const db = require('../config/database');

const auth = (role) => {
    return (req, res, next) => {
        if (req.session.user && req.session.user.role === role) {
            next();
        } else {
            res.send("<script>alert('Akses Ditolak!'); window.location='/';</script>");
        }
    };
};

// --- AUTH & LOGIN ---
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

// --- MAHASISWA (FIX: booked variable) ---
router.get('/mahasiswa/:id', auth('mahasiswa'), async (req, res) => {
    try {
        const [psikolog] = await db.query('SELECT * FROM psikolog_status WHERE is_active = 1');
        const [reservasi] = await db.query('SELECT * FROM reservasi WHERE mahasiswa_id = ?', [req.params.id]);
        // MENYEDIAKAN VARIABEL booked AGAR TIDAK ERROR
        const [booked] = await db.query('SELECT tanggal, waktu, psikolog_id FROM reservasi WHERE status != "ditolak"');
        res.render('mahasiswa_dashboard', { psikolog, reservasi, mhsId: req.params.id, booked });
    } catch (err) { res.status(500).send("Error Load Dashboard"); }
});

// --- UPDATE RESERVASI (FIX: Error Update Gagal) ---
router.post('/reservasi/update', auth('mahasiswa'), async (req, res) => {
    const { resId, mhsId, psikologId, tanggal, waktu } = req.body;
    try {
        await db.query(
            'UPDATE reservasi SET psikolog_id=?, tanggal=?, waktu=?, status="menunggu" WHERE id=?', 
            [psikologId, tanggal, waktu, resId]
        );
        res.redirect(`/mahasiswa/${mhsId}`);
    } catch (err) { res.status(500).send("Terjadi kesalahan sistem saat update."); }
});

// --- PSIKOLOG (FIX: Cannot GET/POST routes) ---
router.get('/psikolog/:id', auth('psikolog'), async (req, res) => {
    const [daftar] = await db.query('SELECT * FROM reservasi WHERE psikolog_id = ?', [req.params.id]);
    res.render('psikolog_dashboard', { daftar, psiId: req.params.id });
});

router.post('/psikolog/update-status', auth('psikolog'), async (req, res) => {
    const { resId, status, psiId } = req.body;
    try {
        await db.query('UPDATE reservasi SET status = ? WHERE id = ?', [status, resId]);
        res.redirect(`/psikolog/${psiId}`);
    } catch (err) { res.status(500).send("Gagal Update Status"); }
});

router.get('/logout', (req, res) => { req.session.destroy(); res.redirect('/'); });

module.exports = router;