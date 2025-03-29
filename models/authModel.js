const { pool } = require('../config/db');
const crypto = require('crypto');

async function createUser(email, password, salt){
    const query = 'INSERT INTO users (email, password, salt) VALUES ($1, $2, $3) RETURNING id;'
    const values = [email, password, salt];

    try {
        const result = await pool.query(query, values);
        return result.rows[0].id;
    }
    catch (err) {
        console.error('Error creating users: \n', err);
        throw err;
    }
}

async function findUserByEmail(email) {
    const query = 'SELECT id, email, password, salt FROM users WHERE email = $1 LIMIT 1';
    const values = [email];

    try {
        const result = await pool.query(query, values);
        return result.rows[0];
    }
    catch (err){
        console.error('Error finding by email: \n', err);
        throw err;
    }
}

module.exports = {
    createUser,
    findUserByEmail
}