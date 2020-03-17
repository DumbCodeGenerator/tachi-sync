const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const SSE = require('sse-nodejs');
const session = require('express-session');
const passport = require('passport');
const SQLiteStore = require('connect-sqlite3')(session);
const imageCache = require('./image-cache');
const db = require('./sqlite');
const path = require('path');
const gdAPI = require('./gd-api');

const sessionsPath = path.resolve(__dirname, 'sqlite/db');

let mobileConnect = null;

const app = express();

require('./auth').init();

if (gdAPI.hasTokenFile() || db.hasDBFile()) {
    db.checkDB().catch((err) => console.error(err));
}

app.set('view engine', 'pug');
app.use(express.static('public', {extensions: ['html']}));
app.use(cors());
app.use(bodyParser.text());
app.use(bodyParser.json({limit: '50mb'}));
app.use(bodyParser.urlencoded({extended: false}));

app.use(session({
    store: new SQLiteStore({dir: sessionsPath}),
    cookie: {maxAge: 7 * 24 * 60 * 60 * 1000}, // 1 week
    resave: false,
    saveUninitialized: false,
    secret: 'YEP COCK'
}));
app.use(passport.initialize());
app.use(passport.session());
app.use((req, res, next) => {
    if (!db.isReady() && req.path !== '/gd/token' && req.path !== '/login') {
        if (gdAPI.hasTokenFile())
            return res.send('База данных ещё не готова для использования. Обновите страницу позже.');
        else
            return res.redirect('/gd/token');
    }
    next();
});

app.get('/sync/mobile', function (req, res) {
    const toUpdate = db.getToUpdate();
    mobileConnect = SSE(res, {heartbeat: true});
    console.log("Mobile Connected");

    if (toUpdate.length) {
        mobileConnect.sendEvent('recap', toUpdate);
        db.deleteChapters(toUpdate);
        db.clearToUpdate();
    }

    mobileConnect.disconnect(function () {
        console.log("Mobile Disconnected");
        mobileConnect = null;
    })
});

app.post('/sync', (req, res) => {
    const jsonData = req.body;

    if (jsonData.categories)
        db.insertCategories(jsonData.categories);
    if (jsonData.mangas)
        db.insertMangas(jsonData.mangas);
    if (jsonData.chapters)
        db.insertChapters(jsonData.chapters);

    res.sendStatus(200);
});

app.patch('/sync/mobile', (req, res) => {
    db.deleteChapters(req.body);
    res.sendStatus(200);
});

app.delete('/manga', (req, res) => {
    db.deleteMangas(req.body);
    res.sendStatus(200);
});

app.delete('/db', (req, res) => {
    db.clear();
    imageCache.flushCache();
    res.sendStatus(200);
});


function sendToSSE(data) {
    if (mobileConnect)
        mobileConnect.sendEvent('single', data);
    else
        db.addToUpdate(data.id);
}

require('./pc-routes').init(app, sendToSSE);

//The 404 Route (ALWAYS Keep this as the last route)
app.all('*', function (req, res) {
    res.status(404).send('PAGE NOT FOUND!');
});

module.exports = app;