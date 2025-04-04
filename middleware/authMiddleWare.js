const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({path : path.join(__dirname, '../.env')});

const jwtSecret = process.env.JWT_SECRET;

function authenticateToken(req, res, next) {
    let token = req.cookies?.[COOKIE_NAME];

    // If no cookie token, check Authorization header (for non-browser clients or specific cases)
    if (!token) {
        const authHeader = req.headers['Authorization']; // Note: case-insensitive lookup is better in production
        const headerToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
        if (headerToken) {
            token = headerToken;
            console.log("Using token from Authorization header."); // For debugging
        }
    } else {
         console.log("Using token from HttpOnly cookie."); // For debugging
    }


    if (token == null) {
        console.log('Auth Middleware: No token found.');
        return res.sendStatus(401);
    }

    jwt.verify(token, jwtSecret, (err, user) => {
        if (err) {
            console.log('Auth Middleware: Token verification failed.', err.message);
            res.clearCookie(COOKIE_NAME, { path: '/' });
            return res.sendStatus(403); // Forbidden (invalid token)
        }
        
        req.user = user; // Contains { userId, email, iat, exp } from the payload
        console.log('Auth Middleware: Token verified successfully for user:', user.userId);
        next(); 
    });
}

function protectPage(req, res, next) {
    const token = req.cookies?.[COOKIE_NAME];

    if (!token) {
        console.log('Protect Page: No token cookie found, redirecting to login.');
        return res.redirect('/login'); // Redirect if no token cookie
    }

    jwt.verify(token, jwtSecret, (err, user) => {
        if (err) {
            console.log('Protect Page: Token verification failed, clearing cookie and redirecting.', err.message);
            // Clear the invalid/expired cookie and redirect
            res.clearCookie(COOKIE_NAME, { path: '/' });
            return res.redirect('/login');
        }
        // Token is valid, attach user payload (optional for page serving, but can be useful)
        req.user = user;
        console.log('Protect Page: Token verified, allowing access for user:', user.userId);
        next(); // Proceed to serve the protected HTML page
    });
}

module.exports = {
    authenticateToken,
    protectPage
}

