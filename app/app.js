// TODO: Ini adalah titik masuk aplikasi, setup Express, Middleware, dan Server Listener disini
const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session'); // Library untuk session
const path = require('path');
const routes = require('./routes/index');
const dotenv = require('dotenv');

dotenv.config();
const app = express();

// Set View Engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'view'));

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Konfigurasi Session
app.use(session({
    secret: 'secret-key-counseling-umy',
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 3600000 } // Session berlaku 1 jam
}));

// Routing
app.use('/', routes);

// Menjalankan Server
const PORT = process.env.APP_PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});