const userModel = require('../models/userModel');

// Handle request logic for test query
const test = async (req, res) => {
  try {
    const result = await userModel.testQuery();
    res.json(result);
  }
  catch (err) {
    res.status(500).json({ error: 'Failed test' });
  }
  
}

// Handle request logic for getting all users
const getAllUsers = async (req, res) => {
  try {
    const users = await userModel.getAllUsers();
    res.json(users);
  } 
  catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
};

// Handle request logic for getting a user by ID
const getUserById = async (req, res) => {
  const { id } = req.params;
  try {
    const user = await userModel.getUserById(id);
    if (user) {
      res.json(user);
    } 
    else {
      res.status(404).json({ error: 'User not found' });
    }
  } 
  catch (err) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
};

// Handle request logic for adding a new user
const addUser = async (req, res) => {
  const { name, email } = req.body;
  try {
    const userId = await userModel.addUser(name, email);
    res.status(201).json({ id: userId, name, email });
  } 
  catch (err) {
    res.status(500).json({ error: 'Failed to create user' });
  }
};

module.exports = {
  test,
  getAllUsers,
  getUserById,
  addUser,
};