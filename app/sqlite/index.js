const fs = require('fs');
const imageCache = require('../image-cache');
const JSON5 = require('json5');
const path = require('path');
const {google} = require('googleapis');
const gdAPI = require('../gd-api');
const Database = require('better-sqlite3');
let isReady = false;

const parent = path.resolve(__dirname, 'db');
const dbPath = path.resolve(parent, 'manga.db');

const updatePath = "./data/toUpdate.json";
const toUpdate = [];

const categoryTableName = "categories";
const mangasTableName = "mangas";
const chaptersTableName = "chapters";

const createCategorySQL = `CREATE TABLE IF NOT EXISTS ${categoryTableName}(id int unique, name text)`;
const createMangasSQL = `CREATE TABLE IF NOT EXISTS ${mangasTableName}(id int unique, name text, thumbnail text, category_id int)`;
const createChaptersSQL = `CREATE TABLE IF NOT EXISTS ${chaptersTableName}(id int unique, name text, url text, page int, read bit, source_order int, manga_id int)`;

if (!fs.existsSync(parent))
    fs.mkdirSync(parent);

function checkDB(auth) {
    return new Promise((resolve, reject) => {
        if (!fs.existsSync(dbPath)) {
            console.log('DB not found!');
            if (auth)
                getDBWithoutToken(auth, resolve, reject);
            else
                getDBWithToken(resolve, reject);
        } else {
            Database.db = new Database(dbPath, {verbose: console.log});
            initDB();
            resolve();
        }
    });
}

function hasDBFile() {
    return fs.existsSync(dbPath);
}

function getDBWithToken(resolve, reject) {
    gdAPI.useAPI((auth) => {
        if (auth) {
            getDBWithoutToken(auth, resolve, reject);
        } else {
            reject('Need authorization in /gd/token');
        }
    });
}

function getDBWithoutToken(auth, resolve, reject) {
    const drive = google.drive({version: 'v3', auth});
    const writeStream = fs.createWriteStream(dbPath);
    drive.files.get({fileId: gdAPI.DB_FILE_ID, alt: 'media'}, {
        // Make sure we get the binary data
        responseType: 'stream'
    }, (err, res) => {
        if (err) return reject(err);
        res.data.on('end', function () {
            writeStream.close();
            console.log('DB downloaded');
            Database.db = new Database(dbPath, {verbose: console.log});
            initDB();
            resolve();
        }).pipe(writeStream);
    });
}

function prepare(statement) {
    if (isReady)
        return Database.db.prepare(statement);
}

function transaction(fn) {
    if (isReady)
        return Database.db.transaction(fn);
}

function backupDB() {
    gdAPI.useAPI((auth) => {
        const drive = google.drive({version: 'v3', auth});
        drive.files.update({
            fileId: gdAPI.DB_FILE_ID,
            media: {
                body: fs.createReadStream(dbPath)
            }
        }, (err) => {
            if (err) return console.log('The API returned an error: ' + err);
            console.log('DB has been backed up');
        })
    });
}

function addToUpdate(id) {
    toUpdate.push(id);
}

function clearToUpdate() {
    while (toUpdate.length) {
        toUpdate.pop();
    }
}

const deleteChapter = prepare(`DELETE FROM ${chaptersTableName} WHERE id=@id`);

function deleteChapters(ids) {
    transaction((ids) => {
        for (const id of ids)
            deleteChapter.run({id: id})
    }).call(ids);
}

const deleteManga = prepare(`DELETE FROM ${mangasTableName} WHERE id=@id`);
const deleteMangaChapters = prepare(`DELETE FROM ${chaptersTableName} WHERE manga_id=@id`);

function deleteMangas(mangas) {
    transaction((mangas) => {
        for (const id of mangas) {
            const obj = {id: id};
            const thumbnail = prepare(`SELECT thumbnail FROM ${mangasTableName} WHERE id=@id`).get(obj).thumbnail;
            if (thumbnail && imageCache.isCachedSync(thumbnail)) {
                imageCache.delCache(thumbnail);
            }
            deleteManga.run(obj);
            deleteMangaChapters.run(obj);
        }
    }).call(mangas);
}


const insertCategory = prepare(`INSERT INTO ${categoryTableName} VALUES(@id, @name)`);

function insertCategories(categories) {
    transaction((categories) => {
        for (const category of categories) {
            insertCategory.run(category);
        }
    }).call(categories);
}

const insertManga = prepare(`INSERT OR REPLACE INTO ${mangasTableName} VALUES(@id, @name, @thumbnail, @category_id)`);

function insertMangas(mangas) {
    transaction((mangas) => {
        for (const manga of mangas) {
            insertManga.run(manga);
        }
    }).call(mangas);
}

const insertChapter = prepare(`INSERT OR REPLACE INTO ${chaptersTableName} VALUES(@id, @name, @url, @page, @read, @order, @manga_id)`);

function insertChapters(chapters) {
    transaction((chapters) => {
        for (const chapter of chapters) {
            if (!chapter.page)
                chapter.page = 1;
            if (!chapter.read)
                chapter.read = 0;
            insertChapter.run(chapter);
        }
    }).call(chapters);
}

function clearDB() {
    transaction(function () {
        const tables = [categoryTableName, mangasTableName, chaptersTableName];
        for (const table of tables) {
            prepare(`DELETE FROM ${table}`).run();
        }
    }).call();
}

function initDB() {
    if (!fs.existsSync('./data'))
        fs.mkdirSync('./data');

    if (fs.existsSync(updatePath)) {
        const data = fs.readFileSync(updatePath, 'utf8');
        toUpdate.push(...JSON5.parse(data));

        fs.unlink(updatePath, (err) => {
            if (err)
                console.error(err);
        })
    }

    isReady = true;

    if (Database.db.pragma('auto_vacuum', {simple: true}) !== 1) {
        Database.db.pragma('auto_vacuum = 1');
        prepare('VACUUM;').run();
    }

    prepare(createCategorySQL).run();
    prepare(createMangasSQL).run();
    prepare(createChaptersSQL).run();

    setInterval(backupDB, 60 * 60 * 1000);
}

module.exports = {
    isReady: function () {
        return isReady
    },
    checkDB: checkDB,
    hasDBFile: hasDBFile,
    categoryTableName: categoryTableName,
    mangasTableName: mangasTableName,
    chaptersTableName: chaptersTableName,
    insertCategory: insertCategory,
    insertCategories: insertCategories,
    insertManga: insertManga,
    insertMangas: insertMangas,
    insertChapter: insertChapter,
    insertChapters: insertChapters,
    deleteMangas: deleteMangas,
    deleteChapter: deleteChapter,
    deleteChapters: deleteChapters,
    getToUpdate: function () {
        return toUpdate
    },
    updatePath: updatePath,
    addToUpdate: addToUpdate,
    clearToUpdate: clearToUpdate,
    clear: clearDB,
    prepare: prepare,
    backup: backupDB,
};

