function authenticationMiddleware() {
    return function (req, res, next) {

        // if user is authenticated in the session, carry on
        if (req.isAuthenticated())
            return next();

        // if they aren't redirect them to the home page
        if (req.path !== '/login')
            return res.redirect('/login');
        next();
    }
}

module.exports = authenticationMiddleware;