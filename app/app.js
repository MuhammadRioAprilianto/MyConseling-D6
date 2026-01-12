// TODO: Ini adalah titik masuk aplikasi, setup Express, Middleware, dan Server Listener disini
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const routes = require('./routes/index');

const app = express();
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'view'));
app.use(bodyParser.urlencoded({ extended: true }));

app.use('/', routes);

app.listen(3000, () => console.log('App running on port 3000'));