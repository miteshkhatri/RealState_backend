
const db = require('../utils/helpers');
const multer = require('multer');
const path = require('path');
const { encrypt, decrypt } = require('../config/cryptoHelper')


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







exports.AddReceiveAmount = async (req, res) => { 
  upload(req, res, async (err) => {
    const { 
      Customer_id, project_id, sector_id, plot_id, 
      amount, amountB, payment_type, amount_b_payment_type, 
      additional_comments, receive_date, receive_date_b,
      check_no, check_date, bank_name, kruti_font_booking, branch_name,
      towords, created_by,               // 🔥 NEW: amount in words (text)
    } = req.body;

    const ProjectImage = req.file ? req.file.filename : null;

    if (!Customer_id || !project_id || !sector_id || !plot_id) {
      return res.json({ success: false, message: 'Required fields missing' });
    }

    try {
      // Fetch existing booking amounts
      const checkQuery = `
        SELECT amount_a, welcome 
        FROM bookings 
        WHERE booking_id = ? AND project_id = ? AND sector_id = ? AND plot_id = ?
      `;
      const checkParams = [Customer_id, project_id, sector_id, plot_id];
      const [result] = await db.fetchQuery(checkQuery, checkParams);

      if (!result) {
        return res.json({ success: false, message: 'No booking found for the provided details' });
      }

      // Amounts from booking
      let availableAmountA = 0;
      let availableWelcome = 0;

      // Amount-A as number (no decrypt)
      availableAmountA = Number(result.amount_a) || 0;

      // Welcome with decrypt fallback
      try {
        availableWelcome = decrypt(result.welcome) ? Number(decrypt(result.welcome)) : Number(result.welcome);
      } catch {
        availableWelcome = Number(result.welcome) || 0;
      }

      // Amounts received in this request
      const sentAmountA = Number(amount) || 0;         // Amount-A as number
      const sentWelcome = Number(amountB) || 0;        // Welcome amount
      const sentPaymentType = parseInt(payment_type) || null;
      const sentAmountBPaymentType = parseInt(amount_b_payment_type) || null;
      const sentKrutiFontBooking = parseInt(kruti_font_booking) || 0;
      const sentBranchName = branch_name && String(branch_name).trim() !== '' 
        ? String(branch_name).trim() 
        : null;

      // ---------------- Amount-A overpayment check ----------------
      const sumQuery = `
        SELECT COALESCE(SUM(amount),0) AS total_received_amount
        FROM receive_amount
        WHERE plot_id = ? AND is_delete = 0
      `;
      const [sumRes] = await db.fetchQuery(sumQuery, [plot_id]);
      const existingTotalReceived = sumRes ? Number(sumRes.total_received_amount) || 0 : 0;

      if (existingTotalReceived + sentAmountA > availableAmountA) {
        return res.json({
          success: false,
          message: `Overpayment not allowed. Total allowed: ${availableAmountA}, already received: ${existingTotalReceived}, trying to add: ${sentAmountA}`
        });
      }

      // ---------------- Welcome overpayment check ----------------
      const sumWelcomeQuery = `
        SELECT welcome FROM receive_amount
        WHERE plot_id = ? AND is_delete = 0
      `;
      const welcomeRows = await db.fetchQuery(sumWelcomeQuery, [plot_id]);
      let existingTotalWelcome = 0;
      if (welcomeRows.length > 0) {
        for (const row of welcomeRows) {
          try { existingTotalWelcome += Number(decrypt(row.welcome)); } 
          catch { existingTotalWelcome += Number(row.welcome) || 0; }
        }
      }

      if (existingTotalWelcome + sentWelcome > availableWelcome) {
        return res.json({
          success: false,
          message: `Overpayment not allowed for Welcome Amount. Total allowed: ${availableWelcome}, already received: ${existingTotalWelcome}, trying to add: ${sentWelcome}`
        });
      }

      // ---------------- Dates ----------------
      const finalReceiveDate = sentAmountA > 0 ? (receive_date || null) : null;
      const finalReceiveDateB = sentWelcome > 0 ? (receive_date_b || null) : null;

      // ---------------- Insert into receive_amount ----------------
      // const query = `
      //   INSERT INTO receive_amount(
      //     customer_id, project_id, sector_id, plot_id,
      //     amount_b_payment_type, kruti_font_booking, amount, towords, welcome,
      //     payment_type, receive_date, receive_date_b,
      //     additional_comments, image, check_no, check_date, bank_name, branch_name
      //   ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      // `;

      const query = `
  INSERT INTO receive_amount(
    customer_id, project_id, sector_id, plot_id,
    amount_b_payment_type, kruti_font_booking, amount, towords, welcome,
    payment_type, receive_date, receive_date_b,
    additional_comments, image, check_no, check_date, bank_name, branch_name,
    created_by, created_at
  ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,NOW())
`;

      const params = [
        parseInt(Customer_id),
        parseInt(project_id),
        parseInt(sector_id),
        parseInt(plot_id),
        sentAmountBPaymentType,
        sentKrutiFontBooking,
        sentAmountA,                 // number
        towords || null,             // 🔥 NEW: amount in words as-is
        encrypt(sentWelcome),        // encrypted welcome
        sentPaymentType,
        finalReceiveDate,
        finalReceiveDateB,
        additional_comments || '',
        ProjectImage || '',
        check_no || null,
        check_date || null,
        bank_name || null,
        sentBranchName,

          created_by || null

      ];

      await db.insertQuery(query, params);

      res.json({ success: true, message: 'Receive amount added successfully' });

    } catch (error) {
      console.error('DEBUG: API Error:', error);
      res.json({ success: false, message: 'Receive amount add Error', error: String(error) });
    }
  });
};





  

exports.UpdateReceiveAmount = async (req, res) => {
  upload(req, res, async (err) => {
    const { 
      receive_amountId, Customer_id, project_id, sector_id, plot_id, 
      amount, amountB, payment_type, amount_b_payment_type, additional_comments,
      check_no, check_date, bank_name, kruti_font_booking, branch_name,
      receive_date, receive_date_b,
      towords,updated_by              // 🔥 NEW: amount in words (text)
    } = req.body;

    const finalReceiveDate = receive_date && String(receive_date).trim() !== '' ? String(receive_date).trim() : null;
    const finalReceiveDateB = receive_date_b && String(receive_date_b).trim() !== '' ? String(receive_date_b).trim() : null;

    const ProjectImage = req.file ? req.file.filename : null;
    const sentBranchName = branch_name && String(branch_name).trim() !== '' ? String(branch_name).trim() : null;

    if (!receive_amountId) return res.json({ success:false, message:'receive amount id required' });
    if (!Customer_id) return res.json({ success:false, message:'Customer id required' });
    if (!project_id) return res.json({ success:false, message:'Project id required' });
    if (!sector_id) return res.json({ success:false, message:'Sector id required' });
    if (!plot_id) return res.json({ success:false, message:'Plot id required' });

    try {
      // Check existing row
      const [oldRow] = await db.fetchQuery(
        `SELECT welcome FROM receive_amount WHERE id = ? LIMIT 1`,
        [receive_amountId]
      );

      const welcomeIsNull = (oldRow?.welcome == null);

      // build update query dynamically
      let query = `
        UPDATE receive_amount SET 
        customer_id = ?, project_id = ?, sector_id = ?, plot_id = ?, 
        amount_b_payment_type = ?, kruti_font_booking = ?, amount = ?, towords = ?, 
        payment_type = ?, additional_comments = ?, check_no = ?, 
        check_date = ?, bank_name = ?, branch_name = ?, receive_date = ?, receive_date_b = ?, updated_by = ?, updated_at = NOW()
      `;

      const params = [
        parseInt(Customer_id),
        parseInt(project_id),
        parseInt(sector_id),
        parseInt(plot_id),
        parseInt(amount_b_payment_type) || null,
        parseInt(kruti_font_booking) || 0,
        parseFloat(amount) || 0,       // Amount-A as number
        towords || null,               // 🔥 NEW: towords update
        parseInt(payment_type) || null,
        additional_comments || '',
        check_no || null,
        check_date || null,
        bank_name || null,
        sentBranchName,
        finalReceiveDate,
        finalReceiveDateB,
          updated_by || null
      ];

      // Add welcome only if welcome exists (NOT NULL)
      if (!welcomeIsNull) {
        query += `, welcome = ? `;
        params.push(encrypt(Number(amountB) || 0)); // Welcome encrypted
      }

      // Add image if exists
      if (ProjectImage) {
        query += `, image = ? `;
        params.push(ProjectImage);
      }

      // WHERE
      query += ` WHERE id = ? LIMIT 1 `;
      params.push(receive_amountId);

      await db.insertQuery(query, params);

      return res.json({
        success: true,
        message: "Receive Amount Updated Successfully"
      });

    } catch (e) {
      console.log("Update Error:", e);
      return res.json({
        success: false,
        message: "Server Error",
        error: e.toString()
      });
    }
  });
};



// exports.AddReceiveAmount = async (req, res) => {
//   upload(req, res, async (err) => {
//     const { 
//       Customer_id, project_id, sector_id, plot_id, 
//       amount, amountB, payment_type, amount_b_payment_type, 
//       additional_comments, receive_date, receive_date_b,
//       check_no, check_date, bank_name, kruti_font_booking, branch_name
//     } = req.body;

//     const ProjectImage = req.file ? req.file.filename : null;

//     if (!Customer_id || !project_id || !sector_id || !plot_id) {
//       return res.json({ success: false, message: 'Required fields missing' });
//     }

//     try {
//       // Fetch existing booking amounts
//       const checkQuery = `
//         SELECT amount_a, welcome 
//         FROM bookings 
//         WHERE booking_id = ? AND project_id = ? AND sector_id = ? AND plot_id = ?
//       `;
//       const checkParams = [Customer_id, project_id, sector_id, plot_id];
//       const [result] = await db.fetchQuery(checkQuery, checkParams);

//       if (!result) {
//         return res.json({ success: false, message: 'No booking found for the provided details' });
//       }

//       // Amounts from booking
//       let availableAmountA = 0;
//       let availableWelcome = 0;

//       // Amount-A as number (no decrypt)
//       availableAmountA = Number(result.amount_a) || 0;

//       // Welcome with decrypt fallback
//       try {
//         availableWelcome = decrypt(result.welcome) ? Number(decrypt(result.welcome)) : Number(result.welcome);
//       } catch {
//         availableWelcome = Number(result.welcome) || 0;
//       }

//       // Amounts received in this request
//       const sentAmountA = Number(amount) || 0;         // 🔥 Amount-A as number
//       const sentWelcome = Number(amountB) || 0;       // 🔥 Welcome amount
//       const sentPaymentType = parseInt(payment_type) || null;
//       const sentAmountBPaymentType = parseInt(amount_b_payment_type) || null;
//       const sentKrutiFontBooking = parseInt(kruti_font_booking) || 0;
//       const sentBranchName = branch_name && String(branch_name).trim() !== '' 
//         ? String(branch_name).trim() 
//         : null;

//       // ---------------- Amount-A overpayment check ----------------
//       const sumQuery = `
//         SELECT COALESCE(SUM(amount),0) AS total_received_amount
//         FROM receive_amount
//         WHERE plot_id = ? AND is_delete = 0
//       `;
//       const [sumRes] = await db.fetchQuery(sumQuery, [plot_id]);
//       const existingTotalReceived = sumRes ? Number(sumRes.total_received_amount) || 0 : 0;

//       if (existingTotalReceived + sentAmountA > availableAmountA) {
//         return res.json({
//           success: false,
//           message: `Overpayment not allowed. Total allowed: ${availableAmountA}, already received: ${existingTotalReceived}, trying to add: ${sentAmountA}`
//         });
//       }

//       // ---------------- Welcome overpayment check ----------------
//       const sumWelcomeQuery = `
//         SELECT welcome FROM receive_amount
//         WHERE plot_id = ? AND is_delete = 0
//       `;
//       const welcomeRows = await db.fetchQuery(sumWelcomeQuery, [plot_id]);
//       let existingTotalWelcome = 0;
//       if (welcomeRows.length > 0) {
//         for (const row of welcomeRows) {
//           try { existingTotalWelcome += Number(decrypt(row.welcome)); } 
//           catch { existingTotalWelcome += Number(row.welcome) || 0; }
//         }
//       }

//       if (existingTotalWelcome + sentWelcome > availableWelcome) {
//         return res.json({
//           success: false,
//           message: `Overpayment not allowed for Welcome Amount. Total allowed: ${availableWelcome}, already received: ${existingTotalWelcome}, trying to add: ${sentWelcome}`
//         });
//       }

//       // ---------------- Dates ----------------
//       const finalReceiveDate = sentAmountA > 0 ? (receive_date || null) : null;
//       const finalReceiveDateB = sentWelcome > 0 ? (receive_date_b || null) : null;

//       // ---------------- Insert into receive_amount ----------------
//       const query = `
//         INSERT INTO receive_amount(
//           customer_id, project_id, sector_id, plot_id,
//           amount_b_payment_type, kruti_font_booking, amount, welcome,
//           payment_type, receive_date, receive_date_b,
//           additional_comments, image, check_no, check_date, bank_name, branch_name
//         ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
//       `;

//       const params = [
//         parseInt(Customer_id),
//         parseInt(project_id),
//         parseInt(sector_id),
//         parseInt(plot_id),
//         sentAmountBPaymentType,
//         sentKrutiFontBooking,
//         sentAmountA,           // 🔥 store as number
//         encrypt(sentWelcome),  // 🔥 store encrypted
//         sentPaymentType,
//         finalReceiveDate,
//         finalReceiveDateB,
//         additional_comments || '',
//         ProjectImage || '',
//         check_no || null,
//         check_date || null,
//         bank_name || null,
//         sentBranchName
//       ];

//       await db.insertQuery(query, params);

//       res.json({ success: true, message: 'Receive amount added successfully' });

//     } catch (error) {
//       console.error('DEBUG: API Error:', error);
//       res.json({ success: false, message: 'Receive amount add Error', error: String(error) });
//     }
//   });
// };

// exports.UpdateReceiveAmount = async (req, res) => {
//   upload(req, res, async (err) => {
//     const { 
//       receive_amountId, Customer_id, project_id, sector_id, plot_id, 
//       amount, amountB, payment_type, amount_b_payment_type, additional_comments,
//       check_no, check_date, bank_name, kruti_font_booking, branch_name,
//       receive_date, receive_date_b
//     } = req.body;

//     const finalReceiveDate = receive_date && String(receive_date).trim() !== '' ? String(receive_date).trim() : null;
//     const finalReceiveDateB = receive_date_b && String(receive_date_b).trim() !== '' ? String(receive_date_b).trim() : null;

//     const ProjectImage = req.file ? req.file.filename : null;
//     const sentBranchName = branch_name && String(branch_name).trim() !== '' ? String(branch_name).trim() : null;

//     if (!receive_amountId) return res.json({ success:false, message:'receive amount id required' });
//     if (!Customer_id) return res.json({ success:false, message:'Customer id required' });
//     if (!project_id) return res.json({ success:false, message:'Project id required' });
//     if (!sector_id) return res.json({ success:false, message:'Sector id required' });
//     if (!plot_id) return res.json({ success:false, message:'Plot id required' });

//     try {
//       // Check existing row
//       const [oldRow] = await db.fetchQuery(
//         `SELECT welcome FROM receive_amount WHERE id = ? LIMIT 1`,
//         [receive_amountId]
//       );

//       const welcomeIsNull = (oldRow?.welcome == null);

//       // build update query dynamically
//       let query = `
//         UPDATE receive_amount SET 
//         customer_id = ?, project_id = ?, sector_id = ?, plot_id = ?, 
//         amount_b_payment_type = ?, kruti_font_booking = ?, amount = ?, 
//         payment_type = ?, additional_comments = ?, check_no = ?, 
//         check_date = ?, bank_name = ?, branch_name = ?, receive_date = ?, receive_date_b = ?
//       `;

//       const params = [
//         parseInt(Customer_id),
//         parseInt(project_id),
//         parseInt(sector_id),
//         parseInt(plot_id),
//         parseInt(amount_b_payment_type) || null,
//         parseInt(kruti_font_booking) || 0,
//         parseFloat(amount) || 0,       // 🔥 Amount-A as number
//         parseInt(payment_type) || null,
//         additional_comments || '',
//         check_no || null,
//         check_date || null,
//         bank_name || null,
//         sentBranchName,
//         finalReceiveDate,
//         finalReceiveDateB
//       ];

//       // Add welcome only if welcome exists (NOT NULL)
//       if (!welcomeIsNull) {
//         query += `, welcome = ? `;
//         params.push(encrypt(Number(amountB) || 0)); // 🔥 Welcome encrypted
//       }

//       // Add image if exists
//       if (ProjectImage) {
//         query += `, image = ? `;
//         params.push(ProjectImage);
//       }

//       // WHERE
//       query += ` WHERE id = ? LIMIT 1 `;
//       params.push(receive_amountId);

//       await db.insertQuery(query, params);

//       return res.json({
//         success: true,
//         message: "Receive Amount Updated Successfully"
//       });

//     } catch (e) {
//       console.log("Update Error:", e);
//       return res.json({
//         success: false,
//         message: "Server Error",
//         error: e.toString()
//       });
//     }
//   });
// };

exports.getAllReceiveAmount = async (req, res) => {
  try {
    const { Customer_id, plot_id } = req.query;

    const rawUserId = req.query.user_id;
    const userId = rawUserId && /^\d+$/.test(String(rawUserId)) ? Number(rawUserId) : null;

    let userHasPermissions = false;
    if (userId) {
      const checkQuery = `SELECT 1 FROM assigned_project WHERE user_id = ? LIMIT 1`;
      const checkResult = await db.fetchQuery(checkQuery, [userId]);
      userHasPermissions = Array.isArray(checkResult) && checkResult.length > 0;
    }

    const apJoin = userHasPermissions
      ? `INNER JOIN assigned_project ap ON ap.assigned_project_id = receive_amount.project_id AND ap.user_id = ?`
      : `LEFT JOIN assigned_project ap ON ap.assigned_project_id = receive_amount.project_id`;

    const isAssignedCase = userHasPermissions ? 'ap.user_id IS NOT NULL' : '0=1';

    let query = `
      SELECT 
        receive_amount.*,
        receive_amount.id AS receive_id,
        receive_amount.welcome AS amount_b,
        bookings.customer_name AS customer_name,
        bookings.krutiDev_font AS krutiDev_font,
        bookings.amount_a AS amount_a,
        bookings.welcome AS booking_amount_b,
        bookings.mobile_no AS mobile_no,
        bookings.adhar_number AS adhar_number,
        bookings.pan_number AS pan_number,
        projects.name AS project_name,
        projects.krutiDev_font AS project_font,
        plots.plot_no,
        sector.sector_name,
        payment_type_a.payment_mode AS amount_a_type,
        payment_type_a.id AS amount_a_type_id,
        payment_type_b.payment_mode AS amount_b_type,
        payment_type_b.id AS amount_b_type_id,
        rdl.id AS download_id,
        rdl.is_downloaded,
        rdl.downloaded_at,
        CASE WHEN ${isAssignedCase} THEN 1 ELSE 0 END AS is_assigned
      FROM receive_amount
      LEFT JOIN bookings 
        ON receive_amount.customer_id = bookings.booking_id
      LEFT JOIN projects 
        ON receive_amount.project_id = projects.project_id
      LEFT JOIN plots 
        ON receive_amount.plot_id = plots.plot_id
      LEFT JOIN sector 
        ON receive_amount.sector_id = sector.sector_id
      LEFT JOIN payment_type AS payment_type_a 
        ON receive_amount.payment_type = payment_type_a.id
      LEFT JOIN payment_type AS payment_type_b 
        ON receive_amount.amount_b_payment_type = payment_type_b.id
      LEFT JOIN receipt_download_log AS rdl 
        ON rdl.receive_id = receive_amount.id
      ${apJoin}
      WHERE
    `;

    const whereClauses = [];
    const params = [];

    if (userHasPermissions) params.push(userId);

    whereClauses.push('receive_amount.is_delete = ?');
    params.push(0);

    if (Customer_id && /^\d+$/.test(String(Customer_id))) {
      whereClauses.push('receive_amount.customer_id = ?');
      params.push(Number(Customer_id));
    }

    if (plot_id && /^\d+$/.test(String(plot_id))) {
      whereClauses.push('receive_amount.plot_id = ?');
      params.push(Number(plot_id));
    }

    query += ' ' + whereClauses.join(' AND ');

    const result = await db.fetchQuery(query, params);

    const dedupeByReceiveId = (rows = []) => {
      const seen = new Set();
      const unique = [];
      for (const r of rows) {
        const id = r && (r.receive_id ?? r.id);
        if (id == null) continue;
        if (!seen.has(id)) {
          seen.add(id);
          unique.push(r);
        }
      }
      return unique;
    };

    const deduped = dedupeByReceiveId(result || []);

    const finalData = await Promise.all(
      deduped.map(async item => {
        const out = { ...item };

        try { if (out.amount_b) out.amount_b = decrypt(out.amount_b); } catch {}
        try { if (out.booking_amount_b) out.booking_amount_b = decrypt(out.booking_amount_b); } catch {}

        out.is_assigned = Number(out.is_assigned) === 1;

        // 🔥 Fetch all customers under same project + plot
        const customersQuery = `
          SELECT DISTINCT customer_name, pan_number
          FROM bookings
          WHERE project_id = ? AND plot_id = ? AND is_delete = 0
        `;
        const customers = await db.fetchQuery(customersQuery, [
          out.project_id,
          out.plot_id
        ]);

        // 🔥 required return format
        out.customer_list = customers.map(c => ({
          customer_name: c.customer_name,
          pan_number: c.pan_number
        }));

        return out;
      })
    );

    return res.json({ success: true, data: finalData });
  } catch (error) {
    console.error("❌ Error in getAllReceiveAmount:", error);
    return res.status(500).json({ success: false, message: "Server Error", error: error.message });
  }
};





exports.deleteReceiveAmount = async (req, res) => {
    const { receive_amountId, deleted_by } = req.query;

    if (!receive_amountId) {
        return res.json({
            success: false,
            message: 'Receive amount ID is required',
        });
    }

    try {

        const query = `
            UPDATE receive_amount 
            SET 
                is_delete = 1,
                deleted_by = ?,
                deleted_at = NOW()
            WHERE id = ?
        `;

        const params = [
            deleted_by || null,   // ✅ frontend se aayega
            receive_amountId
        ];

        await db.insertQuery(query, params);

        res.json({
            success: true,
            message: 'Receive amount deleted successfully',
        });

    } catch (error) {
        console.error('Error in deleteReceiveAmount:', error);

        res.json({
            success: false,
            message: 'An error occurred while deleting receive amount',
        });
    }
};




exports.RemainingAmount = async (req, res) => {
  const { plot_id, user_id, password_b } = req.query;

  if (!plot_id) {
    return res.json({
      success: false,
      status: false,
      data: [],
      message: "Plot id required",
    });
  }

  try {
    let showAmountB = false;
    let wrongPassword = false;

    // ===== Password Check =====
    if (user_id && password_b) {
      const user = await db.fetchQuery(
        `SELECT user_id FROM users WHERE user_id = ? AND password_b = MD5(?) LIMIT 1`,
        [user_id, password_b]
      );
      if (user?.length > 0) showAmountB = true;
      else wrongPassword = true;
    }

    // ===== Query =====
    const rows = await db.fetchQuery(
      `
      SELECT 
        b.booking_id,
        b.customer_name,
        b.amount_a AS booking_amount_a,
        b.welcome AS booking_amount_b,
        IFNULL(SUM(r.amount),0) AS received_amount_a,
        GROUP_CONCAT(CASE WHEN r.amount<>0 THEN r.amount END ORDER BY r.receive_date ASC) AS all_received_amount_a,
        GROUP_CONCAT(CASE WHEN r.welcome<>'' AND r.welcome IS NOT NULL THEN r.welcome END ORDER BY r.receive_date ASC) AS all_received_amount_b
      FROM bookings b
      LEFT JOIN receive_amount r ON (b.booking_id = r.customer_id AND COALESCE(r.is_delete,0) = 0)
      WHERE b.plot_id = ?
      GROUP BY b.booking_id
      `,
      [plot_id]
    );

    if (!rows?.length) {
      return res.json({
        success: true,
        status: showAmountB,
        data: [],
        message: wrongPassword ? "Invalid password" : "",
      });
    }

    const toNum = (v) => (v ? Number(String(v)) || 0 : 0);

    const parsedRows = rows.map((r) => {
      const parsed = {
        booking_id: r.booking_id,
        customer_name: r.customer_name,
        booking_amount_a: toNum(r.booking_amount_a),
        all_received_amount_a: r.all_received_amount_a
          ? r.all_received_amount_a.split(",").map(toNum)
          : [],
      };

      if (showAmountB) {
        parsed.booking_amount_b = r.booking_amount_b ? toNum(decrypt(r.booking_amount_b)) : 0;

        // 🔥 Fix: Only non-zero decrypted values
        parsed.all_received_amount_b = r.all_received_amount_b
          ? r.all_received_amount_b
              .split(",")
              .map((x) => toNum(decrypt(x)))
              .filter((v) => v !== 0)
          : [];
      }

      return parsed;
    });

    const combined = {
      booking_ids: parsedRows.map((r) => r.booking_id),
      customer_names: parsedRows.map((r) => r.customer_name),
    };

    // ===== A Calculation =====
    combined.booking_amount_a = parsedRows[0].booking_amount_a;
    combined.all_received_amount_a = parsedRows.flatMap((r) => r.all_received_amount_a);
    combined.total_all_received_amount_a = combined.all_received_amount_a.reduce((a, b) => a + b, 0);
    combined.received_amount_a = combined.total_all_received_amount_a;
    combined.remaining_amount_a = Math.max(combined.booking_amount_a - combined.received_amount_a, 0);
    combined.extra_paid_a = Math.max(combined.received_amount_a - combined.booking_amount_a, 0);

    // ===== B Calculation =====
    if (showAmountB) {
      combined.booking_amount_b = parsedRows[0].booking_amount_b;
      combined.all_received_amount_b = parsedRows.flatMap((r) => r.all_received_amount_b ?? []);
      combined.total_all_received_amount_b = combined.all_received_amount_b.reduce((a, b) => a + b, 0);
      combined.received_amount_b = combined.total_all_received_amount_b;
      combined.remaining_amount_b = Math.max(combined.booking_amount_b - combined.received_amount_b, 0);
      combined.extra_paid_b = Math.max(combined.received_amount_b - combined.booking_amount_b, 0);

      // TOTAL
      combined.total_booking_amount = combined.booking_amount_a + combined.booking_amount_b;
      combined.total_received_amount = combined.received_amount_a + combined.received_amount_b;
      combined.total_remaining_amount = Math.max(combined.total_booking_amount - combined.total_received_amount, 0);
      combined.total_extra_paid = Math.max(combined.total_received_amount - combined.total_booking_amount, 0);
    } else {
      combined.total_booking_amount = combined.booking_amount_a;
      combined.total_received_amount = combined.received_amount_a;
      combined.total_remaining_amount = combined.remaining_amount_a;
      combined.total_extra_paid = combined.extra_paid_a;
    }

    return res.json({
      success: true,
      status: showAmountB,
      data: [combined],
      message: wrongPassword ? "Invalid password" : "",
    });
  } catch (err) {
    console.error(err);
    return res.json({
      success: false,
      status: false,
      data: [],
      message: "Error fetching remaining amount",
      error: String(err),
    });
  }
};












exports.CustomerBaseRecord = async (req, res) => {
  try {
    const { Customer_id, project_id } = req.query;

    const rawUserId = req.query.user_id;
    const userId = rawUserId && /^\d+$/.test(String(rawUserId)) ? Number(rawUserId) : null;

    let userHasPermissions = false;
    if (userId) {
      const checkQuery = `SELECT 1 FROM assigned_project WHERE user_id = ? LIMIT 1`;
      const checkResult = await db.fetchQuery(checkQuery, [userId]);
      userHasPermissions = Array.isArray(checkResult) && checkResult.length > 0;
    }

    const apJoin = userHasPermissions
      ? `INNER JOIN assigned_project ap ON ap.assigned_project_id = receive_amount.project_id AND ap.user_id = ?`
      : `LEFT JOIN assigned_project ap ON ap.assigned_project_id = receive_amount.project_id`;

    const isAssignedCase = userHasPermissions ? 'ap.user_id IS NOT NULL' : '0=1';

    // 1. SQL Query (Note: GROUP BY removed here to process all receipts for total calculation, 
    // we deduplicate in JS to match allbookings logic)
    let query = `
      SELECT 
        receive_amount.*,
        receive_amount.id AS receive_id,
        receive_amount.welcome AS amount_b,
        bookings.customer_name AS customer_name,
        bookings.pan_number AS pan_number,
        bookings.customer_father_name,
        bookings.mobile_no,
        bookings.adhar_number,
        bookings.customer_address,
        bookings.amount_a,
        bookings.welcome AS booking_amount_b,  
        bookings.krutiDev_font,
        projects.name AS project_name,
        projects.krutiDev_font AS project_font,
        plots.plot_no,
        plots.plot_id AS _plot_id,
        sector.sector_name,
        payment_type_a.payment_mode AS amount_a_type,
        payment_type_b.payment_mode AS amount_b_type,
        rdl.id AS download_id,
        rdl.is_downloaded,
        rdl.downloaded_at,
        CASE WHEN ${isAssignedCase} THEN 1 ELSE 0 END AS is_assigned
      FROM receive_amount
      LEFT JOIN bookings ON receive_amount.customer_id = bookings.booking_id
      LEFT JOIN projects ON receive_amount.project_id = projects.project_id
      LEFT JOIN plots ON receive_amount.plot_id = plots.plot_id
      LEFT JOIN sector ON receive_amount.sector_id = sector.sector_id
      LEFT JOIN payment_type AS payment_type_a ON bookings.payment_mode = payment_type_a.id
      LEFT JOIN payment_type AS payment_type_b ON receive_amount.amount_b_payment_type = payment_type_b.id
      LEFT JOIN receipt_download_log AS rdl ON rdl.receive_id = receive_amount.id
      ${apJoin}
      WHERE receive_amount.is_delete = ?
    `;

    const params = [];
    if (userHasPermissions) params.push(userId);
    params.push(0);

    if (Customer_id) { query += ` AND receive_amount.customer_id = ?`; params.push(Customer_id); }
    if (project_id) { query += ` AND receive_amount.project_id = ?`; params.push(project_id); }

    const result = await db.fetchQuery(query, params);

    // 2. Plot Map for Grand Totals (Exactly like allbookings)
    const plotMap = new Map();

    const finalData = await Promise.all(
      result.map(async (item) => {
        try { if (item.amount_b) item.amount_b = decrypt(item.amount_b); } catch {}
        try { if (item.booking_amount_b) item.booking_amount_b = decrypt(item.booking_amount_b); } catch {}

        // Har plot ka total received amount nikaalna
        const receivedQuery = `SELECT SUM(amount) AS total_received FROM receive_amount WHERE plot_id = ? AND is_delete = 0`;
        const receivedRes = await db.fetchQuery(receivedQuery, [item.plot_id]);
        const totalReceived = Number(receivedRes[0]?.total_received || 0);
        const amountA = Number(item.amount_a || 0);

        // Deduplication for Grand Totals calculation
        if (item.plot_id) {
          plotMap.set(item.plot_id, {
            total_amount: amountA,
            received_amount: totalReceived,
          });
        }

        const customerQuery = `SELECT customer_name, pan_number FROM bookings WHERE project_id = ? AND plot_id = ? AND is_delete = 0`;
        const customerList = await db.fetchQuery(customerQuery, [item.project_id, item.plot_id]);

        return {
          ...item,
          is_assigned: Number(item.is_assigned) === 1,
          received_amount: totalReceived,
          pending_amount: Math.max(amountA - totalReceived, 0),
          customer_list: customerList.map(c => ({
            customer_name: c.customer_name,
            pan_number: c.pan_number
          }))
        };
      })
    );

    // 3. Calculation exactly like allbookings logic
    let grand_total = 0;
    let grand_received = 0;

    for (const val of plotMap.values()) {
      grand_total += val.total_amount;
      grand_received += val.received_amount;
    }

    res.json({
      success: true,
      grand_total_amount: grand_total,
      grand_received_amount: grand_received,
      grand_pending_amount: grand_total - grand_received,
      data: finalData
    });

  } catch (error) {
    console.error("❌ Error in CustomerBaseRecord:", error);
    res.status(500).json({ success: false, message: "Server Error", error: error.message });
  }
};




// exports.CustomerBaseRecord = async (req, res) => {
//   try {
//     const { Customer_id, project_id } = req.query;

//     const rawUserId = req.query.user_id;
//     const userId = rawUserId && /^\d+$/.test(String(rawUserId)) ? Number(rawUserId) : null;

//     let userHasPermissions = false;
//     if (userId) {
//       const checkQuery = `SELECT 1 FROM assigned_project WHERE user_id = ? LIMIT 1`;
//       const checkResult = await db.fetchQuery(checkQuery, [userId]);
//       userHasPermissions = Array.isArray(checkResult) && checkResult.length > 0;
//     }

//     const apJoin = userHasPermissions
//       ? `INNER JOIN assigned_project ap ON ap.assigned_project_id = receive_amount.project_id AND ap.user_id = ?`
//       : `LEFT JOIN assigned_project ap ON ap.assigned_project_id = receive_amount.project_id`;

//     const isAssignedCase = userHasPermissions ? 'ap.user_id IS NOT NULL' : '0=1';

//     let query = `
//       SELECT 
//         receive_amount.*,
//         receive_amount.id AS receive_id,
//         receive_amount.welcome AS amount_b,
//         bookings.customer_name AS customer_name,
//         bookings.pan_number AS pan_number,
//         bookings.customer_father_name,
//         bookings.mobile_no,
//         bookings.adhar_number,
//         bookings.customer_address,
//         bookings.amount_a,
//         bookings.welcome AS booking_amount_b,  
//         bookings.krutiDev_font,
//         projects.name AS project_name,
//         projects.krutiDev_font AS project_font,
//         plots.plot_no,
//         sector.sector_name,
//         payment_type_a.payment_mode AS amount_a_type,
//         payment_type_b.payment_mode AS amount_b_type,
//         rdl.id AS download_id,
//         rdl.is_downloaded,
//         rdl.downloaded_at,
//         CASE WHEN ${isAssignedCase} THEN 1 ELSE 0 END AS is_assigned
//       FROM receive_amount
//       LEFT JOIN bookings ON receive_amount.customer_id = bookings.booking_id
//       LEFT JOIN projects ON receive_amount.project_id = projects.project_id
//       LEFT JOIN plots ON receive_amount.plot_id = plots.plot_id
//       LEFT JOIN sector ON receive_amount.sector_id = sector.sector_id
//       LEFT JOIN payment_type AS payment_type_a ON bookings.payment_mode = payment_type_a.id
//       LEFT JOIN payment_type AS payment_type_b ON receive_amount.amount_b_payment_type = payment_type_b.id
//       LEFT JOIN receipt_download_log AS rdl ON rdl.receive_id = receive_amount.id
//       ${apJoin}
//       WHERE receive_amount.is_delete = ?
//     `;

//     const params = [];
//     if (userHasPermissions) params.push(userId);
//     params.push(0);

//     if (Customer_id) {
//       query += ` AND receive_amount.customer_id = ?`;
//       params.push(Customer_id);
//     }

//     if (project_id) {
//       query += ` AND receive_amount.project_id = ?`;
//       params.push(project_id);
//     }

//     query += ` GROUP BY bookings.customer_name`;

//     const result = await db.fetchQuery(query, params);

//     const finalData = await Promise.all(
//       result.map(async (item) => {
//         try { if (item.amount_b) item.amount_b = decrypt(item.amount_b); } catch {}
//         try { if (item.booking_amount_b) item.booking_amount_b = decrypt(item.booking_amount_b); } catch {}

//         // 🔥 New query — fetch ALL customers for same plot_id & project_id
//         const customerQuery = `
//           SELECT customer_name, pan_number
//           FROM bookings
//           WHERE project_id = ? AND plot_id = ? AND is_delete = 0
//         `;
//         const customerList = await db.fetchQuery(customerQuery, [
//           item.project_id,
//           item.plot_id
//         ]);

//         return {
//           ...item,
//           is_assigned: Number(item.is_assigned) === 1,
//           // 🟢 New array inside main object
//           customer_list: customerList.map(c => ({
//             customer_name: c.customer_name,
//             pan_number: c.pan_number
//           }))
//         };
//       })
//     );

//     res.json({
//       success: true,
//       data: finalData
//     });
//   } catch (error) {
//     console.error("❌ Error in CustomerBaseRecord:", error);
//     res.status(500).json({ success: false, message: "Server Error", error: error.message });
//   }
// };


exports.handleReceiptDownload = async (req, res) => {
    upload(req, res, async (err) => {
        const {
            user_id,
            user_name,
            customer_name,
            booking_id,
            project_id,
            plot_id,
            receive_id,
            receipt_no,
            role_id
        } = req.body;

        if (!user_id || !role_id) {
            return res.json({ success: false, message: 'Required fields missing' });
        }

        try {
            const finalReceiveId = receive_id && receive_id !== 'null' && receive_id !== '' ? receive_id : null;
            const finalBookingId = booking_id && booking_id !== 'null' && booking_id !== '' ? booking_id : null;

            // 🔍 Check condition only for role_id = 4
            if (parseInt(role_id) === 4) {
                let checkQuery, checkParams;

                if (finalReceiveId) {
                    // ✅ Priority to receive_id
                    checkQuery = `
                        SELECT id FROM receipt_download_log
                        WHERE receive_id = ?
                    `;
                    checkParams = [finalReceiveId];
                } else if (finalBookingId) {
                    // 🧾 Fallback to booking_id if receive_id not present
                    checkQuery = `
                        SELECT id FROM receipt_download_log
                        WHERE booking_id = ?
                    `;
                    checkParams = [finalBookingId];
                }

                if (checkQuery) {
                    const [existing] = await db.fetchQuery(checkQuery, checkParams);

                    if (existing) {
                        return res.json({
                            success: false,
                            message: 'यह रसीद पहले ही डाउनलोड की जा चुकी है (role_id = 4).'
                        });
                    }
                }
            }

            // ✅ Allow download (insert record with is_downloaded = 1)
            const insertQuery = `
                INSERT INTO receipt_download_log
                (user_id, user_name, customer_name, booking_id, project_id, plot_id, receive_id, receipt_no, role_id, is_downloaded)
                VALUES (?,?,?,?,?,?,?,?,?,?)
            `;

            const params = [
                user_id,
                user_name,
                customer_name || '',
                finalBookingId,
                project_id || null,
                plot_id || null,
                finalReceiveId,
                receipt_no || '',
                role_id,
                1 // ✅ set is_downloaded = 1 when downloaded
            ];

            await db.insertQuery(insertQuery, params);

            res.json({
                success: true,
                message: 'Receipt download allowed and logged successfully.'
            });

        } catch (error) {
            console.error('DEBUG: handleReceiptDownload Error:', error);
            res.json({
                success: false,
                message: 'Error processing receipt download request',
                error
            });
        }
    });
};


exports.checkReceiptDownload = async (req, res) => {
  try {
    // GET method → values come from req.query
    const { role_id, receive_id, booking_id } = req.query;

    if (!role_id) {
      return res.status(400).json({
        success: false,
        allowed: false,
        message: "role_id required"
      });
    }

    const finalReceiveId =
      receive_id && receive_id !== "null" && receive_id !== "" ? receive_id : null;

    const finalBookingId =
      booking_id && booking_id !== "null" && booking_id !== "" ? booking_id : null;

    // Only block for role_id = 4
    if (parseInt(role_id) === 4) {
      let checkQuery = null;
      let params = [];

      if (finalReceiveId) {
        checkQuery = `SELECT id FROM receipt_download_log WHERE receive_id = ? LIMIT 1`;
        params = [finalReceiveId];
      } else if (finalBookingId) {
        checkQuery = `SELECT id FROM receipt_download_log WHERE booking_id = ? LIMIT 1`;
        params = [finalBookingId];
      }

      if (checkQuery) {
        const [existing] = await db.fetchQuery(checkQuery, params);

        if (existing) {
          return res.json({
            success: false,
            allowed: false,
            message: "यह रसीद पहले ही डाउनलोड की जा चुकी है"
          });
        }
      }
    }

    // For all other roles → allowed
    return res.json({
      success: true,
      allowed: true,
      message: "Allowed to download"
    });

  } catch (err) {
    console.error("checkReceiptDownload Error:", err);
    return res.status(500).json({
      success: false,
      allowed: false,
      message: "Server error"
    });
  }
};
