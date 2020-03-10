const JSON5 = require('json5');
const DomParser = require('dom-parser');
const parser = new DomParser();
const Base64 = require('js-base64').Base64;
const fetch = require('node-fetch');

async function parseGrouple(url) {
    if (url.hostname === "mintmanga.live")
        url.hostname = "mintmanga.com";
    if (!url.search)
        url.search = "?mtr=1";

    let response = await fetch(url, {headers: {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.122 Safari/537.36'}});
    let htmlString = await response.text();
    let links = [];
    let servers = JSON5.parse(htmlString.match(/var servers = (\[.*?])/i)[1]);
    let jsonLinks = JSON5.parse(htmlString.match(/rm_h\.init\(\s(.*?), 0, false\)/i)[1]);
    jsonLinks.forEach(value => {
        if (value[1].endsWith("/manga/")) {
            links.push(value[0] + value[2]);
        } else {
            links.push(value[1] + value[0] + value[2]);
        }
    });
    return {servers: servers, links: links};
}

async function parseMangaLib(url) {
    let response = await fetch(url, {headers: {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.122 Safari/537.36'}});
    let htmlString = await response.text();
    console.log(htmlString);
    let imgServers = ["https://img2.mangalib.me", "https://img3.mangalib.me"];
    let html = parser.parseFromString(htmlString);
    let pagesBase64 = html.getElementsByClassName("pp")[0].innerHTML.replace("<!-- ", "").replace(" -->", "");
    let pagesInfo = JSON5.parse(Base64.decode(pagesBase64));
    let imgUrl = JSON5.parse(htmlString.match(/window\.__info = (.*?);/i)[1])['imgUrl'];
    let links = [];
    pagesInfo.forEach(page => {
        const link = imgServers[0] + imgUrl + page['u'];
        links.push(cfLink(link));
    });
    return links;
}

async function parseKissmanga(url) {
    const CryptoJS = require("crypto-js");
    let key = "";
    const iv = "a5e8e2e9c2721be0a84ad660c472c1f3";
    const options = {
        method: "GET",
        encoding: 'utf8',
        url: url
    };
    let response = await cloudscraper(options);

    let html = parser.parseFromString(response);
    html.getElementsByTagName('script').forEach(elem => {
        const text = elem.innerHTML;
        if (text.includes('chko')) {
            const part = JSON5.parse(text.match(/\[".*?"]/)[0])[0];
            if (/chko\s*\+\s*/.test(text)) {
                key += part;
            } else {
                key = part;
            }
        }
    });

    const regex = /lstImages\.push\(wrapKA\("(.*?)"\)\);/g;
    let links = [];
    while (match = regex.exec(response)) {
        const bytes = CryptoJS.AES.decrypt(Base64.utob(match[1]), CryptoJS.SHA256(key), {
            iv: CryptoJS.enc.Hex.parse(iv),
        });
        const link = bytes.toString(CryptoJS.enc.Utf8);
        links.push(cfLink(link));
    }
    return links;
}

function cfLink(link) {
    return "/cloud/" + encodeURIComponent(link);
}

module.exports = {
    parseGrouple: parseGrouple,
    parseMangaLib: parseMangaLib,
    parseKissmanga: parseKissmanga
};