const fs = require('fs');
const path = require('path');
const {google} = require('googleapis');

const SCOPES = ['https://www.googleapis.com/auth/drive'];
const TOKEN_PATH = path.resolve(__dirname, 'token.json');
const DB_FILE_ID = '1wz4jp6oyZtwOLK7NkSGvTtK0qa8AXrZn';
const CREDENTIALS_PATH = path.resolve(__dirname, 'credentials.json');
const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, {encoding: 'utf8'}));

const {client_secret, client_id, redirect_uris} = credentials.installed;
const oAuth2Client = new google.auth.OAuth2(
    client_id, client_secret, redirect_uris[0]);

const origSet = oAuth2Client.setCredentials;
oAuth2Client.setCredentials = extendedSet;

function extendedSet(credentials) {
    if (!oAuth2Client.ready) {
        origSet.apply(oAuth2Client, [credentials]);
        oAuth2Client.ready = true;
    }
}

function hasTokenFile() {
    return fs.existsSync(TOKEN_PATH);
}

/**
 * Using GD API
 * @param {function} callback The callback to call with the authorized client.
 */
function useAPI(callback) {
    // Check if we have previously stored a token.
    fs.readFile(TOKEN_PATH, (err, token) => {
        if (err) return callback(null);
        oAuth2Client.setCredentials(JSON.parse(token));
        callback(oAuth2Client);
    });
}

function getAuthUrl() {
    return oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
    });
}

function saveAccessToken(code) {
    return new Promise((resolve, reject) => {
        oAuth2Client.getToken(code, (err, token) => {
            if (err) return reject(err);
            // Store the token to disk for later program executions
            fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
                if (err) return reject(err);
                oAuth2Client.setCredentials(token);
                resolve(oAuth2Client);
            });
        });
    });
}

module.exports = {
    DB_FILE_ID: DB_FILE_ID,
    useAPI: useAPI,
    saveAccessToken: saveAccessToken,
    hasTokenFile: hasTokenFile,
    getAuthUrl: getAuthUrl
};