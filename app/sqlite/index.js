const fs = require('fs');
const imageCache = require('image-cache');
const JSON5 = require('json5');
const path = require('path');
const {google} = require('googleapis');
const gdAPI = require('../gd-api');
let Database = require('better-sqlite3');

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

if (!fs.existsSync(dbPath)) {
    console.log('DB not found!');
    gdAPI.useAPI((auth) => {
        const drive = google.drive({version: 'v3', auth});
        const writeStream = fs.createWriteStream(dbPath);
        drive.files.get({fileId: gdAPI.DB_FILE_ID, alt: 'media'}, {
            // Make sure we get the binary data
            responseType: 'stream'
        }, (err, res) => {
            if (err) return console.log('The API returned an error: ' + err);
            res.data.on('end', function () {
                writeStream.close();
                console.log('DB downloaded');
                Database.db = new Database(dbPath, {verbose: console.log});
                initDB();
            }).pipe(writeStream);
        });
    });
} else {
    Database.db = new Database(dbPath, {verbose: console.log});
    initDB();
}

function prepare(statement) {
    return Database.db.prepare(statement);
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

function getToUpdate() {
    return toUpdate;
}

function getUpdatePath() {
    return updatePath;
}

function addToUpdate(id) {
    toUpdate.push(id);
}

function clearToUpdate() {
    while (toUpdate.length) {
        toUpdate.pop();
    }
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

    Database.db.prepare(createCategorySQL).run();
    Database.db.prepare(createMangasSQL).run();
    Database.db.prepare(createChaptersSQL).run();

    const deleteChapter = Database.db.prepare(`DELETE FROM ${chaptersTableName} WHERE id=@id`);
    const deleteChapters = Database.db.transaction((ids) => {
        for (const id of ids)
            deleteChapter.run({id: id})
    });

    const deleteManga = Database.db.prepare(`DELETE FROM ${mangasTableName} WHERE id=@id`);
    const deleteMangaChapters = Database.db.prepare(`DELETE FROM ${chaptersTableName} WHERE manga_id=@id`);
    const deleteMangas = Database.db.transaction((mangas) => {
        for (const id of mangas) {
            const obj = {id: id};
            const thumbnail = Database.db.prepare(`SELECT thumbnail FROM ${mangasTableName} WHERE id=@id`).get(obj).thumbnail;
            if (thumbnail && imageCache.isCachedSync(thumbnail)) {
                imageCache.delCache(thumbnail);
            }
            deleteManga.run(obj);
            deleteMangaChapters.run(obj);
        }
    });


    const insertCategory = Database.db.prepare(`INSERT INTO ${categoryTableName} VALUES(@id, @name)`);
    const insertCategories = Database.db.transaction((categories) => {
        for (const category of categories) {
            insertCategory.run(category);
        }
    });

    const insertManga = Database.db.prepare(`INSERT OR REPLACE INTO ${mangasTableName} VALUES(@id, @name, @thumbnail, @category_id)`);
    const insertMangas = Database.db.transaction((mangas) => {
        for (const manga of mangas) {
            insertManga.run(manga);
        }
    });

    const insertChapter = Database.db.prepare(`INSERT OR REPLACE INTO ${chaptersTableName} VALUES(@id, @name, @url, @page, @read, @order, @manga_id)`);
    const insertChapters = Database.db.transaction((chapters) => {
        for (const chapter of chapters) {
            if (!chapter.page)
                chapter.page = 1;
            if (!chapter.read)
                chapter.read = 0;
            insertChapter.run(chapter);
        }
    });

    const clearDB = Database.db.transaction(() => {
        const tables = [categoryTableName, mangasTableName, chaptersTableName];
        for (const table of tables) {
            if (tables.hasOwnProperty(table))
                Database.db.prepare(`DELETE FROM ${table}`).run();
        }
    });

    Database.categoryTableName = categoryTableName;
    Database.mangasTableName = mangasTableName;
    Database.chaptersTableName = chaptersTableName;

    Database.insertCategory = insertCategory;
    Database.insertCategories = insertCategories;
    Database.insertManga = insertManga;
    Database.insertMangas = insertMangas;
    Database.insertChapter = insertChapter;
    Database.insertChapters = insertChapters;

    Database.deleteMangas = deleteMangas;
    Database.deleteChapter = deleteChapter;
    Database.deleteChapters = deleteChapters;

    Database.getToUpdate = getToUpdate;
    Database.getUpdatePath = getUpdatePath;
    Database.addToUpdate = addToUpdate;
    Database.clearToUpdate = clearToUpdate;

    Database.clear = clearDB;
    Database.prepare = prepare;
    Database.backup = backupDB;

    setInterval(backupDB, 60 * 60 * 1000)
}

module.exports = Database;

