

const db = require('../config/db');
const { insertQuery, fetchQuery } = require('../utils/helpers');
const multer = require('multer');
const path = require('path');


const crypto = require('crypto');
 

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));

    }
});


const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        const fileTypes = /jpeg|jpg|png|gif|webp/;
        const extname = fileTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = fileTypes.test(file.mimetype);

        if (extname && mimetype) {
            return cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'));
        }
    }
}).single('ProjectImage');

function hashPasswordFunction(password) {
    return crypto.createHash('md5').update(password).digest('hex');
}
exports.UpdateProfile = async (req, res) => {
  upload(req, res, async (err) => {
    if (err) {
      console.error('File upload error:', err);
      return res.status(400).json({ success: false, message: err.message });
    }

    const { userId, name, email, number, role, project_id, password, key } = req.body;
    const ProjectImage = req.file ? req.file.filename : null;

    if (!userId)
      return res.status(400).json({ success: false, message: "UserId is required" });

    const parseProjectIds = (input) => {
      if (!input) return [];
      if (Array.isArray(input)) {
        return Array.from(new Set(
          input
            .map(x => parseInt(x, 10))
            .filter(n => Number.isInteger(n) && n > 0)
        ));
      }
      return Array.from(new Set(
        String(input)
          .split(',')
          .map(s => s.trim())
          .filter(Boolean)
          .map(s => parseInt(s, 10))
          .filter(n => Number.isInteger(n) && n > 0)
      ));
    };

    try {

      // 1️⃣ Get Existing User
      const existingUser = await fetchQuery(
        `SELECT * FROM users WHERE user_id = ? AND is_delete = 0`,
        [userId]
      );

      if (!existingUser || existingUser.length === 0) {
        return res.status(404).json({ success: false, message: "User not found" });
      }

      const currentUser = existingUser[0];

      // 2️⃣ Prepare Updated Values
      const updatedName = name || currentUser.name;
      const updatedEmail = email || currentUser.email;
      const updatedNumber = number || currentUser.mobile_no;
      const updatedRole = role || currentUser.role;
      const updatedImage = ProjectImage || currentUser.image;

      const updatedPassword =
        password &&
        password !== 'undefined' &&
        password !== 'null' &&
        String(password).trim() !== ''
          ? hashPasswordFunction(password)
          : currentUser.password;

      // 3️⃣ Email uniqueness check
      if (email && email !== currentUser.email) {
        const emailConflict = await fetchQuery(
          `SELECT user_id FROM users WHERE email = ? AND user_id != ? AND is_delete = 0`,
          [email, userId]
        );

        if (emailConflict && emailConflict.length > 0) {
          return res.status(400).json({
            success: false,
            message: "Email is already in use by another user"
          });
        }
      }

      // 4️⃣ Update users table
      await insertQuery(
        `UPDATE users 
         SET name = ?, email = ?, password = ?, mobile_no = ?, image = ?, role = ? 
         WHERE user_id = ?`,
        [
          updatedName,
          updatedEmail,
          updatedPassword,
          updatedNumber,
          updatedImage,
          updatedRole,
          userId
        ]
      );

      // ============================================================
      // 🔥 assigned_project update ONLY when key is EMPTY
      // ============================================================

      if (
        key === undefined ||
        key === null ||
        key === '' ||
        String(key).trim() === ''
      ) {

        const existingAssigned = await fetchQuery(
          `SELECT id, assigned_project_id FROM assigned_project WHERE user_id = ?`,
          [userId]
        );

        const backupAssigned = Array.isArray(existingAssigned)
          ? existingAssigned.map(r => ({ ...r }))
          : [];

        await fetchQuery(
          `DELETE FROM assigned_project WHERE user_id = ?`,
          [userId]
        );

        const projectIds = parseProjectIds(project_id);

        let validProjectIds = projectIds;

        if (projectIds.length > 0) {
          const placeholders = projectIds.map(() => '?').join(',');
          const existRows = await fetchQuery(
            `SELECT project_id FROM projects 
             WHERE project_id IN (${placeholders}) AND is_delete = 0`,
            projectIds
          );

          const existIds = (existRows || []).map(r => Number(r.project_id));
          validProjectIds = projectIds.filter(id =>
            existIds.includes(Number(id))
          );
        }

        if (validProjectIds.length > 0) {
          const valuesSql = validProjectIds.map(() => '(?, ?, ?)').join(', ');
          const insertParams = [];
          const formattedDate = new Date().toISOString().split('T')[0];

          validProjectIds.forEach(pid => {
            insertParams.push(pid, userId, formattedDate);
          });

          try {
            await insertQuery(
              `INSERT INTO assigned_project 
               (assigned_project_id, user_id, create_at) 
               VALUES ${valuesSql}`,
              insertParams
            );
          } catch (insertErr) {

            // Restore backup if insert fails
            if (backupAssigned.length > 0) {
              const restoreValues = backupAssigned.map(() => '(?, ?, ?)').join(', ');
              const restoreParams = [];
              const formattedDate = new Date().toISOString().split('T')[0];

              backupAssigned.forEach(b => {
                restoreParams.push(b.assigned_project_id, userId, formattedDate);
              });

              await insertQuery(
                `INSERT INTO assigned_project 
                 (assigned_project_id, user_id, create_at) 
                 VALUES ${restoreValues}`,
                restoreParams
              );
            }

            return res.status(500).json({
              success: false,
              message: 'Failed to update assigned projects',
              error: insertErr.message
            });
          }
        }
      }

      // 6️⃣ Fetch Updated User
      const updatedRows = await fetchQuery(
        `SELECT u.*, ur.role AS user_role_name,
         GROUP_CONCAT(DISTINCT ap.assigned_project_id 
         ORDER BY ap.assigned_project_id SEPARATOR ',') AS assigned_project_ids
         FROM users u
         LEFT JOIN user_role ur ON u.role = ur.role_id
         LEFT JOIN assigned_project ap ON ap.user_id = u.user_id
         WHERE u.user_id = ?
         GROUP BY u.user_id`,
        [userId]
      );

      const updatedUser =
        updatedRows && updatedRows.length > 0
          ? updatedRows[0]
          : null;

      if (updatedUser) {
        updatedUser.assigned_project_ids =
          updatedUser.assigned_project_ids
            ? String(updatedUser.assigned_project_ids)
                .split(',')
                .map(v => Number(v))
            : [];

        updatedUser.role_id = updatedUser.role;
        updatedUser.role = updatedUser.user_role_name;
      }

      return res.json({
        success: true,
        data: updatedUser
      });

    } catch (error) {
      console.error('Error updating profile:', error);
      return res.status(500).json({
        success: false,
        message: "An error occurred while updating the profile",
        error: error.message
      });
    }
  });
};


