const { pool } = require('../config/db.js');

// Function to test database query
const testQuery = async () => {
    try {   
        const res = await pool.query('SELECT current_database();');
        return res.rows;
    } catch (err) {
        console.error('Query error: \n', err);
    }
};

// Function to get all users from the database
const getAllUsers = async () => {
    try {
      const result = await pool.query('SELECT * FROM users LIMIT 50');
      return result.rows;  // Return the result rows
    } catch (err) {
      console.error('Error fetching users:', err);
      throw err;
    }
  };
  
  // Function to get a user by ID
  const getUserById = async (id) => {
    try {
      const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
      return result.rows[0];  // Return the first user object
    } catch (err) {
      console.error(`Error fetching user with ID ${id}:`, err);
      throw err;
    }
  };
  
  // Function to add a new user
  const addUser = async (name, email) => {
    try {
      const result = await pool.query(
        'INSERT INTO users (email, password) VALUES ($1, $2) RETURNING id',
        [name, email]
      );
      return result.rows[0].id;  // Return the ID of the newly created user
    } catch (err) {
      console.error('Error adding user:', err);
      throw err;
    }
  };

module.exports = {
    testQuery,
    getAllUsers,
    getUserById,
    addUser
};