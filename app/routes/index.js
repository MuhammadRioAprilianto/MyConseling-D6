// TODO: Definisikan semua jalur (Route) aplikasi kalian disini (GET, POST, PUT, DELETE)
const express = require('express');
const router = express.Router();
const db = require('../config/database');

router.get('/', (req, res) => res.render('index'));

// ADMIN ROUTES
router.get('/admin/:id', async (req, res) => {
    const [psikolog] = await db.query('SELECT * FROM psikolog_status');
    const [stats] = await db.query('SELECT status, COUNT(*) as jml FROM reservasi GROUP BY status');
    res.render('admin_dashboard', { psikolog, stats, adminId: req.params.id });
});

router.post('/admin/psikolog/add', async (req, res) => {
    const { nama, jadwal } = req.body;
    await db.query('INSERT INTO psikolog_status (nama_psikolog, jadwal_tugas, is_active) VALUES (?, ?, 1)', [nama, jadwal]);
    res.redirect('/admin/1');
});

// MAHASISWA ROUTES
router.get('/mahasiswa/:id', async (req, res) => {
    const [psikolog] = await db.query('SELECT * FROM psikolog_status WHERE is_active = 1');
    const [reservasi] = await db.query('SELECT * FROM reservasi WHERE mahasiswa_id = ?', [req.params.id]);
    res.render('mahasiswa_dashboard', { psikolog, reservasi, mhsId: req.params.id });
});

router.post('/reservasi/add', async (req, res) => {
    const { mhsId, nim, nama, tanggal, waktu, psikologId } = req.body;
    await db.query('INSERT INTO reservasi (mahasiswa_id, nama_mhs, nim, tanggal, waktu, psikolog_id) VALUES (?,?,?,?,?,?)', 
    [mhsId, nama, nim, tanggal, waktu, psikologId]);
    res.redirect(`/mahasiswa/${mhsId}`);
});

router.get('/reservasi/delete/:id/:mhsId', async (req, res) => {
    await db.query('DELETE FROM reservasi WHERE id = ?', [req.params.id]);
    res.redirect(`/mahasiswa/${req.params.mhsId}`);
});

// PSIKOLOG ROUTES
router.get('/psikolog/:id', async (req, res) => {
    const [daftar] = await db.query('SELECT * FROM reservasi WHERE psikolog_id = ?', [req.params.id]);
    res.render('psikolog_dashboard', { daftar, psiId: req.params.id });
});

router.post('/psikolog/update-status', async (req, res) => {
    const { resId, status, psiId } = req.body;
    if (status === 'ditolak') {
        await db.query('DELETE FROM reservasi WHERE id = ?', [resId]);
    } else {
        await db.query('UPDATE reservasi SET status = ? WHERE id = ?', [status, resId]);
    }
    res.redirect(`/psikolog/${psiId}`);
});

module.exports = router;