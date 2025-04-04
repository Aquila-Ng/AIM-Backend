const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
const { connectDB } = require('./config/db');
const authRoutes = require('./routes/authRoutes.js');
const requestRoutes = require('./routes/requestRoutes.js');
const matchRoutes = require('./routes/matchRoutes.js');


const { authenticateToken } = require('./middleware/authMiddleWare.js');

const app = express();
const port = process.env.PORT || 3000;

dotenv.config({path : path.join(__dirname, './.env')});

// Middleware
app.use(express.static(path.join(__dirname, './public')));
app.use(express.json());

// API Routes
app.use('/api/auth', authRoutes);

// Apply authentication middleware to request and match routes
app.use('/api/requests', authenticateToken, requestRoutes); 
app.use('/api/matches', authenticateToken, matchRoutes);

// Protected API route
app.get('/api/user', authenticateToken, (req, res) => {res.json({ message: "User authenticated", user: req.user });});

// Serve static pages
app.get('/', async (req, res) => {res.sendFile(path.join(__dirname, './public', 'index.html'));});
app.get('/login', (req, res) => {res.sendFile(path.join(__dirname, './public', 'login.html'));});
app.get('/register', (req, res) => {res.sendFile(path.join(__dirname, './public', 'register.html'));});

// Protected pages
app.get('/home', (req, res) => {res.sendFile(path.join(__dirname, './public', 'home.html'))});
app.get('/request', (req, res) => {res.sendFile(path.join(__dirname, './public', 'request.html'))})
app.get('/matches', (req, res) => {res.sendFile(path.join(__dirname, './public', 'matches.html'))});
app.get('/requestHistory', (req, res) => {res.sendFile(path.join(__dirname, './public', 'requestHistory.html'))})



// Start server only if DB Connection is successful
connectDB().then(() => {
    app.listen(port, () => {
        console.log(`Server running on port ${port}`);
    })
})