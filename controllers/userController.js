const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { insertQuery, fetchQuery } = require('../utils/helpers');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');

 
function hashPassword(password) {
    return crypto.createHash('md5').update(password).digest('hex');
}

// exports.login = async (req, res) => {
//     const { email, password } = req.body;

//     if (!email || !password) {
//         return res.status(400).json({ success: false, message: "Email or password required" });
//     }

//     try {
//         // User fetch karo email ke basis pe
//         const query = `
//             SELECT * 
//             FROM users 
//             JOIN user_role ON users.role = user_role.role_id
//             WHERE users.email = ?;
//         `;
//         const users = await fetchQuery(query, [email]);

//         if (!users || users.length === 0) {
//             return res.status(404).json({ success: false, message: "Email not found" });
//         }

//         const user = users[0];

//         // Password verify karo
//         const hashedPassword = hashPassword(password);
//         if (user.password !== hashedPassword) {
//             return res.json({ success: false, message: "Wrong password" });
//         }

//         // JWT generate karo 1 year ke liye
//         const token = jwt.sign(
//             { userId: user.user_id }, 
//             process.env.JWT_SECRET, 
//              { expiresIn: '7d' }
//         );

//         // Database me sirf last_login aur user_token update karo
//         const updateQuery = `UPDATE users SET last_login = NOW(), user_token = ? WHERE email = ?`;
//         await fetchQuery(updateQuery, [token, email]);

//         // Assigned projects fetch karo
//         const projects = await fetchQuery(`SELECT * FROM assigned_project WHERE user_id = ?`, [user.user_id]);

//         // Response me user_token show karna hai, password nahi
//         const { password: _, ...safeUser } = user; // password hata do
//         res.json({
//             success: true,
//             user: {
//                 ...safeUser,
//                 user_token: token, // latest token show kar raha hai
//                 project: projects
//             }
//         });

//     } catch (error) {
//         console.error("Server Error:", error);
//         res.status(500).json({ error: error.message });
//     }
// };

exports.login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, message: "Email or password required" });
  }

  try {
    // User fetch
    const query = `
      SELECT * 
      FROM users 
      JOIN user_role ON users.role = user_role.role_id
      WHERE users.email = ?;
    `;
    const users = await fetchQuery(query, [email]);

    if (!users || users.length === 0) {
      return res.status(404).json({ success: false, message: "Email not found" });
    }

    const user = users[0];

    // Password check
    const hashedPassword = hashPassword(password);
    if (user.password !== hashedPassword) {
      return res.json({ success: false, message: "Wrong password" });
    }

    // Token generate
    const token = jwt.sign(
      { userId: user.user_id }, 
      process.env.JWT_SECRET, 
      { expiresIn: '1d' }
    );

    // Device & IP
    const deviceInfo = req.headers['user-agent'] || 'Unknown Device';
    const ipAddress =
      req.headers['x-forwarded-for']?.split(',')[0] ||
      req.socket.remoteAddress ||
      'Unknown IP';

    // last_login update
    await fetchQuery(
      `UPDATE users SET last_login = NOW() WHERE email = ?`,
      [email]
    );

    // 🔍 Check same device + IP
    const existingSession = await fetchQuery(
      `SELECT id FROM user_sessions 
       WHERE user_id = ? AND device_info = ? AND ip_address = ?`,
      [user.user_id, deviceInfo, ipAddress]
    );

    if (existingSession.length > 0) {
      // 🔁 Replace token
      await fetchQuery(
        `UPDATE user_sessions SET token = ?, created_at = NOW() WHERE id = ?`,
        [token, existingSession[0].id]
      );
    } else {
      // ➕ New device → new row
      await fetchQuery(
        `INSERT INTO user_sessions (user_id, token, device_info, ip_address)
         VALUES (?, ?, ?, ?)`,
        [user.user_id, token, deviceInfo, ipAddress]
      );
    }

    // Assigned projects
    const projects = await fetchQuery(
      `SELECT * FROM assigned_project WHERE user_id = ?`,
      [user.user_id]
    );

    const { password: _, ...safeUser } = user;

    res.json({
      success: true,
      user: {
        ...safeUser,
        user_token: token,
        project: projects
      }
    });

  } catch (error) {
    console.error("Server Error:", error);
    res.status(500).json({ error: error.message });
  }
};

exports.checkOrInsertPasswordB = async (req, res) => {
    const { user_id, password_b } = req.body;

    if (!user_id || !password_b) {
        return res.status(400).json({ success: false, message: "user_id or password_b required" });
    }

    try {
        // 🟢 1️⃣ Check if user exists
        const users = await fetchQuery(`SELECT * FROM users WHERE user_id = ? LIMIT 1`, [user_id]);

        if (users.length === 0) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        const user = users[0];
        const hashedPasswordB = hashPassword(password_b);

        // 🟡 2️⃣ If password_b is NULL → insert/update karo
        if (!user.password_b) {
            await fetchQuery(`UPDATE users SET password_b = ? WHERE user_id = ?`, [hashedPasswordB, user_id]);
            return res.json({ success: true, message: "password_b inserted successfully" });
        }

        // 🟢 3️⃣ If already present → verify karo
        if (user.password_b === hashedPasswordB) {
            return res.json({ success: true, message: "password verified successfully" });
        } else {
            return res.json({ success: false, message: "Invalid password" });
        }

    } catch (error) {
        console.error("Error in checkOrInsertPasswordB:", error);
        res.status(500).json({ success: false, message: "Server error", error: error.message });
    }
};

