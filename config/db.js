const mysql = require('mysql2');
require('dotenv').config();

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
});

const checkDbConnection = async () => {
    try {
         
        const [rows] = await pool.promise().query('SELECT 1');
        console.log('Database connection successful');
    } catch (error) {
        console.error('Database connection failed:', error.message);
    }
};

checkDbConnection();

module.exports = pool.promise();
