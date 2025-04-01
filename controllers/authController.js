const authModel = require('../models/authModel');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({path : path.join(__dirname, '../.env')});

const jwtSecret = process.env.JWT_SECRET;

function hashPassword(password, salt){
    return crypto.createHmac('sha256', salt).update(password).digest('hex');
}

async function registerUser(req, res){
    try {
        const { email, password, firstName, lastName, age, sex, height, weight, blindVision, deafHearing, difficultyWalking } = req.body;
        const salt = crypto.randomBytes(16).toString('hex');
        const hashedPassword = hashPassword(password, salt);

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
        const user = await authModel.findUserByEmail(email);
        if(!user){
            return res.status(401).json({ error: 'Invalid credentials'});
        }

        const hashedPassword = hashPassword(password, user.salt);

        if (hashedPassword !== user.password) {
            return res.status(401).json({ error: 'Invalid Credentials'});
        }

        const token = jwt.sign({ userId: user.id, email: user.email }, jwtSecret, { expiresIn: '1h'});
        res.json({token});
    }
    catch (err) {
        res.status(500).json({error: 'Login failed'});
    }
}

module.exports = {
    registerUser,
    loginUser
}