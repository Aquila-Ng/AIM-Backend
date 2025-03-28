const path = require('path');
const { Pool } = require('pg');

require('dotenv').config({path: path.join(__dirname, '../.env')});

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_DATABASE,
    password: String(process.env.DB_PASSWORD),
    port: process.env.DB_PORT
});

const connectDB = async () => {
    try {
        const client = await pool.connect();
        client.release();
    }
    catch (error){
        console.error('Error connecting to PSQL: \n', error);

    }
};

module.exports = {
    pool,
    connectDB
};