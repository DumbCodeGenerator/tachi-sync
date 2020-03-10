const app = require('./app');

function exitHandler() {
    const toUpdate = app.db.getToUpdate();
    if (toUpdate.length){
        fs.writeFileSync(app.db.getUpdatePath(), JSON5.stringify(toUpdate), 'utf8');
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