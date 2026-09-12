const db = require('../config/db');

exports.insertQuery = async (query, params) => {
    try {
        const [result] = await db.execute(query, params);
        return { insertId: result.insertId };
    } catch (error) {
        console.log(error , 'update qurey error ')
        throw new Error(error.message);
    }
};

exports.fetchQuery = async (query, params) => {
    try {
        const [rows] = await db.execute(query, params);
        return rows;
    } catch (error) {
        console.log(error.message , 'fetchQuery error')
        throw new Error(error.message);
    }
};
