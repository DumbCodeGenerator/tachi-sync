const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;

const authenticationMiddleware = require('./middleware');

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

function initPassport() {
    passport.use(new LocalStrategy(
        function (username, password, done) {
            console.log(`user: ${username}; password: ${password}`);
            if (username !== 'krogon500')
                return done(null, false, {message: 'User not found'});
            else if (password !== '159753Qw')
                return done(null, false, {message: 'Wrong password'});

            console.log("success login");
            return done(null, {id: 1, name: 'pepega admin'});
        }
    ));

    passport.authenticationMiddleware = authenticationMiddleware;
}

module.exports = initPassport;