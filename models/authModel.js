const { pool } = require('../config/db');
const crypto = require('crypto');

async function createUser(userDetails){
    const { email, hashedPassword, salt, firstName, lastName, age, sex, height, weight, blindVision, deafHearing, difficultyWalking } = userDetails;

    // Validate required fields (you can expand this as needed)
    if (!firstName || !lastName || !email || !hashedPassword || !age || !sex || !height || !weight || blindVision === undefined || deafHearing === undefined || difficultyWalking === undefined) {
        return res.status(400).json({ error: 'All fields are required.' });
    }

    const query = `
    INSERT INTO users (email, password, salt, first_name, last_name, age, sex, height, weight, blind_vision_difficulty, deaf_hearing_difficulty, difficulty_walking)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id;
    `;

    const values = [email, hashedPassword, salt, firstName, lastName, age, sex, height, weight, blindVision, deafHearing, difficultyWalking];

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