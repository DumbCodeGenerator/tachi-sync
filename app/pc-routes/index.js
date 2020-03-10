const passport = require('passport');
const fs = require('fs');
const cloudscraper = require('cloudscraper');
const imageCache = require('image-cache');
const mangaParser = require('../parsing');
const db = require('../sqlite');
const {google} = require('googleapis');
const gdAPI = require('../gd-api');

let oAuth2Client;


function initPCRoutes(app, sendToSSE) {
    app.get('/', passport.authenticationMiddleware(), (req, res) => {
        const rows = db.prepare(`SELECT * FROM ${db.categoryTableName}`).all();
        const categories = [];
        rows.forEach(row => {
            const categoryId = row.id;
            const categoryName = row.name;
            const mangas = [];
            const data = {category: categoryName};
            db.prepare(`SELECT id, name, thumbnail FROM ${db.mangasTableName} WHERE category_id = ?`).all(categoryId).forEach(manga => {
                const hasChapters = db.prepare(`SELECT id FROM ${db.chaptersTableName} WHERE manga_id=?`).get(manga.id);
                if (hasChapters)
                    mangas.push(manga);
            });
            data.mangas = mangas;
            categories.push(data);
        });
        res.render("index", {categories: categories});
    });

    app.get('/login', (req, res) => {
        res.render('login');
    });

    app.post('/login', passport.authenticate('local', {
        successRedirect: '/',
        failureRedirect: '/login'
    }));

    app.get('/gd/token', (req, res) => {
        fs.readFile('./app/gd-api/credentials.json', (err, content) => {
            if (err) return console.log('Error loading client secret file:', err);
            const {client_secret, client_id, redirect_uris} = JSON.parse(content).installed;
            oAuth2Client = new google.auth.OAuth2(
                client_id, client_secret, redirect_uris[0]);

            const authUrl = oAuth2Client.generateAuthUrl({
                access_type: 'offline',
                scope: gdAPI.SCOPES,
            });

            res.send(authUrl);
        });
    });

    app.post('/gd/token', (req, res) => {
        const code = req.body;
        gdAPI.saveAccessToken(oAuth2Client, code).then((auth) => {
            db.checkDB(auth);
        }).catch((err) => {
            console.error(err);
        });
        res.sendStatus(200);
    });

    app.get('/db/backup', (req, res) => {
        db.backup();
        res.status(200).send('DB has been initialized');
    });

    app.get('/viewer/:mangaId', passport.authenticationMiddleware(), function (req, res) {
        const mangaId = req.params.mangaId;
        const manga = db.prepare(`SELECT name FROM ${db.mangasTableName} WHERE id = ?`).get(mangaId);
        const rows = db.prepare(`SELECT * FROM ${db.chaptersTableName} WHERE manga_id = ? AND read = 0 ORDER BY source_order DESC`).all(mangaId);
        const title = manga ? manga.name : "NO DATA!";
        res.render("viewer", {chapters: rows, title: title});
    });

    app.patch('/sync', (req, res) => {
        const jsonData = req.body;

        db.deleteChapter.run(jsonData);

        sendToSSE(jsonData);

        res.sendStatus(200);
    });

    app.get('/parse/:url', (req, res) => {
        let parseUrl = new URL(req.params.url);
        if (parseUrl.hostname.includes("readmanga") || parseUrl.hostname.includes("mintmanga")) {
            mangaParser.parseGrouple(parseUrl).then(data => {
                res.send(data);
            })
        } else if (parseUrl.hostname.includes("mangalib")) {
            mangaParser.parseMangaLib(parseUrl).then(data => {
                res.send(data);
            });
        } else if (parseUrl.hostname === "kissmanga.com") {
            mangaParser.parseKissmanga(parseUrl).then(data => {
                res.send(data);
            })
        }
    });

    app.get('/cloud/:url', (req, res) => {
        const options = {
            method: "GET",
            encoding: null,
            url: encodeURI(req.params.url)
        };
        cloudscraper(options).then((data, err) => {
            if (err) throw err;
            res.end(data);
        })
    });

    app.get('/cache/:url', (req, res) => {
        const url = req.params.url;
        if (!url) return;

        imageCache.fetchImages(url).then((images) => {
            res.send(images.data);
        });
    });
}

module.exports = {
    init: initPCRoutes
};