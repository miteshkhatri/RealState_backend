const jwt = require('jsonwebtoken');
const { fetchQuery } = require('../utils/helpers');

const verifyToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];

  if (!authHeader) {
    return res.status(403).json({ message: 'No token provided!' });
  }

  let token = authHeader;
  if (authHeader.includes(" ")) {
    token = authHeader.split(" ")[1];
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;

    // 🔥 Check in user_sessions instead of users
    const query = `
      SELECT us.*, u.*
      FROM user_sessions us
      JOIN users u ON us.user_id = u.user_id
      WHERE us.user_id = ? AND us.token = ?
    `;
    const result = await fetchQuery(query, [userId, token]);

    if (result.length === 0) {
      return res.status(401).json({ code: "TOKEN_EXPIRED",
        message: "Token expired"});
    }

    // user info attach
    req.user = result[0];
    next();

  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        code: "TOKEN_EXPIRED",
        message: "Token expired"
      });
    }

    return res.status(401).json({
      code: "INVALID_TOKEN",
      message: "Unauthorized!"
    });
  }
};

module.exports = verifyToken;
