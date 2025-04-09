const express = require('express');
const cookieParser = require('cookie-parser');

const path = require('path');
const dotenv = require('dotenv');
const { connectDB } = require('./config/db');

const userRoutes = require('./routes/userRoutes.js');
const authRoutes = require('./routes/authRoutes.js');
const requestRoutes = require('./routes/requestRoutes.js');
const matchRoutes = require('./routes/matchRoutes.js');
const mapRoutes = require('./routes/mapsRoute.js');
const chatRoutes = require('./routes/chatRoutes.js');

const { authenticateToken, protectPage } = require('./middleware/authMiddleWare.js');

const app = express();
const port = process.env.PORT || 3000;

dotenv.config({path : path.join(__dirname, './.env')});

// Middleware
app.use(express.static(path.join(__dirname, './public')));
app.use(express.json());
app.use(cookieParser());

// API Routes
app.use('/api/auth', authRoutes);

// Apply authentication middleware to request and match routes
app.use('/api/users', authenticateToken, userRoutes);
app.use('/api/requests', authenticateToken, requestRoutes); 
app.use('/api/matches', authenticateToken, matchRoutes);
app.use('/api/maps', authenticateToken, mapRoutes);
app.use('/api/chats', authenticateToken, chatRoutes);

// Protected API route
app.get('/api/protected', authenticateToken, (req, res) => {res.json({ message: "User authenticated", user: req.user });});

// Serve static pages
app.get('/', async (req, res) => {res.sendFile(path.join(__dirname, './public', 'index.html'));});
app.get('/login', (req, res) => {res.sendFile(path.join(__dirname, './public', 'login.html'));});
app.get('/register', (req, res) => {res.sendFile(path.join(__dirname, './public', 'register.html'));});

// Protected pages
app.get('/home', protectPage, (req, res) => {res.sendFile(path.join(__dirname, './public', 'home.html'))});
app.get('/createRequest', protectPage, (req, res) => {res.sendFile(path.join(__dirname, './public', 'createRequest.html'))})
app.get('/requestHistory', protectPage, (req, res) => {res.sendFile(path.join(__dirname, './public', 'requestHistory.html'))})
app.get('/helperMatches', protectPage, (req, res) => {res.sendFile(path.join(__dirname, './public', 'helperMatches.html'))})
app.get('/profile', protectPage, (req,res) => {res.sendFile(path.join(__dirname, './public', 'profile.html'))})
app.get('/chatList', protectPage, (req,res) => {res.sendFile(path.join(__dirname, './public', 'chatList.html'))})
app.get('/chatView', protectPage, (req,res) => {res.sendFile(path.join(__dirname, './public', 'chatView.html'))})


// Start server only if DB Connection is successful
connectDB().then(() => {
    app.listen(port, () => {
        console.log(`Server running on port ${port}`);
    })
})