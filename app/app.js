// TODO: Ini adalah titik masuk aplikasi, setup Express, Middleware, dan Server Listener disini
const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session'); 
const MySQLStore = require('express-mysql-session')(session); // TAMBAHAN: Store Session ke DB
const path = require('path');
const routes = require('./routes/index');
const db = require('./config/database'); // Pastikan koneksi DB dipanggil di sini
const dotenv = require('dotenv');

dotenv.config();
const app = express();

// Set View Engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'view'));

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// --- KONFIGURASI SESSION PERSISTEN ---
// Menyimpan session ke tabel MySQL agar tidak hilang saat refresh/restart
const sessionStore = new MySQLStore({}, db);

app.use(session({
    key: 'session_umy_counseling',
    secret: 'secret-key-counseling-umy',
    store: sessionStore,      // Gunakan Store DB
    resave: false,
    saveUninitialized: false, // Disetel false agar hemat memori
    cookie: { 
        maxAge: 86400000 // Berubah jadi 24 jam agar kamu tidak login terus tiap hari
    }
}));

// Routing
app.use('/', routes);

// Menjalankan Server
const PORT = process.env.APP_PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});