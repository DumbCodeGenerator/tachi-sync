const app = require('./app');
const db = require('./app/sqlite');
const fs = require('fs');
const JSON5 = require('json5');

function exitHandler() {
    if (!db.isReady()) return;

    const toUpdate = db.getToUpdate();
    if (toUpdate.length) {
        fs.writeFileSync(db.updatePath, JSON5.stringify(toUpdate), 'utf8');
    }
}

['SIGHUP', 'SIGINT', 'SIGQUIT', 'SIGILL', 'SIGTRAP', 'SIGABRT',
    'SIGBUS', 'SIGFPE', 'SIGUSR1', 'SIGSEGV', 'SIGUSR2', 'SIGTERM'
].forEach(function (sig) {
    process.on(sig, function () {
        exitHandler();
        console.log('signal: ' + sig);
        process.exit(0);
    });
});

const IPAddr = process.env.OPENSHIFT_NODEJS_IP || "0.0.0.0";
const port = process.env.OPENSHIFT_NODEJS_PORT || 8080;

app.listen(port, IPAddr, () => console.log(`Server listening on ${IPAddr}:${port}!`));