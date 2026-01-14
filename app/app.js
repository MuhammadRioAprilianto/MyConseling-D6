// TODO: Ini adalah titik masuk aplikasi, setup Express, Middleware, dan Server Listener disini
const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session'); 
const MySQLStore = require('express-mysql-session')(session);
const path = require('path');
const routes = require('./routes/index');
const db = require('./config/database');
const dotenv = require('dotenv');

dotenv.config();
const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'view'));

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Konfigurasi Session Persisten ke MySQL
const sessionStore = new MySQLStore({}, db);
app.use(session({
    key: 'session_umy_counseling',
    secret: 'secret-key-counseling-umy',
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 86400000 } // Aktif 24 jam
}));

app.use('/', routes);

const PORT = process.env.APP_PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});