const express = require('express');
const userController = require('../controllers/userController');
// Note: authenticateToken is applied in server.js for ALL /api/users routes

const router = express.Router();

router.get('/me', userController.getCurrentUser);

// Add other user routes here (e.g., update profile, etc.)

module.exports = router;