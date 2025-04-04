const authModel = require('../models/authModel');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({path : path.join(__dirname, '../.env')});

const jwtSecret = process.env.JWT_SECRET;
const COOKIE_EXPIRY_MS = 60 * 60 * 1000;
const COOKIE_NAME = 'authToken'; 

function hashPassword(password, salt){
    return crypto.createHmac('sha256', salt).update(password).digest('hex');
}

async function registerUser(req, res){
    try {
        const { email, password, firstName, lastName, age, sex, height, weight, blindVision, deafHearing, difficultyWalking } = req.body;

        if (!email || !password || !firstName || !lastName || !age || !sex || !height || !weight || blindVision === undefined || deafHearing === undefined || difficultyWalking === undefined) {
            return res.status(400).json({ error: 'All registration fields are required.' });
        }

        const salt = crypto.randomBytes(16).toString('hex');
        const hashedPassword = hashPassword(password, salt);

        const existingUser = await(authModel.findUserByEmail(email));
        if (existingUser){
            return res.status(409).json({error: 'Email already registered'});
        }

        const userId = await authModel.createUser({
            email, hashedPassword, salt, firstName, lastName, age, sex, height, weight, blindVision, deafHearing, difficultyWalking
        });

        res.status(201).json({ message: 'User registered succesfully', userId });
    }
    catch (err) {
        res.status(500).json({ error: 'Registration failed' });
    }
}

async function loginUser(req, res) {
    try{
        const {email, password} = req.body;
        if (!email || !password){
            return res.status(400).json({error: 'Email and Password  are required'});
        }
        
        const user = await authModel.findUserByEmail(email);
        if(!user){
            return res.status(401).json({ error: 'Invalid credentials'});
        }

        const hashedPassword = hashPassword(password, user.salt);

        if (hashedPassword !== user.password) {
            return res.status(401).json({ error: 'Invalid Credentials'});
        }

        const payload = {userId: user.id, email: user.email};
        const token = jwt.sign(payload, jwtSecret, { expiresIn: '1h'});

        res.cookie(COOKIE_NAME, token, {
            httpOnly: true, // Crucial for security
            secure: process.env.NODE_ENV === 'production', // Send only over HTTPS in production
            maxAge: COOKIE_EXPIRY_MS, // Cookie expiry in milliseconds
            path: '/', // Make cookie available site-wide
            // sameSite: 'lax' // Consider 'strict' or 'lax' for CSRF protection (lax is often a good default)
        });
        res.status(200).json({
            message: 'Login successful',
            user: { // Send some basic user info back
                id: user.id,
                email: user.email,
                // Add firstName etc. if needed by frontend immediately after login
            }
            // token: token // You might remove this if frontend completely relies on cookie/ /api/users/me
       });
    }
    catch (err) {
        console.error("Login Error:", err);
        res.status(500).json({error: 'Login failed due to a server error.'});
    }
}

async function logoutUser(req, res) {
    res.cookie(COOKIE_NAME, '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === production,
        expires: new Date(0),
        path: '/',
    });
    res.status(200).json({message: 'Logout successful'});
}

module.exports = {
    registerUser,
    loginUser,
    logoutUser
}