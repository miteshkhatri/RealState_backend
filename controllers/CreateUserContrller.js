const db = require('../utils/helpers');
const multer = require('multer');
const path = require('path');

const crypto = require('crypto');
function hashPassword(password) {
    return crypto.createHash('md5').update(password).digest('hex');
}


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
}).single('UserImage');



// exports.CreateUser = (req, res) => {
//     upload(req, res, async (err) => {
//         const { Name, Number, Email, password, role, project_id } = req.body;
//         const UserImage = req.file ? req.file.filename : null;
     
//         const createDate = new Date();
//         const formattedDate = createDate.toISOString().split('T')[0];  

//         if (!Name) {
//             return res.json({ success: false, message: 'Name is required' });
//         }
//         if (!Number) {
//             return res.json({ success: false, message: 'Number is required' });
//         }
//         if (!Email) {
//             return res.json({ success: false, message: 'Email is required' });
//         }
//         if (!password) {
//             return res.json({ success: false, message: 'Password is required' });
//         }
//         if (!role) {
//             return res.json({ success: false, message: 'Role is required' });
//         }

//         try {

//             const emailCheckQuery = `SELECT * FROM users WHERE email = ? AND is_delete = ?`;
//             const existingUser = await db.fetchQuery(emailCheckQuery, [Email , 0]);
//             if (existingUser.length > 0) {
//                 return res.json({ success: false, message: 'Email already exists' });
//             }


//             const encryptedPassword = hashPassword(password);

//             const insertQuery = `INSERT INTO users (name, email, password, mobile_no, image, role, create_at)
//                                   VALUES (?, ?, ?, ?, ?, ?, ? )`;
//             const params = [
//                 Name,
//                 Email,
//                 encryptedPassword,
//                 Number,
//                 UserImage || '',
//                 role,
//                 formattedDate,
//             ];

//             const result = await db.insertQuery(insertQuery, params);
//             const lastUserId = result.insertId;
//             if (project_id > 0) {

//                 const assigned_project = `INSERT INTO assigned_project(assigned_project_id, user_id, create_at)
//                  VALUES (?,?,?)`
//                 const assigned_params = [
//                     project_id || null,
//                     lastUserId,
//                     formattedDate
//                 ];
//                 await db.insertQuery(assigned_project, assigned_params)
//             }
//             res.json({ success: true, message: 'User created successfully' });
//         } catch (error) {
//             console.error(error);
//             res.status(500).json({ success: false, message: 'Internal server error' });
//         }
//     });
// };

exports.CreateUser = (req, res) => {
  upload(req, res, async (err) => {
    // NOTE: renamed `Number` -> `mobile` to avoid shadowing global Number()
    const { Name, Number: _num, Email, password, password_b, role, project_id } = req.body;
    const mobile = _num; // phone value
    const UserImage = req.file ? req.file.filename : null;

    const createDate = new Date();
    const formattedDate = createDate.toISOString().split('T')[0];

    if (!Name) return res.json({ success: false, message: 'Name is required' });
    if (!mobile) return res.json({ success: false, message: 'Number is required' });
    if (!Email) return res.json({ success: false, message: 'Email is required' });
    if (!password) return res.json({ success: false, message: 'Password is required' });
    if (!role) return res.json({ success: false, message: 'Role is required' });

    // helper to parse project ids (string "1,2" or array)
    const parseProjectIds = (input) => {
      let ids = [];
      if (!input) return ids;
      if (Array.isArray(input)) {
        ids = input
          .map(x => {
            const n = parseInt(x, 10);
            return Number.isInteger(n) ? n : null;
          })
          .filter(n => n && n > 0);
      } else {
        ids = String(input)
          .split(',')
          .map(x => x.trim())
          .filter(Boolean)
          .map(x => {
            const n = parseInt(x, 10);
            return Number.isInteger(n) ? n : null;
          })
          .filter(n => n && n > 0);
      }
      return Array.from(new Set(ids));
    };

    try {
      // 1) email uniqueness check
      const emailCheckQuery = `SELECT 1 FROM users WHERE email = ? AND is_delete = ? LIMIT 1`;
      const existingUser = await db.fetchQuery(emailCheckQuery, [Email, 0]);
      if (existingUser && existingUser.length > 0) {
        return res.json({ success: false, message: 'Email already exists' });
      }

      // prepare data
      const encryptedPassword = hashPassword(password);
      const encryptedPasswordB = password_b ? hashPassword(password_b) : null;

      // Try to use a transaction if available (preferred)
      const canUsePool = db && (db.pool || db.getConnection || db.getPool);
      if (canUsePool) {
        let conn;
        try {
          if (db.pool && typeof db.pool.getConnection === 'function') {
            conn = await db.pool.getConnection();
          } else if (typeof db.getConnection === 'function') {
            conn = await db.getConnection();
          } else if (db.getPool && typeof db.getPool === 'function') {
            const p = db.getPool();
            conn = await p.getConnection();
          } else {
            conn = null;
          }

          if (conn && typeof conn.beginTransaction === 'function') {
            await conn.beginTransaction();

            // insert user using connection
            const [insertResult] = await conn.execute(
              `INSERT INTO users (name, email, password, password_b, mobile_no, image, role, create_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
              [Name, Email, encryptedPassword, encryptedPasswordB, mobile, UserImage || '', role, formattedDate]
            );
            const lastUserId = insertResult.insertId;

            // parse & validate projects
            let projectIds = parseProjectIds(project_id);

            if (projectIds.length > 0) {
              const placeholders = projectIds.map(() => '?').join(',');
              const [existRows] = await conn.execute(
                `SELECT project_id FROM projects WHERE project_id IN (${placeholders}) AND is_delete = 0`,
                projectIds
              );
              const validIds = existRows.map(r => Number(r.project_id));
              projectIds = projectIds.filter(id => validIds.includes(id));
            }

            // insert assigned_project rows
            if (projectIds.length > 0) {
              const valuesSql = projectIds.map(() => '(?, ?, ?)').join(', ');
              const params = [];
              projectIds.forEach(pid => params.push(pid, lastUserId, formattedDate));
              await conn.execute(
                `INSERT INTO assigned_project (assigned_project_id, user_id, create_at) VALUES ${valuesSql}`,
                params
              );
            }

            await conn.commit();
            if (typeof conn.release === 'function') conn.release();
            return res.json({ success: true, message: 'User created successfully' });
          } else {
            if (conn && typeof conn.release === 'function') conn.release();
            throw new Error('No transaction support on connection, falling back');
          }
        } catch (txErr) {
          try {
            if (conn) {
              if (typeof conn.rollback === 'function') await conn.rollback();
              if (typeof conn.release === 'function') conn.release();
            }
          } catch (rb) {
            console.error('Rollback/release error:', rb);
          }
          console.warn('Transaction path failed, falling back to non-transactional method:', txErr.message);
          // fallthrough to non-transactional path
        }
      }

      // ---------- FALLBACK NON-TRANSACTIONAL PATH ----------
      const insertQuery = `
        INSERT INTO users (name, email, password, password_b, mobile_no, image, role, create_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;
      const params = [Name, Email, encryptedPassword, encryptedPasswordB, mobile, UserImage || '', role, formattedDate];
      const insertResult = await db.insertQuery(insertQuery, params);
      const lastUserId = insertResult.insertId;

      // parse & validate projects
      let projectIds = parseProjectIds(project_id);
      if (projectIds.length > 0) {
        const placeholders = projectIds.map(() => '?').join(',');
        const existQuery = `SELECT project_id FROM projects WHERE project_id IN (${placeholders}) AND is_delete = 0`;
        const existRows = await db.fetchQuery(existQuery, projectIds);
        const validIds = existRows.map(r => Number(r.project_id));
        projectIds = projectIds.filter(id => validIds.includes(id));
      }

      // try to insert assigned_project rows
      try {
        if (projectIds.length > 0) {
          const assignedInsert = `
            INSERT INTO assigned_project (assigned_project_id, user_id, create_at)
            VALUES ${projectIds.map(() => '(?, ?, ?)').join(',')}
          `;
          const assignedParams = [];
          projectIds.forEach(pid => assignedParams.push(pid, lastUserId, formattedDate));
          await db.insertQuery(assignedInsert, assignedParams);
        }

        return res.json({ success: true, message: 'User created successfully' });
      } catch (assignErr) {
        // cleanup: remove created user to avoid orphan
        try {
          await db.fetchQuery('DELETE FROM users WHERE user_id = ?', [lastUserId]);
          console.warn('assigned_project insert failed — deleted created user to keep consistent:', assignErr.message);
        } catch (cleanupErr) {
          console.error('Cleanup failed after assigned_project error:', cleanupErr);
        }
        return res.status(500).json({ success: false, message: 'Failed to assign projects', error: assignErr.message });
      }
    } catch (error) {
      console.error('CreateUser error:', error);
      return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
    }
  });
};










exports.getAllusers = async (req, res) => {
  try {
    const query = `
      SELECT
        users.*,
        user_role.role AS user_role_name,
        GROUP_CONCAT(DISTINCT ap.assigned_project_id ORDER BY ap.assigned_project_id SEPARATOR ',') AS assigned_project_ids
      FROM users
      JOIN user_role ON users.role = user_role.role_id
      LEFT JOIN assigned_project ap ON ap.user_id = users.user_id AND ap.assigned_project_id IS NOT NULL
      WHERE users.is_delete = ?
      GROUP BY users.user_id
      ORDER BY users.name ASC
    `;
    const params = [0];
    const rows = await db.fetchQuery(query, params);

    // Convert assigned_project_ids CSV to array of numbers for each user
    const result = rows.map(r => ({
      ...r,
      assigned_project_ids: r.assigned_project_ids ? String(r.assigned_project_ids).split(',').map(v => Number(v)) : []
    }));

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Error in getAllusers:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};



exports.AllUserRole = async (req, res) => {
    try {
        const qurey = `SELECT * FROM user_role ORDER BY user_role.role ASC`
        const result = await db.fetchQuery(qurey, null);
        res.json({
            success: true,
            data: result
        })

    } catch (error) {
        console.log(error)
    }
}

exports.deleteUser = async (req, res) => {
    const { user_id } = req.query;
    if (!user_id) {
        res.json({
            success: false,
            message: 'user id is required'
        })
    }
    try {
        const qurey = `UPDATE users SET is_delete = ? WHERE user_id = ?`
        const params = [1, user_id]
        await db.insertQuery(qurey, params);
        res.json({
            success: true,
            message: 'User delete successfully'
        })
    } catch (error) {
        console.log(error)
    }
}