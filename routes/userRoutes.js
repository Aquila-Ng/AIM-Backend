const express = require('express');
const userController = require('../controllers/userController');
const router = express.Router();

// Route to test query
router.get('/test', userController.test);

// Route to get all users
router.get('/users', userController.getAllUsers);

// Route to get a user by ID
router.get('/users/:id', userController.getUserById);

// Route to create a new user
router.post('/users', userController.addUser);

module.exports = router;