const db = require('../utils/helpers');
const path = require('path');
const fs = require('fs');
const JSZip = require("jszip");
const xml2js = require("xml2js");
const multer = require('multer');
const docx = require('docx');
const { encrypt, decrypt } = require('../config/cryptoHelper')
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/'); // apna upload folder
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
const allowedExt = ['.jpeg', '.jpg', '.png', '.gif', '.webp'];

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedMimeTypes.includes(file.mimetype) && allowedExt.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
}).array('images', 10); // max 10 images per request








exports.addbooking = async (req, res) => {
  const {
    project_id,
    sector_id,
    plot_id,
    square_feet_rate,
    plc_drc,
    booking_amount,
    amount_a,
    amount_b,
    payment_mode,
    time_of_payment,
    additional_comment,
    refrens,
    agreement_date,
    register_date,
    square_feet_size,
    krutiDev_font,
    check_no,
    branch_name,
    bank_name,
    check_date,
    broker_id,
    broker_name,
    commission_type,
    commission_value,
    customers,
    booking_date,
    broker_number, // <-- NEW KEY (blank bhi ho sakta)
    towords        // <-- yahan se value aa jayegi (text me)
  } = req.body;

  const loggedInUserId = req.body.created_by_id || null;

  console.log(loggedInUserId, 'jnfrhjbnlogin id')

  const fontType = krutiDev_font ? Number(krutiDev_font) : 0;
  const errors = [];

  if (!project_id) errors.push("project_id is required");
  if (!sector_id) errors.push("sector_id is required");
  if (!plot_id) errors.push("plot_id is required");
  if (!square_feet_rate) errors.push("square_feet_rate is required");

  if (!customers || !Array.isArray(customers) || customers.length === 0) {
    errors.push("At least one customer is required");
  } else {
    customers.forEach((cust, idx) => {
      if (!cust.customer_name || cust.customer_name.trim() === "")
        errors.push(`customer_name is required for customer index ${idx}`);
      if (cust.type !== 0 && cust.type !== 1)
        errors.push(`type must be 0 or 1 for customer index ${idx}`);
    });
  }

  if (errors.length > 0) {
    return res.status(400).json({ success: false, errors });
  }

  const createDate = new Date();
  const formattedDate = createDate.toISOString().split("T")[0];

  try {
    const [checkResult] = await db.fetchQuery(
      `SELECT COUNT(*) as count FROM bookings WHERE plot_id = ? AND status = 0`,
      [plot_id]
    );
    if (checkResult.count > 0) {
      return res.json({
        success: false,
        message: "Plot is already booked (active booking exists).",
      });
    }

    // ------------------ Broker Handling ------------------
    let finalBrokerId = null;
    let finalBrokerNumber = null;
    let finalCommissionType = commission_type || "percentage";
    let finalCommissionValue = commission_value || 0;

    if (broker_id && broker_id !== 0) {
      const [bkr] = await db.fetchQuery(
        `SELECT phone_number FROM brokers WHERE broker_id = ?`,
        [broker_id]
      );
      finalBrokerId = broker_id;
      finalBrokerNumber = bkr?.phone_number || "";

      if (krutiDev_font != null) {
        await db.fetchQuery(
          `UPDATE brokers SET kruti_brokers_font = ? WHERE broker_id = ?`,
          [fontType, broker_id]
        );
      }
    } else if (broker_name && broker_name.trim() !== "") {
      const insertBroker = await db.fetchQuery(
        `INSERT INTO brokers (broker_name, phone_number, created_at, kruti_brokers_font) VALUES (?, ?, ?, ?)`,
        [broker_name, broker_number || "", formattedDate, fontType]
      );
      finalBrokerId = insertBroker.insertId;
      finalBrokerNumber = broker_number || "";
    }

    // ------------------ Reference Handling ------------------
    let referenceId = null;
    if (refrens) {
      const [refCheck] = await db.fetchQuery(
        `SELECT id FROM reference WHERE name = ?`,
        [refrens]
      );
      if (refCheck?.id) {
        referenceId = refCheck.id;
      } else {
        const refInsert = await db.fetchQuery(
          `INSERT INTO reference (name) VALUES (?)`,
          [refrens]
        );
        referenceId = refInsert.insertId;
      }
    }

    // ------------------ Insert Bookings & Receive Amount ------------------
    const rootBookingDateValue = booking_date ? String(booking_date).split("T")[0] : null;

    for (let i = 0; i < customers.length; i++) {
      const cust = customers[i];
      const mobileNumber = Number(cust.mobile_no || 0);
      let bookingDateValue = rootBookingDateValue;
      const relationPrefixValue =
        cust.prefix && cust.prefix.trim() !== "" ? cust.prefix.trim() : null;

      const bookingQuery = `
        INSERT INTO bookings(
          customer_name, customer_father_name, customer_age, customer_address,
          square_feet_size, mobile_no, adhar_number, pan_number, amount_a, welcome, 
          plot_id, sector_id, square_feet_rate, plc_drc, booking_amount, payment_mode, payment_time, 
          project_id, additional_comment, custom_field, agreement_date, register_date, refer,
          create_at, krutiDev_font, type, check_no, branch_name, bank_name, check_date,
          broker_id, broker_number, commission_type, commission_value,
          towords,
          relation_prefix, booking_date, status, created_by_id
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      `; // 👆 39 question marks

      const bookingParams = [
        cust.customer_name,
        cust.CustomerFatherName || "",
        cust.CustomerAge || null,
        cust.CustomerAddress || "",
        square_feet_size || null,
        mobileNumber,
        cust.aadhaar_number || null,
        cust.pan_number || null,
        amount_a || 0,
        encrypt(amount_b != null ? amount_b.toString() : ""),
        plot_id,
        sector_id,
        square_feet_rate,
        plc_drc || null,
        booking_amount || 0,
        payment_mode || null,
        time_of_payment || "",
        project_id,
        additional_comment || "",
        cust.custom_field || null,
        agreement_date || null,
        register_date || null,
        referenceId,
        formattedDate,
        fontType,
        cust.type || 0,
        check_no || null,
        branch_name || null,
        bank_name || null,
        check_date || null,
        finalBrokerId,
        finalBrokerNumber,
        finalCommissionType,
        finalCommissionValue,
        towords || null,
        relationPrefixValue,
        bookingDateValue,
        0,
        loggedInUserId
      ];

      const insertBooking = await db.fetchQuery(bookingQuery, bookingParams);
      const bookingId = insertBooking.insertId;

      // ✅ ONLY THIS – plots table update on booking insert



      if (i === 0) {
        const receiveQuery = `
          INSERT INTO receive_amount(
            customer_id, project_id, sector_id, plot_id, amount, towords,
            payment_type, receive_date, receive_date_b, is_delete,
            additional_comments, image,
            check_no, check_date, bank_name, branch_name, kruti_font_booking
          ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        `;

        const receiveParams = [
          bookingId,
          project_id,
          sector_id,
          plot_id,
          booking_amount || 0,
          towords || null,
          payment_mode || null,
          booking_date,
          null,
          0,
          additional_comment || "",
          "",
          check_no || null,
          check_date || null,
          bank_name || null,
          branch_name || null,
          fontType,
        ];

        await db.fetchQuery(receiveQuery, receiveParams);
      }
    }

    await db.fetchQuery(
      `UPDATE plots 
   SET 
     square_feet = ?, 
     plot_rate = ?, 
     amount = ?,
     status_id  = 4
   WHERE plot_id = ? AND is_delete = 0`,
      [
        square_feet_size || 0,
        square_feet_rate || 0,
        amount_a || 0,
        plot_id
      ]
    );

    return res.json({ success: true, message: "Booking(s) added successfully" });
  } catch (error) {
    console.error("❌ Error adding booking:", {
      message: error.message,
      code: error.code,
      errno: error.errno,
      sqlMessage: error.sqlMessage,
      sqlState: error.sqlState,
      sql: error.sql,
      stack: error.stack,
    });

    return res.status(500).json({
      success: false,
      message: "Error adding booking(s)",
      error: {
        message: error.message || null,
        code: error.code || null,
        errno: error.errno || null,
        sqlMessage: error.sqlMessage || null,
        sqlState: error.sqlState || null,
        sql: error.sql || null,
      },
    });
  }
};




exports.addDocuments = async (req, res) => {
  upload(req, res, async (err) => {
    if (err) {
      console.error("File upload error:", err);
      return res.status(400).json({ success: false, message: err.message });
    }

    // Check token
    const token = req.headers.authorization;
    if (!token) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    // Match the frontend FormData field names
    const { projectId, plotId, documentName, fontName } = req.body;
    const files = req.files;

    console.log("Body:", req.body);
    console.log("Files:", files);

    if (!projectId || !plotId || !documentName || !files || files.length === 0) {
      return res.status(400).json({ success: false, message: "All fields are required" });
    }

    const now = new Date();
    const formattedDateTime = now.toISOString().slice(0, 19).replace("T", " ");

    try {
      const insertedIds = [];
      for (const file of files) {
        const result = await db.insertQuery(
          `INSERT INTO documents (project_id, plot_id, name, image, font_type, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [projectId, plotId, documentName, file.filename, fontName || 0, formattedDateTime, formattedDateTime]
        );
        insertedIds.push(result.insertId);
      }

      return res.json({
        success: true,
        message: `${files.length} document(s) uploaded successfully`,
        data: { insertedIds },
      });
    } catch (dbErr) {
      console.error("Database error:", dbErr);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  });
};

// exports.allbookings = async (req, res) => {
//   try {
//     const { plot_id } = req.query;

//     // user_id extraction (numeric only)
//     const rawUserId = req.query.user_id;
//     const userId = rawUserId && /^\d+$/.test(String(rawUserId)) ? Number(rawUserId) : null;

//     // booking_id extraction (numeric only)
//     const rawBookingId = req.query.booking_id;
//     const bookingId = rawBookingId && /^\d+$/.test(String(rawBookingId)) ? Number(rawBookingId) : null;

//     // Check if user has any assigned_project records
//     let userHasPermissions = false;
//     if (userId) {
//       const checkQuery = `SELECT 1 FROM assigned_project WHERE user_id = ? LIMIT 1`;
//       const checkResult = await db.fetchQuery(checkQuery, [userId]);
//       userHasPermissions = Array.isArray(checkResult) && checkResult.length > 0;
//     }

//     // Build ap join (if user has permission -> INNER JOIN with user filter, else LEFT JOIN)
//     const apJoin = userHasPermissions
//       ? `INNER JOIN assigned_project ap ON ap.assigned_project_id = projects.project_id AND ap.user_id = ?`
//       : `LEFT JOIN assigned_project ap ON ap.assigned_project_id = projects.project_id`;

//     const isAssignedCase = userHasPermissions ? 'ap.user_id IS NOT NULL' : '0=1';

//     // Common select block (used for list and single)
//     const selectBlock = `
//       SELECT 
//         bookings.*,
//         bookings.welcome AS amount_b,
//         plots.plot_no,
//         plots.plot_id AS _plot_id, -- helper to compare
//         sector.sector_name,
//         payment_type.payment_mode,
//         payment_type.id AS payment_mode_id,
//         projects.name AS project_name,
//         projects.krutiDev_font AS project_font,
//         projects.type AS project_type,
//         reference.name AS reference_name,
//         brokers.broker_name AS broker_name,
//         brokers.phone_number AS broker_phone,
//         brokers.kruti_brokers_font AS broker_font,
//         bookings.commission_type AS commission_type,
//         bookings.commission_value AS commission_value,
//         rdl.id AS download_id,
//         rdl.is_downloaded,
//         rdl.downloaded_at,
//         CASE WHEN ${isAssignedCase} THEN 1 ELSE 0 END AS is_assigned
//       FROM bookings
//       LEFT JOIN plots ON bookings.plot_id = plots.plot_id
//       LEFT JOIN sector ON bookings.sector_id = sector.sector_id
//       LEFT JOIN payment_type ON bookings.payment_mode = payment_type.id
//       LEFT JOIN projects ON bookings.project_id = projects.project_id
//       LEFT JOIN reference ON bookings.refer = reference.id
//       LEFT JOIN brokers ON bookings.broker_id = brokers.broker_id
//       LEFT JOIN receipt_download_log AS rdl ON rdl.booking_id = bookings.booking_id
//       ${apJoin}
//     `;

//     // Helper: dedupe array of rows by booking_id (keep first occurrence)
//     const dedupeByBookingId = (rows = []) => {
//       const seen = new Set();
//       const unique = [];
//       for (const r of rows) {
//         const id = r && r.booking_id;
//         if (id == null) continue; // skip malformed rows
//         if (!seen.has(id)) {
//           seen.add(id);
//           unique.push(r);
//         }
//       }
//       return unique;
//     };

//     // ⭐ NEW: documents + documents_date ko plot_id ke hisaab se attach karo
//     const attachDocumentsAndDatesToRows = async (rows = []) => {
//       if (!rows.length) return rows;

//       // unique plot_ids nikaalo
//       const plotIds = [
//         ...new Set(
//           rows
//             .map(r => r._plot_id)
//             .filter(id => id !== null && id !== undefined)
//         ),
//       ];

//       if (plotIds.length === 0) {
//         // koi plot_id nahi mila to empty arrays attach kar do
//         return rows.map(r => ({
//           ...r,
//           documents: [],
//           documents_date: []
//         }));
//       }

//       const placeholders = plotIds.map(() => '?').join(',');

//       // -------- documents table --------
//       const docsQuery = `
//         SELECT 
//           id,
//           project_id,
//           plot_id,
//           name,
//           image,
//           font_type,
//           created_at,
//           updated_at
//         FROM documents
//         WHERE plot_id IN (${placeholders})
//       `;

//       const docs = await db.fetchQuery(docsQuery, plotIds);

//       const docsByPlot = {};
//       (docs || []).forEach(doc => {
//         const pid = doc.plot_id;
//         if (!docsByPlot[pid]) docsByPlot[pid] = [];
//         docsByPlot[pid].push(doc);
//       });

//       // -------- documents_date table --------
//       const docsDateQuery = `
//         SELECT 
//           id,
//           project_id,
//           plot_id,
//           type,
//           document_date
//         FROM documents_date
//         WHERE plot_id IN (${placeholders})
//       `;

//       const docsDate = await db.fetchQuery(docsDateQuery, plotIds);

//       const docsDateByPlot = {};
//       (docsDate || []).forEach(row => {
//         const pid = row.plot_id;
//         if (!docsDateByPlot[pid]) docsDateByPlot[pid] = [];
//         docsDateByPlot[pid].push(row);
//       });

//       // rows pe attach
//       return rows.map(r => ({
//         ...r,
//         documents: docsByPlot[r._plot_id] || [],        // 👈 documents table
//         documents_date: docsDateByPlot[r._plot_id] || [] // 👈 documents_date table
//       }));
//     };

//     // 1) If bookingId provided — try to fetch that single booking first
//     if (bookingId) {
//       const singleWhere = `WHERE bookings.booking_id = ? AND bookings.is_delete = ? AND bookings.status = 0 LIMIT 1`;
//       const singleQuery = `${selectBlock} ${singleWhere};`;

//       let singleParams = [];
//       if (userHasPermissions) singleParams.push(userId);
//       singleParams.push(bookingId, 0); // booking_id, is_delete

//       const singleRes = await db.fetchQuery(singleQuery, singleParams);
//       let uniqueSingle = dedupeByBookingId(singleRes || []);

//       // ⭐ yahan attach
//       uniqueSingle = await attachDocumentsAndDatesToRows(uniqueSingle);

//       if (Array.isArray(uniqueSingle) && uniqueSingle.length > 0) {
//         const bookingRow = uniqueSingle[0];

//         if (!plot_id || String(bookingRow._plot_id) === String(plot_id)) {
//           const decrypted = {
//             ...bookingRow,
//             amount_b: decrypt(bookingRow.amount_b),
//             is_assigned: Number(bookingRow.is_assigned) === 1
//           };
//           return res.json({ success: true, data: [decrypted] });
//         }
//       }
//     }

//     // 2) If plot_id provided (either bookingId absent OR bookingId mismatch), fetch all bookings for that plot
//     if (plot_id) {
//       const whereClauses = `WHERE bookings.is_delete = ? AND bookings.status = 0 AND plots.plot_id = ?`;
//       const listQuery = `${selectBlock} ${whereClauses} ORDER BY bookings.booking_id DESC;`;

//       let listParams = [];
//       if (userHasPermissions) listParams.push(userId);
//       listParams.push(0, plot_id); // is_delete, plot_id

//       const listRes = await db.fetchQuery(listQuery, listParams);
//       let uniqueList = dedupeByBookingId(listRes || []);

//       // ⭐ attach
//       uniqueList = await attachDocumentsAndDatesToRows(uniqueList);

//       const decryptedList = uniqueList.map(row => ({
//         ...row,
//         amount_b: decrypt(row.amount_b),
//         is_assigned: Number(row.is_assigned) === 1
//       }));
//       return res.json({ success: true, data: decryptedList });
//     }

//     // 3) Full listing
//     const fullWhere = `WHERE bookings.is_delete = ? AND bookings.status = 0`;
//     const fullQuery = `${selectBlock} ${fullWhere} ORDER BY bookings.booking_id DESC;`;

//     let fullParams = [];
//     if (userHasPermissions) fullParams.push(userId);
//     fullParams.push(0); // is_delete

//     const fullRes = await db.fetchQuery(fullQuery, fullParams);
//     let uniqueFull = dedupeByBookingId(fullRes || []);

//     // ⭐ attach
//     uniqueFull = await attachDocumentsAndDatesToRows(uniqueFull);

//     const decryptedFull = uniqueFull.map(row => ({
//       ...row,
//       amount_b: decrypt(row.amount_b),
//       is_assigned: Number(row.is_assigned) === 1
//     }));

//     return res.json({ success: true, data: decryptedFull });

//   } catch (error) {
//     console.error("❌ Error in allbookings:", error);
//     res.status(500).json({
//       success: false,
//       message: "Something went wrong while fetching all bookings",
//       error: error.message
//     });
//   }
// };



// exports.allbookings = async (req, res) => {
//   try {
//     const { plot_id } = req.query;

//     const rawUserId = req.query.user_id;
//     const userId = rawUserId && /^\d+$/.test(String(rawUserId)) ? Number(rawUserId) : null;

//     const rawBookingId = req.query.booking_id;
//     const bookingId = rawBookingId && /^\d+$/.test(String(rawBookingId)) ? Number(rawBookingId) : null;

//     let userHasPermissions = false;
//     if (userId) {
//       const checkQuery = `SELECT 1 FROM assigned_project WHERE user_id = ? LIMIT 1`;
//       const checkResult = await db.fetchQuery(checkQuery, [userId]);
//       userHasPermissions = Array.isArray(checkResult) && checkResult.length > 0;
//     }

//     const apJoin = userHasPermissions
//       ? `INNER JOIN assigned_project ap ON ap.assigned_project_id = projects.project_id AND ap.user_id = ?`
//       : `LEFT JOIN assigned_project ap ON ap.assigned_project_id = projects.project_id`;

//     const isAssignedCase = userHasPermissions ? 'ap.user_id IS NOT NULL' : '0=1';

//     const selectBlock = `
//       SELECT 
//         bookings.*,
//         bookings.welcome AS amount_b,
//         plots.plot_no,
//         plots.plot_id AS _plot_id,
//         sector.sector_name,
//         payment_type.payment_mode,
//         payment_type.id AS payment_mode_id,
//         projects.name AS project_name,
//         projects.krutiDev_font AS project_font,
//         projects.type AS project_type,
//         reference.name AS reference_name,
//         brokers.broker_name AS broker_name,
//         brokers.phone_number AS broker_phone,
//         brokers.kruti_brokers_font AS broker_font,
//         bookings.commission_type AS commission_type,
//         bookings.commission_value AS commission_value,
//         rdl.id AS download_id,
//         rdl.is_downloaded,
//         rdl.downloaded_at,
//         CASE WHEN ${isAssignedCase} THEN 1 ELSE 0 END AS is_assigned
//       FROM bookings
//       LEFT JOIN plots ON bookings.plot_id = plots.plot_id
//       LEFT JOIN sector ON bookings.sector_id = sector.sector_id
//       LEFT JOIN payment_type ON bookings.payment_mode = payment_type.id
//       LEFT JOIN projects ON bookings.project_id = projects.project_id
//       LEFT JOIN reference ON bookings.refer = reference.id
//       LEFT JOIN brokers ON bookings.broker_id = brokers.broker_id
//       LEFT JOIN receipt_download_log AS rdl ON rdl.booking_id = bookings.booking_id
//       ${apJoin}
//     `;

//     const dedupeByBookingId = (rows = []) => {
//       const seen = new Set();
//       const unique = [];
//       for (const r of rows) {
//         const id = r && r.booking_id;
//         if (id == null) continue;
//         if (!seen.has(id)) {
//           seen.add(id);
//           unique.push(r);
//         }
//       }
//       return unique;
//     };

//     const attachDocumentsAndDatesToRows = async (rows = []) => {
//       if (!rows.length) return rows;

//       const plotIds = [
//         ...new Set(
//           rows.map(r => r._plot_id).filter(id => id !== null && id !== undefined)
//         ),
//       ];

//       if (plotIds.length === 0) {
//         return rows.map(r => ({ ...r, documents: [], documents_date: [] }));
//       }

//       const placeholders = plotIds.map(() => '?').join(',');

//       const docsQuery = `
//         SELECT id, project_id, plot_id, name, image, font_type, created_at, updated_at
//         FROM documents
//         WHERE plot_id IN (${placeholders})
//       `;
//       const docs = await db.fetchQuery(docsQuery, plotIds);
//       const docsByPlot = {};
//       (docs || []).forEach(doc => {
//         const pid = doc.plot_id;
//         if (!docsByPlot[pid]) docsByPlot[pid] = [];
//         docsByPlot[pid].push(doc);
//       });

//       const docsDateQuery = `
//         SELECT id, project_id, plot_id, type, document_date
//         FROM documents_date
//         WHERE plot_id IN (${placeholders})
//       `;
//       const docsDate = await db.fetchQuery(docsDateQuery, plotIds);
//       const docsDateByPlot = {};
//       (docsDate || []).forEach(row => {
//         const pid = row.plot_id;
//         if (!docsDateByPlot[pid]) docsDateByPlot[pid] = [];
//         docsDateByPlot[pid].push(row);
//       });

//       return rows.map(r => ({
//         ...r,
//         documents: docsByPlot[r._plot_id] || [],
//         documents_date: docsDateByPlot[r._plot_id] || []
//       }));
//     };

//     // ✅ Received amount attach karo — ek baar mein sabhi bookings ke liye
//     const attachReceivedAmount = async (rows = []) => {
//       if (!rows.length) return rows;

//       const bookingIds = rows.map(r => r.booking_id).filter(Boolean);
//       if (bookingIds.length === 0) return rows;

//       const placeholders = bookingIds.map(() => '?').join(',');
//       const receivedRows = await db.fetchQuery(
//         `SELECT customer_id, IFNULL(SUM(amount), 0) as total
//          FROM receive_amount
//          WHERE customer_id IN (${placeholders})
//          AND COALESCE(is_delete, 0) = 0
//          GROUP BY customer_id`,
//         bookingIds
//       );

//       const receivedMap = {};
//       (receivedRows || []).forEach(r => {
//         receivedMap[r.customer_id] = Number(r.total) || 0;
//       });

//       return rows.map(r => {
//         const total_amount   = Number(r.amount_a) || 0;
//         const received_amount = receivedMap[r.booking_id] || 0;
//         const pending_amount  = Math.max(total_amount - received_amount, 0);
//         return {
//           ...r,
//           received_amount,  // ✅ kitna mila
//           pending_amount,   // ✅ kitna baaki
//         };
//       });
//     };

//     // 1) Single booking by bookingId
//     if (bookingId) {
//       const singleWhere = `WHERE bookings.booking_id = ? AND bookings.is_delete = ? AND bookings.status = 0 LIMIT 1`;
//       const singleQuery = `${selectBlock} ${singleWhere};`;

//       let singleParams = [];
//       if (userHasPermissions) singleParams.push(userId);
//       singleParams.push(bookingId, 0);

//       const singleRes = await db.fetchQuery(singleQuery, singleParams);
//       let uniqueSingle = dedupeByBookingId(singleRes || []);
//       uniqueSingle = await attachDocumentsAndDatesToRows(uniqueSingle);
//       uniqueSingle = await attachReceivedAmount(uniqueSingle); // ✅

//       if (Array.isArray(uniqueSingle) && uniqueSingle.length > 0) {
//         const bookingRow = uniqueSingle[0];
//         if (!plot_id || String(bookingRow._plot_id) === String(plot_id)) {
//           const decrypted = {
//             ...bookingRow,
//             amount_b: decrypt(bookingRow.amount_b),
//             is_assigned: Number(bookingRow.is_assigned) === 1
//           };
//           return res.json({ success: true, data: [decrypted] });
//         }
//       }
//     }

//     // 2) Plot ke sab bookings
//     if (plot_id) {
//       const whereClauses = `WHERE bookings.is_delete = ? AND bookings.status = 0 AND plots.plot_id = ?`;
//       const listQuery = `${selectBlock} ${whereClauses} ORDER BY bookings.booking_id DESC;`;

//       let listParams = [];
//       if (userHasPermissions) listParams.push(userId);
//       listParams.push(0, plot_id);

//       const listRes = await db.fetchQuery(listQuery, listParams);
//       let uniqueList = dedupeByBookingId(listRes || []);
//       uniqueList = await attachDocumentsAndDatesToRows(uniqueList);
//       uniqueList = await attachReceivedAmount(uniqueList); // ✅

//       const decryptedList = uniqueList.map(row => ({
//         ...row,
//         amount_b: decrypt(row.amount_b),
//         is_assigned: Number(row.is_assigned) === 1
//       }));
//       return res.json({ success: true, data: decryptedList });
//     }

//     // 3) Full listing
//     const fullWhere = `WHERE bookings.is_delete = ? AND bookings.status = 0`;
//     const fullQuery = `${selectBlock} ${fullWhere} ORDER BY bookings.booking_id DESC;`;

//     let fullParams = [];
//     if (userHasPermissions) fullParams.push(userId);
//     fullParams.push(0);

//     const fullRes = await db.fetchQuery(fullQuery, fullParams);
//     let uniqueFull = dedupeByBookingId(fullRes || []);
//     uniqueFull = await attachDocumentsAndDatesToRows(uniqueFull);
//     uniqueFull = await attachReceivedAmount(uniqueFull); // ✅

//     const decryptedFull = uniqueFull.map(row => ({
//       ...row,
//       amount_b: decrypt(row.amount_b),
//       is_assigned: Number(row.is_assigned) === 1
//     }));

//     return res.json({ success: true, data: decryptedFull });

//   } catch (error) {
//     console.error("❌ Error in allbookings:", error);
//     res.status(500).json({
//       success: false,
//       message: "Something went wrong while fetching all bookings",
//       error: error.message
//     });
//   }
// };


// ✅ FIXED (duplicate plot ignore)
const calculateTotals = (rows = []) => {
  const plotMap = new Map();

  for (const r of rows) {
    const plotId = r._plot_id;
    if (!plotId) continue;

    const amount = Number(r.amount_a) || 0;
    const received = Number(r.received_amount) || 0;

    if (!plotMap.has(plotId)) {
      plotMap.set(plotId, {
        total_amount: amount,
        received_amount: received,
      });
    } else {
      const existing = plotMap.get(plotId);

      // 🔥 ADD nahi karna — replace with correct one
      plotMap.set(plotId, {
        total_amount: amount,       // latest row
        received_amount: received,  // latest row
      });
    }
  }

  let total = 0;
  let received = 0;

  for (const val of plotMap.values()) {
    total += val.total_amount;
    received += val.received_amount;
  }

  return {
    grand_total_amount: total,
    grand_received_amount: received,
    grand_pending_amount: total - received,
  };
};
exports.allbookings = async (req, res) => {
  try {
    const { plot_id } = req.query;

    const rawUserId = req.query.user_id;
    const userId = rawUserId && /^\d+$/.test(String(rawUserId)) ? Number(rawUserId) : null;

    const rawBookingId = req.query.booking_id;
    const bookingId = rawBookingId && /^\d+$/.test(String(rawBookingId)) ? Number(rawBookingId) : null;

    let userHasPermissions = false;
    if (userId) {
      const checkQuery = `SELECT 1 FROM assigned_project WHERE user_id = ? LIMIT 1`;
      const checkResult = await db.fetchQuery(checkQuery, [userId]);
      userHasPermissions = Array.isArray(checkResult) && checkResult.length > 0;
    }

    const apJoin = userHasPermissions
      ? `INNER JOIN assigned_project ap ON ap.assigned_project_id = projects.project_id AND ap.user_id = ?`
      : `LEFT JOIN assigned_project ap ON ap.assigned_project_id = projects.project_id`;

    const isAssignedCase = userHasPermissions ? 'ap.user_id IS NOT NULL' : '0=1';

    const selectBlock = `
      SELECT 
        bookings.*,
        bookings.welcome AS amount_b,
        plots.plot_no,
        plots.plot_id AS _plot_id,
        sector.sector_name,
        payment_type.payment_mode,
        payment_type.id AS payment_mode_id,
        projects.name AS project_name,
        projects.krutiDev_font AS project_font,
        projects.type AS project_type,
        reference.name AS reference_name,
        brokers.broker_name AS broker_name,
        brokers.phone_number AS broker_phone,
        brokers.kruti_brokers_font AS broker_font,
        bookings.commission_type AS commission_type,
        bookings.commission_value AS commission_value,
        rdl.id AS download_id,
        rdl.is_downloaded,
        rdl.downloaded_at,
        CASE WHEN ${isAssignedCase} THEN 1 ELSE 0 END AS is_assigned
      FROM bookings
      LEFT JOIN plots ON bookings.plot_id = plots.plot_id
      LEFT JOIN sector ON bookings.sector_id = sector.sector_id
      LEFT JOIN payment_type ON bookings.payment_mode = payment_type.id
      LEFT JOIN projects ON bookings.project_id = projects.project_id
      LEFT JOIN reference ON bookings.refer = reference.id
      LEFT JOIN brokers ON bookings.broker_id = brokers.broker_id
      LEFT JOIN receipt_download_log AS rdl ON rdl.booking_id = bookings.booking_id
      ${apJoin}
    `;

    const dedupeByBookingId = (rows = []) => {
      const seen = new Set();
      const unique = [];
      for (const r of rows) {
        const id = r && r.booking_id;
        if (id == null) continue;
        if (!seen.has(id)) {
          seen.add(id);
          unique.push(r);
        }
      }
      return unique;
    };

    const attachDocumentsAndDatesToRows = async (rows = []) => {
      if (!rows.length) return rows;

      const plotIds = [
        ...new Set(
          rows.map(r => r._plot_id).filter(id => id !== null && id !== undefined)
        ),
      ];

      if (plotIds.length === 0) {
        return rows.map(r => ({ ...r, documents: [], documents_date: [] }));
      }

      const placeholders = plotIds.map(() => '?').join(',');

      const docsQuery = `
        SELECT id, project_id, plot_id, name, image, font_type, created_at, updated_at
        FROM documents
        WHERE plot_id IN (${placeholders})
      `;
      const docs = await db.fetchQuery(docsQuery, plotIds);
      const docsByPlot = {};
      (docs || []).forEach(doc => {
        const pid = doc.plot_id;
        if (!docsByPlot[pid]) docsByPlot[pid] = [];
        docsByPlot[pid].push(doc);
      });

      const docsDateQuery = `
  SELECT id, project_id, plot_id, type, document_date
  FROM documents_date
  WHERE plot_id IN (${placeholders})
  AND is_deleted = 0
`;
      const docsDate = await db.fetchQuery(docsDateQuery, plotIds);
      const docsDateByPlot = {};
      (docsDate || []).forEach(row => {
        const pid = row.plot_id;
        if (!docsDateByPlot[pid]) docsDateByPlot[pid] = [];
        docsDateByPlot[pid].push(row);
      });

      return rows.map(r => ({
        ...r,
        documents: docsByPlot[r._plot_id] || [],
        documents_date: docsDateByPlot[r._plot_id] || []
      }));
    };

    const attachReceivedAmount = async (rows = []) => {
      if (!rows.length) return rows;

      const bookingIds = rows.map(r => r.booking_id).filter(Boolean);
      if (bookingIds.length === 0) return rows;

      const placeholders = bookingIds.map(() => '?').join(',');
      const receivedRows = await db.fetchQuery(
        `SELECT customer_id, IFNULL(SUM(amount), 0) as total
         FROM receive_amount
         WHERE customer_id IN (${placeholders})
         AND COALESCE(is_delete, 0) = 0
         GROUP BY customer_id`,
        bookingIds
      );

      const receivedMap = {};
      (receivedRows || []).forEach(r => {
        receivedMap[r.customer_id] = Number(r.total) || 0;
      });

      return rows.map(r => {
        const total_amount = Number(r.amount_a) || 0;
        const received_amount = receivedMap[r.booking_id] || 0;
        const pending_amount = Math.max(total_amount - received_amount, 0);
        return {
          ...r,
          received_amount,
          pending_amount,
        };
      });
    };

    // 1) Single booking
    if (bookingId) {
      const singleWhere = `WHERE bookings.booking_id = ? AND bookings.is_delete = ? AND bookings.status = 0 LIMIT 1`;
      const singleQuery = `${selectBlock} ${singleWhere};`;

      let singleParams = [];
      if (userHasPermissions) singleParams.push(userId);
      singleParams.push(bookingId, 0);

      const singleRes = await db.fetchQuery(singleQuery, singleParams);
      let uniqueSingle = dedupeByBookingId(singleRes || []);
      uniqueSingle = await attachDocumentsAndDatesToRows(uniqueSingle);
      uniqueSingle = await attachReceivedAmount(uniqueSingle);

      if (Array.isArray(uniqueSingle) && uniqueSingle.length > 0) {
        const bookingRow = uniqueSingle[0];
        if (!plot_id || String(bookingRow._plot_id) === String(plot_id)) {
          const decrypted = {
            ...bookingRow,
            amount_b: decrypt(bookingRow.amount_b),
            is_assigned: Number(bookingRow.is_assigned) === 1
          };

          const totals = calculateTotals([decrypted]);

          return res.json({
            success: true,
            ...totals,
            data: [decrypted]
          });
        }
      }
    }

    // 2) Plot bookings
    if (plot_id) {
      const whereClauses = `WHERE bookings.is_delete = ? AND bookings.status = 0 AND plots.plot_id = ?`;
      const listQuery = `${selectBlock} ${whereClauses} ORDER BY bookings.booking_id DESC;`;

      let listParams = [];
      if (userHasPermissions) listParams.push(userId);
      listParams.push(0, plot_id);

      const listRes = await db.fetchQuery(listQuery, listParams);
      let uniqueList = dedupeByBookingId(listRes || []);
      uniqueList = await attachDocumentsAndDatesToRows(uniqueList);
      uniqueList = await attachReceivedAmount(uniqueList);

      const decryptedList = uniqueList.map(row => ({
        ...row,
        amount_b: decrypt(row.amount_b),
        is_assigned: Number(row.is_assigned) === 1
      }));

      const totals = calculateTotals(decryptedList);

      return res.json({
        success: true,
        ...totals,
        data: decryptedList
      });
    }

    // 3) Full listing
    const fullWhere = `WHERE bookings.is_delete = ? AND bookings.status = 0`;
    const fullQuery = `${selectBlock} ${fullWhere} ORDER BY bookings.booking_id DESC;`;

    let fullParams = [];
    if (userHasPermissions) fullParams.push(userId);
    fullParams.push(0);

    const fullRes = await db.fetchQuery(fullQuery, fullParams);
    let uniqueFull = dedupeByBookingId(fullRes || []);
    uniqueFull = await attachDocumentsAndDatesToRows(uniqueFull);
    uniqueFull = await attachReceivedAmount(uniqueFull);

    const decryptedFull = uniqueFull.map(row => ({
      ...row,
      amount_b: decrypt(row.amount_b),
      is_assigned: Number(row.is_assigned) === 1
    }));

    const totals = calculateTotals(decryptedFull);

    return res.json({
      success: true,
      ...totals,
      data: decryptedFull
    });

  } catch (error) {
    console.error("❌ Error in allbookings:", error);
    res.status(500).json({
      success: false,
      message: "Something went wrong while fetching all bookings",
      error: error.message
    });
  }
};



exports.cancelBooking = async (req, res) => {
  const { plot_id, cancel_by_id } = req.body;

  const loggedInUserId = cancel_by_id || null;

  if (!plot_id) {
    return res.status(400).json({
      success: false,
      message: "plot_id is required",
    });
  }

  try {
    // ✅ Booking cancel
    const cancelQuery = `
      UPDATE bookings 
      SET 
        status = 1,
        cancel_by_id = ?,
        cancel_date = NOW()
      WHERE plot_id = ? AND is_delete = 0
    `;

    const result = await db.fetchQuery(cancelQuery, [
      loggedInUserId,
      plot_id,
    ]);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "No active booking found for this plot",
      });
    }

    // ✅ documents_date me soft delete
    const updateDocumentsQuery = `
      UPDATE documents_date
      SET is_deleted = 1
      WHERE plot_id = ?
    `;

    await db.fetchQuery(updateDocumentsQuery, [plot_id]);

    res.json({
      success: true,
      message: "Booking cancelled successfully",
    });

  } catch (error) {
    console.error("❌ Error cancelling booking:", error);

    res.status(500).json({
      success: false,
      message: "Error cancelling booking",
      error: error.message,
    });
  }
};
// exports.cancelBooking = async (req, res) => {
// const { plot_id, cancel_by_id } = req.body;

// const loggedInUserId = cancel_by_id || null;

//   if (!plot_id) {
//     return res.status(400).json({ success: false, message: "plot_id is required" });
//   }

//   try {
//     const cancelQuery = `
//      UPDATE bookings 
//    SET 
//   status = 1,
//   cancel_by_id = ?,
//   cancel_date = NOW()
// WHERE plot_id = ? AND is_delete = 0
//     `;
// const result = await db.fetchQuery(cancelQuery, [
//       loggedInUserId,
//       plot_id
//     ]);

//     if (result.affectedRows === 0) {
//       return res.status(404).json({ success: false, message: "No active booking found for this plot" });
//     }

//     res.json({ success: true, message: "Booking cancelled successfully" });
//   } catch (error) {
//     console.error("❌ Error cancelling booking:", error);
//     res.status(500).json({ success: false, message: "Error cancelling booking", error: error.message });
//   }
// };





exports.updatebooking = async (req, res) => {
  const {
    booking_ids = [],
    sector_id,
    plot_id,
    square_feet_rate,
    plc_drc,
    booking_amount,
    amount_a,
    amount_b,
    square_feet_size,
    payment_mode,
    time_of_payment,
    additional_comment,
    refrens,
    agreement_date,
    register_date,
    krutiDev_font,
    check_no,
    branch_name,
    bank_name,
    check_date,
    broker_id,
    broker_name,
    broker_number, // <-- broker mobile receive karega
    commission_type,
    commission_value,
    customers = [],
    delete_booking_ids = [],
    project_id,
    booking_date,
    towords          // 🔥 NEW: amount in words (edit screen se aayega)
  } = req.body;


  const loggedInUserId = req.body.updated_by_id || null;


  const safe = (v) =>
    v === undefined || v === "undefined" || v === "" ? null : v;
  const fontType = krutiDev_font ? Number(krutiDev_font) : 0;
  const formattedDate = new Date().toISOString().split("T")[0];

  // =========================
  // VALIDATION: MAX 5 & MIN 1
  // =========================
  const existingCount = Array.isArray(booking_ids) ? booking_ids.length : 0;

  const newCount = Array.isArray(customers)
    ? customers.filter((c) => c && (c.id == null || c.id === undefined)).length
    : 0;

  const uniqueDeleteIds = Array.isArray(delete_booking_ids)
    ? [...new Set(delete_booking_ids)]
    : [];
  const deleteCount = uniqueDeleteIds.length;

  const finalCustomerCount = existingCount - deleteCount + newCount;

  // 👉 Max 5 hi allowed
  if (finalCustomerCount > 5) {
    return res.status(400).json({
      success: false,
      message: "एक बुकिंग में ज़्यादा से ज़्यादा 5 customer ही हो सकते हैं.",
    });
  }

  // 👉 Kam se kam 1 rehna zaroori
  if (finalCustomerCount < 1) {
    return res.status(400).json({
      success: false,
      message: "कम से कम 1 customer रहना ज़रूरी है, सबको delete नहीं कर सकते.",
    });
  }

  try {
    let old_plot_id = null;
    const first_booking_id = Array.isArray(booking_ids) ? booking_ids[0] : booking_ids;
    if (first_booking_id) {
      const existingBooking = await db.fetchQuery(`SELECT plot_id FROM bookings WHERE booking_id = ?`, [first_booking_id]);
      if (existingBooking && existingBooking.length > 0) {
        old_plot_id = existingBooking[0].plot_id;
      }
    }

    // =========================
    // DELETE LOGIC
    // =========================
    if (uniqueDeleteIds.length > 0) {
      const placeholders = uniqueDeleteIds.map(() => "?").join(",");
      await db.fetchQuery(
        `UPDATE bookings SET is_delete = 1 WHERE booking_id IN (${placeholders})`,
        uniqueDeleteIds
      );
    }

    // =========================
    // BROKER LOGIC — (Number Update Added)
    // =========================
    let finalBrokerId = null;
    let finalBrokerNumber = broker_number || ""; // <-- priority UI ka number

    let finalCommissionType = commission_type || "percentage";
    let finalCommissionValue = commission_value || 0;

    if (broker_id && broker_id !== 0) {
      // existing broker
      finalBrokerId = broker_id;

      // Update phone number + kruti font
      await db.fetchQuery(
        `UPDATE brokers SET phone_number = ?, kruti_brokers_font = ? WHERE broker_id = ?`,
        [finalBrokerNumber, fontType, broker_id]
      );
    } else if (!broker_id && broker_name && broker_name.trim() !== "") {
      // new / by name
      const [existingBroker] = await db.fetchQuery(
        `SELECT broker_id FROM brokers WHERE broker_name = ? LIMIT 1`,
        [broker_name.trim()]
      );

      if (existingBroker) {
        finalBrokerId = existingBroker.broker_id;
        await db.fetchQuery(
          `UPDATE brokers SET phone_number = ?, kruti_brokers_font = ? WHERE broker_id = ?`,
          [finalBrokerNumber, fontType, finalBrokerId]
        );
      } else {
        const insertBroker = await db.fetchQuery(
          `INSERT INTO brokers (broker_name, phone_number, created_at, kruti_brokers_font) VALUES (?, ?, NOW(), ?)`,
          [broker_name.trim(), finalBrokerNumber, fontType]
        );
        finalBrokerId = insertBroker.insertId;
      }
    }

    // =========================
    // REFERENCE LOGIC
    // =========================
    let referenceId = null;
    if (refrens) {
      const [refExist] = await db.fetchQuery(
        `SELECT id FROM reference WHERE name = ?`,
        [refrens]
      );
      referenceId =
        refExist?.id ||
        (
          await db.fetchQuery(
            `INSERT INTO reference (name) VALUES (?)`,
            [refrens]
          )
        ).insertId;
    }

    const rootBookingDateValue = booking_date
      ? String(booking_date).split("T")[0]
      : null;

    // =========================
    // LOOP THROUGH CUSTOMERS
    // =========================
    for (let i = 0; i < customers.length; i++) {
      const cust = customers[i];
      const booking_id = booking_ids[i] || null;

      const sqFtRate = Number(square_feet_rate || 0);
      const sqFtSize = Number(square_feet_size || 0);
      const calcAmountA = amount_a ? Number(amount_a) : sqFtRate * sqFtSize;
      const calcAmountB = amount_b ? Number(amount_b) : 0;

      const totalBookingAmount = booking_amount;

      const relationPrefixValue =
        cust.prefix && String(cust.prefix).trim() !== ""
          ? String(cust.prefix).trim()
          : null;
      let bookingDateValue = rootBookingDateValue;

      if (booking_id) {
        // ========== OLD RECORD UPDATE (same as pehle + towords) ==========
        const updateQuery = `
          UPDATE bookings SET
            customer_name=?, customer_father_name=?, customer_age=?, customer_address=?,
            square_feet_size=?, mobile_no=?, adhar_number=?, pan_number=?,
            amount_a=?, welcome=?, plot_id=?, sector_id=?, square_feet_rate=?, plc_drc=?, booking_amount=?,
            payment_mode=?, payment_time=?, additional_comment=?, custom_field=?, 
            agreement_date=?, register_date=?, refer=?, update_at=?, krutiDev_font=?, type=?, 
            check_no=?, branch_name=?, bank_name=?, check_date=?, broker_id=?, broker_number=?, 
            commission_type=?, commission_value=?, towords=?, relation_prefix=?, booking_date=?, updated_by_id=?
          WHERE booking_id=?`;

        await db.fetchQuery(updateQuery, [
          safe(cust.name),
          safe(cust.fatherName),
          safe(cust.age),
          safe(cust.address),
          sqFtSize,
          safe(cust.number),
          safe(cust.adhar_number),
          safe(cust.pan_number),
          calcAmountA,
          encrypt(calcAmountB != null ? calcAmountB.toString() : ""),
          safe(plot_id),
          safe(sector_id),
          sqFtRate,
          safe(plc_drc),
          totalBookingAmount,
          safe(payment_mode),
          safe(time_of_payment),
          safe(additional_comment),
          safe(cust.custom_field),
          safe(agreement_date),
          safe(register_date),
          safe(referenceId),
          formattedDate,
          fontType,
          safe(cust.type),
          safe(check_no),
          safe(branch_name),
          safe(bank_name),
          safe(check_date),
          finalBrokerId,
          finalBrokerNumber, // <-- UPDATE booking table me number save
          safe(finalCommissionType),
          safe(finalCommissionValue),
          towords || null,      // 🔥 NEW: towords update
          relationPrefixValue,
          bookingDateValue,
          loggedInUserId,
          safe(booking_id),
        ]);

        // RECEIVE_AMOUNT update — FIRST CUSTOMER ONLY
        const [existingReceive] = await db.fetchQuery(
          `SELECT id FROM receive_amount WHERE customer_id = ? AND welcome IS NULL`,
          [booking_id]
        );





        if (i === 0 && existingReceive) {
          await db.fetchQuery(
            `UPDATE receive_amount 
             SET project_id=?, sector_id=?, plot_id=?, amount=?, towords=?, payment_type=?, 
                 receive_date=?, additional_comments=?, image=?, receive_date_b=?, 
                 check_no=?, check_date=?, bank_name=?, kruti_font_booking=?, is_delete=0
             WHERE id=?`,
            [
              safe(project_id),
              safe(sector_id),
              safe(plot_id),
              safe(totalBookingAmount),
              towords || null,          // 🔥 NEW: yahan bhi towords update
              safe(payment_mode),
              formattedDate,
              safe(additional_comment),
              null,
              safe(register_date),
              safe(check_no),
              safe(check_date),
              safe(bank_name),
              fontType,
              existingReceive.id,
            ]
          );
        }
      } else if (cust.id == null) {
        // ========== NEW: JIS CUSTOMER KI ID NULL HAI → INSERT NEW ROW ==========
        const insertQuery = `
          INSERT INTO bookings (
            customer_name, customer_father_name, customer_age, customer_address,
            square_feet_size, mobile_no, adhar_number, pan_number,
            amount_a, welcome, plot_id, sector_id, square_feet_rate, plc_drc, booking_amount,
            payment_mode, payment_time, additional_comment, custom_field,
            agreement_date, register_date, refer, update_at, krutiDev_font, type,
            check_no, branch_name, bank_name, check_date, broker_id, broker_number,
            commission_type, commission_value, towords, relation_prefix, booking_date, project_id, is_delete
          ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0)
        `;

        await db.fetchQuery(insertQuery, [
          safe(cust.name),
          safe(cust.fatherName),
          safe(cust.age),
          safe(cust.address),
          sqFtSize,
          safe(cust.number),
          safe(cust.adhar_number),
          safe(cust.pan_number),
          calcAmountA,
          encrypt(calcAmountB != null ? calcAmountB.toString() : ""),
          safe(plot_id),
          safe(sector_id),
          sqFtRate,
          safe(plc_drc),
          totalBookingAmount,
          safe(payment_mode),
          safe(time_of_payment),
          safe(additional_comment),
          safe(cust.custom_field),
          safe(agreement_date),
          safe(register_date),
          safe(referenceId),
          formattedDate, // update_at / create_at jaisa use
          fontType,
          safe(cust.type),
          safe(check_no),
          safe(branch_name),
          safe(bank_name),
          safe(check_date),
          finalBrokerId,
          finalBrokerNumber,
          safe(finalCommissionType),
          safe(finalCommissionValue),
          towords || null,        // 🔥 NEW: new inserted booking me bhi towords
          relationPrefixValue,
          bookingDateValue,
          safe(project_id),
        ]);
      }
    }

    // ✅ ONLY THIS – plots table update on booking UPDATE
    await db.fetchQuery(
      `UPDATE plots 
   SET 
     square_feet = ?, 
     plot_rate = ?, 
     amount = ?,
     status_id = 4
   WHERE plot_id = ? AND is_delete = 0`,
      [
        square_feet_size || 0,
        square_feet_rate || 0,
        amount_a || 0,
        plot_id
      ]
    );

    // ✅ If plot has changed, free up the old plot and move documents
    if (old_plot_id && old_plot_id != plot_id) {
      await db.fetchQuery(`UPDATE plots SET status_id = 1 WHERE plot_id = ?`, [old_plot_id]);
      await db.fetchQuery(`UPDATE documents_date SET plot_id = ? WHERE plot_id = ?`, [plot_id, old_plot_id]);
    }

    res.json({
      success: true,
      message:
        "✅ Booking updated successfully",
    });
  } catch (err) {
    console.error("❌ Error in updatebooking:", err);
    res.status(500).json({
      success: false,
      message: "An error occurred while updating booking.",
      error: err.message,
    });
  }
};

exports.deletebooking = async (req, res) => {
  const { booking_id } = req.query;

  if (!booking_id) {
    res.json({
      success: false,
      message: 'Booking id is required'
    })
  }
  try {
    const qurey = `UPDATE bookings SET is_delete= ? WHERE booking_id = ?`;
    const param = [1, booking_id];
    const reslut = await db.insertQuery(qurey, param);
    res.json({
      success: true,
      message: 'Booking delete successfully'
    })

  } catch (error) {
    console.log(error)
  }
}

function numberToHindiWords(num) {
  if (num === 0) return "शून्य";

  const oneToNinetyNine = [
    "", "एक", "दो", "तीन", "चार", "पांच", "छह", "सात", "आठ", "नौ",
    "दस", "ग्यारह", "बारह", "तेरह", "चौदह", "पंद्रह", "सोलह", "सत्रह", "अठारह", "उन्नीस",
    "बीस", "इक्कीस", "बाईस", "तेईस", "चौबीस", "पच्चीस", "छब्बीस", "सत्ताईस", "अट्ठाईस", "उनतीस",
    "तीस", "इकतीस", "बत्तीस", "तैंतीस", "चौंतीस", "पैंतीस", "छत्तीस", "सैंतीस", "अड़तीस", "उनतालीस",
    "चालीस", "इकतालीस", "बयालीस", "तैंतालीस", "चवालीस", "पैंतालीस", "छियालिस", "सैंतालीस", "अड़तालीस", "उनचास",
    "पचास", "इक्यावन", "बावन", "तिरेपन", "चौवन", "पचपन", "छप्पन", "सत्तावन", "अट्ठावन", "उनसठ",
    "साठ", "इकसठ", "बासठ", "तिरेसठ", "चौंसठ", "पैंसठ", "छियासठ", "सड़सठ", "अड़सठ", "उनहत्तर",
    "सत्तर", "इकहत्तर", "बहत्तर", "तिहत्तर", "चौहत्तर", "पचहत्तर", "छिहत्तर", "सतहत्तर", "अठहत्तर", "उन्यासी",
    "अस्सी", "इक्यासी", "बयासी", "तिरासी", "चौरासी", "पचासी", "छियासी", "सतासी", "अठासी", "नवासी",
    "नब्बे", "इक्यानवे", "बानवे", "तिरेनवे", "चौरानवे", "पचानवे", "छियानवे", "सत्तानवे", "अट्ठानवे", "निन्यानवे"
  ];

  let result = "";

  if (num >= 10000000) { // करोड़
    result += numberToHindiWords(Math.floor(num / 10000000)) + " करोड़ ";
    num %= 10000000;
  }
  if (num >= 100000) { // लाख
    result += numberToHindiWords(Math.floor(num / 100000)) + " लाख ";
    num %= 100000;
  }
  if (num >= 1000) { // हजार
    result += numberToHindiWords(Math.floor(num / 1000)) + " हजार ";
    num %= 1000;
  }
  if (num >= 100) { // सौ
    result += numberToHindiWords(Math.floor(num / 100)) + " सौ ";
    num %= 100;
  }
  if (num > 0) { // 1-99
    result += oneToNinetyNine[num] + " ";
  }

  return result.trim();
}




exports.Docs = async (req, res) => {
  const { project_id, plot_no } = req.query;

  const filePath = path.resolve(__dirname, "..", "public", "report_fixed.docx");

  try {
    const query = `
  SELECT 
    bookings.*, 
    projects.*, 
    plots.*, 
    plots.plot_font, 
    sector.*, 
    bookings.krutiDev_font, 
    bookings.welcome
  FROM bookings
  JOIN projects ON bookings.project_id = projects.project_id
  JOIN plots ON bookings.plot_id = plots.plot_id
  JOIN sector ON bookings.sector_id = sector.sector_id
  WHERE bookings.project_id = ?
    AND bookings.status = 0
    AND bookings.is_delete = 0
    ${plot_no ? "AND plots.plot_no = ?" : ""}
      `;



    const queryParams = plot_no ? [project_id, plot_no] : [project_id];

    const result = await db.fetchQuery(query, queryParams);
    console.log(result)

    if (!result || result.length === 0) {
      return res.status(404).send("इस प्रोजेक्ट के लिए कोई ग्राहक नहीं मिला");
    }

    if (!fs.existsSync(filePath)) {
      return res.status(400).send("Template DOCX file not found");
    }

    const formatDateDDMMYYYY = (date) => {
      if (!date) return '';
      const d = new Date(date);
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}-${month}-${year}`;
    };

    const content = fs.readFileSync(filePath);
    const zip = await JSZip.loadAsync(content);
    let docXml = await zip.file('word/document.xml').async('string');

    let emptyParagraphs = '';
    for (let i = 0; i < 10; i++) {
      emptyParagraphs += '<w:p><w:r><w:t>&#160;</w:t></w:r></w:p>';
    }

    const titleParagraph = `
<w:p>
  <w:pPr>
    <w:jc w:val="center"/>
  </w:pPr>
  <w:r>
    <w:rPr>
      <w:b/>
      <w:u w:val="single"/>
      <w:sz w:val="18"/>
      <w:szCs w:val="18"/>
    </w:rPr>
    <w:t>Plot Buyer's Agreement
    </w:t>
  </w:r>
</w:p>`;

    docXml = docXml.replace('<w:body>', `<w:body>${emptyParagraphs}${titleParagraph}`);

    let b = '#mohit';
    let allBuyersSection = '';

    const type1Buyers = result.filter(buyer => buyer.type === 1);
    type1Buyers.forEach((buyer, index) => {
      const buyerNumber = index + 1;
      const krutiDevBuyerLine = `
${buyerNumber}- Jh@Jhefr ${buyer.customer_name} iq=@iq=h@ifRu Jh ${buyer.customer_father_name} vk;q ${buyer.customer_age} o"kZ O;olk; ${buyer.custom_field} fuoklh ${buyer.customer_address}A 
        ${b}`;
      allBuyersSection += krutiDevBuyerLine;
    });

    const type0Buyers = result.filter(buyer => buyer.type === 0);
    type0Buyers.forEach((buyer, index) => {
      const buyerNumber = type1Buyers.length + index + 1;
      const krutiDevBuyerLine = `
${buyerNumber}- eSllZ ${buyer.customer_name} tfj;s ${buyer.customer_father_name} O;olkf;d irk ${buyer.customer_address} dEiuh@QeZ ds leLr mRrjkf/kdkjh o leuqnsf'kr o 'ks;j gksYMj ftls@ftUgs bl foys[k esa vkxs f}rh; i{k ds lEcks/ku ls lEcksf/kr fd;k tkosxkA
${b}`;
      allBuyersSection += krutiDevBuyerLine;
    });

    docXml = docXml.replaceAll('__BUYERS_LIST_START__', allBuyersSection);

    const firstBuyer = result[0];
    const bookingDate = firstBuyer.agreement_date ? new Date(firstBuyer.agreement_date) : new Date();
    const day = String(bookingDate.getDate()).padStart(2, '0');
    const month = String(bookingDate.getMonth() + 1).padStart(2, '0');
    const year = bookingDate.getFullYear();
    const formattedDate = `${day}-${month}-${year}`;

    const plotArea = firstBuyer.plot_width * firstBuyer.plot_height;
    const plot_gaj = Math.round(plotArea / 9);

    const bookingAmountInWords = numberToHindiWords(firstBuyer.booking_amount);
    const amountInWords = numberToHindiWords(firstBuyer.amount);

    let customer1_name = "-----";
    let customer2_name = "-----";
    let customer3_name = "-----";
    let customer4_name = "-----";
    let customer5_name = "-----";
    // let customer6_name = "-----";

    if (result.length > 0) {
      customer1_name = result[0].type === 0
        ? (result[0].customer_father_name || "-----")
        : (result[0].customer_name || "-----");
    }
    if (result.length > 1) {
      customer2_name = result[1].type === 0
        ? (result[1].customer_father_name || "-----")
        : (result[1].customer_name || "-----");
    }
    if (result.length > 2) {
      customer3_name = result[2].type === 0
        ? (result[2].customer_father_name || "-----")
        : (result[2].customer_name || "-----");
    }
    if (result.length > 3) {
      customer4_name = result[3].type === 0
        ? (result[3].customer_father_name || "-----")
        : (result[3].customer_name || "-----");
    }
    if (result.length > 4) {
      customer5_name = result[4].type === 0
        ? (result[4].customer_father_name || "-----")
        : (result[4].customer_name || "-----");
    }

    const replacements = {
      seller: 'bharat',
      sector_name: firstBuyer.sector_name,
      plot_no: `${firstBuyer.sector_name}-${firstBuyer.plot_no}`,
      plot_booking_date: formatDateDDMMYYYY(firstBuyer.create_at),
      feet: firstBuyer.square_feet_size,
      squrefeet_rate: firstBuyer.square_feet,
      square_rate: firstBuyer.square_feet_rate,
      booking_amount: firstBuyer.booking_amount,
      booking_amount_words: bookingAmountInWords,
      height: firstBuyer.plot_height,
      plot_width: firstBuyer.plot_width,
      amount: firstBuyer.amount ? Math.round(firstBuyer.amount * 100) / 100 : 0,


      amount_words: amountInWords,
      east: firstBuyer.east,
      west: firstBuyer.west,
      north: firstBuyer.north,
      south: firstBuyer.south,
      first_buyer_name: firstBuyer.customer_name,
      first_buyer_father_name: firstBuyer.customer_father_name,
      first_buyer_address: firstBuyer.address,
      first_buyer_age: firstBuyer.customer_age,
      plot_area: plotArea,
      plot_gaj: plot_gaj,
      branch_name: firstBuyer.branch_name,
      bank_name: firstBuyer.bank_name,
      check_number: firstBuyer.check_no,
      check_date: formatDateDDMMYYYY(firstBuyer.check_date),
      customer1_name,
      customer2_name,
      customer3_name,
      customer4_name,
      customer5_name,
    };

    for (const [key, value] of Object.entries(replacements)) {
      const regex = new RegExp(`{${key}}`, 'g');
      docXml = docXml.replace(regex, value ?? '');
    }

    const krutiDevBuyerLine2 = `
2- ;g fd f}rh; i{k }kjk mijksä of.kZr p;u fd;s x;s Hkw[k.M dh lEiw.kZ izfrQy dh jkf'k esa ls :i;s ${firstBuyer.booking_amount}   v[kjs :i;s ${bookingAmountInWords}
:i;s  ek= f}rh; i{k us çFke i{k dks tfj;s RTGS/NEFT/NET BANKING@pSd la[;k ${firstBuyer.check_no}  cSad 
  ${firstBuyer.bank_name} 'kk[kk 
${firstBuyer.branch_name}  chdkusj  fnukad  ${formatDateDDMMYYYY(firstBuyer.check_date)} dks vnk dj fn;s gSaA  ftldh izkfIr dh izFke i{k ,rn~ }kjk Lohdkjksfä djrk gSA
`;

    docXml = docXml.replace('_payment_', krutiDevBuyerLine2);

    zip.file('word/document.xml', docXml);
    const buffer = await zip.generateAsync({ type: 'nodebuffer' });
    const base64File = buffer.toString('base64');

    res.json({
      success: true,
      message: "DOCX file generated successfully",
      fileUrl: `data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,${base64File}`,
      data: result // 👈 yeh raha aapka full data
    });


  } catch (error) {
    console.error("Error:", error);
    res.status(500).send("Server error: " + error.message);
  }
};
exports.searchBrokers = async (req, res) => {
  const { keyword } = req.query; // e.g. /api/searchBrokers?keyword=mohit

  try {
    let query;
    let params;

    if (keyword && keyword.trim() !== "") {
      query = `
        SELECT DISTINCT 
          br.broker_id, 
          br.broker_name,
          br.phone_number,
          br.kruti_brokers_font,
          p.commission_type,
          p.commission_value
        FROM brokers br
        LEFT JOIN projects p ON p.broker_id = br.broker_id
        WHERE 
          br.broker_name IS NOT NULL 
          AND br.broker_name != '' 
          AND LOWER(br.broker_name) LIKE LOWER(?)
          AND (br.deleted_at IS NULL OR br.deleted_at = '')
        ORDER BY br.broker_name ASC
        LIMIT 20;
      `;
      params = [`%${keyword.trim()}%`];
    } else {
      query = `
        SELECT DISTINCT 
          br.broker_id, 
          br.broker_name,
          br.phone_number,
          br.kruti_brokers_font,
          p.commission_type,
          p.commission_value
        FROM brokers br
        LEFT JOIN projects p ON p.broker_id = br.broker_id
        WHERE 
          br.broker_name IS NOT NULL 
          AND br.broker_name != '' 
          AND (br.deleted_at IS NULL OR br.deleted_at = '')
        ORDER BY br.broker_name ASC
        LIMIT 20;
      `;
      params = [];
    }

    const result = await db.fetchQuery(query, params);

    // 🧹 Clean broker names (remove extra spaces)
    const cleanedResult = result.map((row) => ({
      broker_id: row.broker_id,
      broker_name: row.broker_name?.trim() || "",
      phone_number: row.phone_number || "",
      commission_type: row.commission_type || "",
      commission_value: row.commission_value || "",
      kruti_brokers_font: row.kruti_brokers_font || 0,
    }));

    res.json({
      success: true,
      count: cleanedResult.length,
      data: cleanedResult,
    });
  } catch (error) {
    console.error("🔴 Error in searchBrokers API:", error);
    res.status(500).json({
      success: false,
      message: "Something went wrong while searching brokers",
      error: error.message,
    });
  }
};

exports.downloadBooking = async (req, res) => {
  const { plot_id, user_id, role_id } = req.body;

  console.log("downloadBooking request:", req.body);

  if (!plot_id || !user_id || typeof role_id === "undefined") {
    return res.status(400).json({
      status: false,
      message: "plot_id, user_id and role_id are required"
    });
  }

  try {
    // --------------------------
    // CASE 1: ROLE = 4 (limited)
    // --------------------------
    if (Number(role_id) === 4) {
      const checkSql = `
        SELECT id, is_download
        FROM agreement_download_log
        WHERE plot_id = ? AND user_id = ? AND role_id = 4
        LIMIT 1
      `;
      const check = await db.fetchQuery(checkSql, [plot_id, user_id]);

      if (check.length > 0 && Number(check[0].is_download) === 1) {
        return res.status(400).json({
          status: false,
          message: "Agreement already downloaded once. You cannot download again."
        });
      }

      // If exists but not downloaded -> update
      if (check.length > 0) {
        await db.fetchQuery(
          `UPDATE agreement_download_log
           SET is_download = 1, downloaded_at = NOW(), updated_at = NOW()
           WHERE id = ?`,
          [check[0].id]
        );

        return res.json({
          status: true,
          message: "Download allowed. Marked as downloaded."
        });
      }

      // insert new log
      await db.fetchQuery(
        `INSERT INTO agreement_download_log
         (plot_id, user_id, role_id, is_download, downloaded_at, created_at, updated_at)
         VALUES (?, ?, 4, 1, NOW(), NOW(), NOW())`,
        [plot_id, user_id]
      );

      return res.json({
        status: true,
        message: "Download allowed. Record created and marked downloaded."
      });
    }

    // --------------------------
    // CASE 2: ROLE != 4 (unlimited)
    // always insert a log row
    // --------------------------
    await db.fetchQuery(
      `INSERT INTO agreement_download_log
       (plot_id, user_id, role_id, is_download, downloaded_at, created_at, updated_at)
       VALUES (?, ?, ?, 1, NOW(), NOW(), NOW())`,
      [plot_id, user_id, role_id]
    );

    return res.json({
      status: true,
      message: "Download allowed (unlimited role). Log created."
    });

  } catch (err) {
    console.error("❌ downloadBooking error:", err);
    return res.status(500).json({
      status: false,
      message: "Server error",
      error: err.message
    });
  }
};

// exports.addDate = async (req, res) => {
//   const {
//     project_id,
//     plot_id,

//     // OLD dates
//     allotment_date,
//     patta_file_date,
//     patta_date,
//     registration_date,

//     // NEW dates
//     agreement_date,
//     booking_date,
//     executed_date,
//     patta_received_date,
//     patta_registration_date,
//     registry_date,
//     organization_document_handed_over_to_party_date,

//     // 🔹 TEXT
//     agreement_checked_by,

//     // OLD ids
//     allotment_id,
//     patta_file_id,
//     patta_id,
//     registration_id,

//     // NEW ids
//     agreement_id,
//     booking_id,
//     executed_id,
//     patta_received_id,
//     patta_registration_id,
//     registry_id,
//     agreement_checked_by_id,
//     organization_document_handed_over_to_party_id
//   } = req.body;

//   const errors = [];
//   if (!project_id) errors.push("project_id is required");
//   if (!plot_id) errors.push("plot_id is required");

//   if (
//     !allotment_date &&
//     !patta_file_date &&
//     !patta_date &&
//     !registration_date &&
//     !agreement_date &&
//     !booking_date &&
//     !executed_date &&
//     !patta_received_date &&
//     !patta_registration_date &&
//     !registry_date &&
//     !agreement_checked_by &&
//       !organization_document_handed_over_to_party_date
//   ) {
//     errors.push("At least one value is required");
//   }

//   if (errors.length) {
//     return res.status(400).json({ success: false, errors });
//   }

//   try {
//     // 🔹 ALL date + text in ONE array
//     const items = [
//       { value: allotment_date, type: "allotment", id: allotment_id },
//       { value: patta_file_date, type: "patta_file", id: patta_file_id },
//       { value: patta_date, type: "patta", id: patta_id },
//       { value: registration_date, type: "registration", id: registration_id },

//       { value: agreement_date, type: "agreement", id: agreement_id },
//       { value: booking_date, type: "booking", id: booking_id },
//       { value: executed_date, type: "executed", id: executed_id },
//       { value: patta_received_date, type: "patta_received", id: patta_received_id },
//       { value: patta_registration_date, type: "patta_registration", id: patta_registration_id },
//       { value: registry_date, type: "registry", id: registry_id },
//        {
//         value: organization_document_handed_over_to_party_date,
//         type: "organization_document_handed_over_to_party",
//         id: organization_document_handed_over_to_party_id
//        },

//       // 🔥 TEXT FIELD
//       {
//         value: agreement_checked_by,
//         type: "agreement_checked_by",
//         id: agreement_checked_by_id
//       }
//     ];

//     const insertedIds = [];
//     const updatedIds = [];

//     for (const item of items) {
//       if (!item.value) continue;

//       // 🔹 UPDATE if id exists
//       if (item.id) {
//         const updateResult = await db.fetchQuery(
//           `UPDATE documents_date SET document_date = ? WHERE id = ?`,
//           [item.value, item.id]
//         );

//         if (updateResult?.affectedRows > 0) {
//           updatedIds.push(item.id);
//           continue;
//         }
//       }

//       // 🔹 INSERT
//       const insertResult = await db.fetchQuery(
//         `INSERT INTO documents_date (project_id, plot_id, type, document_date)
//          VALUES (?, ?, ?, ?)`,
//         [project_id, plot_id, item.type, item.value]
//       );

//       if (insertResult?.insertId) {
//         insertedIds.push(insertResult.insertId);
//       }
//     }

//     return res.json({
//       success: true,
//       message: "All dates & text saved successfully",
//       count: insertedIds.length + updatedIds.length,
//       insertedIds,
//       updatedIds
//     });

//   } catch (error) {
//     console.error("❌ addDate error:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Something went wrong while saving data"
//     });
//   }
// };

// exports.addDate = async (req, res) => {
//   const {
//     project_id,
//     plot_id,

//     allotment_date,
//     patta_file_date,
//     patta_date,
//     registration_date,

//     agreement_date,
//     booking_date,
//     executed_date,
//     patta_received_date,
//     patta_registration_date,
//     registry_date,
//     organization_document_handed_over_to_party_date,

//     agreement_checked_by,

//     // 🔥 SIGNATURES
//     client_signature,
//     accountant_signature,
//     manager_signature,

//     allotment_id,
//     patta_file_id,
//     patta_id,
//     registration_id,

//     agreement_id,
//     booking_id,
//     executed_id,
//     patta_received_id,
//     patta_registration_id,
//     registry_id,
//     agreement_checked_by_id,
//     organization_document_handed_over_to_party_id
//   } = req.body;

//   const errors = [];
//   if (!project_id) errors.push("project_id is required");
//   if (!plot_id) errors.push("plot_id is required");

//   if (
//     !allotment_date &&
//     !patta_file_date &&
//     !patta_date &&
//     !registration_date &&
//     !agreement_date &&
//     !booking_date &&
//     !executed_date &&
//     !patta_received_date &&
//     !patta_registration_date &&
//     !registry_date &&
//     !agreement_checked_by &&
//     !organization_document_handed_over_to_party_date &&
//     !client_signature &&
//     !accountant_signature &&
//     !manager_signature
//   ) {
//     errors.push("At least one value is required");
//   }

//   if (errors.length) {
//     return res.status(400).json({ success: false, errors });
//   }

//   try {

//     // 🔥 ================= SIGNATURE VALIDATION =================

//     // 👉 Accountant → Client required
//     if (accountant_signature) {
//       const clientExists = await db.fetchQuery(
//         `SELECT id FROM documents_date 
//          WHERE project_id = ? AND plot_id = ? AND type = 'client_signature'`,
//         [project_id, plot_id]
//       );

//       if (clientExists.length === 0 && !client_signature) {
//         return res.status(400).json({
//           success: false,
//           message: "Client signature required before accountant signature"
//         });
//       }
//     }

//     // 👉 Manager → Client + Accountant required
//     if (manager_signature) {
//       const clientExists = await db.fetchQuery(
//         `SELECT id FROM documents_date 
//          WHERE project_id = ? AND plot_id = ? AND type = 'client_signature'`,
//         [project_id, plot_id]
//       );

//       const accountantExists = await db.fetchQuery(
//         `SELECT id FROM documents_date 
//          WHERE project_id = ? AND plot_id = ? AND type = 'accountant_signature'`,
//         [project_id, plot_id]
//       );

//       if (
//         (clientExists.length === 0 && !client_signature) ||
//         (accountantExists.length === 0 && !accountant_signature)
//       ) {
//         return res.status(400).json({
//           success: false,
//           message: "Client and Accountant signatures required before manager signature"
//         });
//       }
//     }

//     // 🔥 ================= MAIN LOGIC =================

//     const items = [
//       { value: allotment_date, type: "allotment", id: allotment_id },
//       { value: patta_file_date, type: "patta_file", id: patta_file_id },
//       { value: patta_date, type: "patta", id: patta_id },
//       { value: registration_date, type: "registration", id: registration_id },

//       { value: agreement_date, type: "agreement", id: agreement_id },
//       { value: booking_date, type: "booking", id: booking_id },
//       { value: executed_date, type: "executed", id: executed_id },
//       { value: patta_received_date, type: "patta_received", id: patta_received_id },
//       { value: patta_registration_date, type: "patta_registration", id: patta_registration_id },
//       { value: registry_date, type: "registry", id: registry_id },

//       {
//         value: organization_document_handed_over_to_party_date,
//         type: "organization_document_handed_over_to_party",
//         id: organization_document_handed_over_to_party_id
//       },

//       {
//         value: agreement_checked_by,
//         type: "agreement_checked_by",
//         id: agreement_checked_by_id
//       },

//       // 🔥 SIGNATURES
//       { value: client_signature, type: "client_signature" },
//       { value: accountant_signature, type: "accountant_signature" },
//       { value: manager_signature, type: "manager_signature" }
//     ];

//     const insertedIds = [];
//     const updatedIds = [];

//     for (const item of items) {
//       if (!item.value) continue;

//       // UPDATE
//       if (item.id) {
//         const updateResult = await db.fetchQuery(
//           `UPDATE documents_date SET document_date = ? WHERE id = ?`,
//           [item.value, item.id]
//         );

//         if (updateResult?.affectedRows > 0) {
//           updatedIds.push(item.id);
//           continue;
//         }
//       }

//       // CHECK EXIST
//       const existing = await db.fetchQuery(
//         `SELECT id FROM documents_date WHERE project_id = ? AND plot_id = ? AND type = ?`,
//         [project_id, plot_id, item.type]
//       );

//       if (existing.length > 0) {
//         await db.fetchQuery(
//           `UPDATE documents_date SET document_date = ? WHERE id = ?`,
//           [item.value, existing[0].id]
//         );
//         updatedIds.push(existing[0].id);
//       } else {
//         const insertResult = await db.fetchQuery(
//           `INSERT INTO documents_date (project_id, plot_id, type, document_date)
//            VALUES (?, ?, ?, ?)`,
//           [project_id, plot_id, item.type, item.value]
//         );

//         if (insertResult?.insertId) {
//           insertedIds.push(insertResult.insertId);
//         }
//       }
//     }

//     return res.json({
//       success: true,
//       message: "All data + signatures saved successfully",
//       count: insertedIds.length + updatedIds.length,
//       insertedIds,
//       updatedIds
//     });

//   } catch (error) {
//     console.error("❌ addDate error:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Something went wrong while saving data"
//     });
//   }
// };


exports.addDate = async (req, res) => {
  const {
    project_id,
    plot_id,

    allotment_date,
    patta_file_date,
    patta_date,
    registration_date,

    agreement_date,
    booking_date,
    executed_date,
    patta_received_date,
    patta_registration_date,
    registry_date,
    organization_document_handed_over_to_party_date,

    agreement_checked_by,

    // 🔥 SIGNATURES (Agreement)
    client_signature,
    accountant_signature,
    manager_signature,

    // 🔥 NEW: SIGNATURES (Registry)
    registry_client_signature,
    registry_accountant_signature,
    registry_manager_signature,

    allotment_id,
    patta_file_id,
    patta_id,
    registration_id,

    agreement_id,
    booking_id,
    executed_id,
    patta_received_id,
    patta_registration_id,
    registry_id,
    agreement_checked_by_id,
    organization_document_handed_over_to_party_id
  } = req.body;

  const errors = [];
  if (!project_id) errors.push("project_id is required");
  if (!plot_id) errors.push("plot_id is required");

  if (
    !allotment_date &&
    !patta_file_date &&
    !patta_date &&
    !registration_date &&
    !agreement_date &&
    !booking_date &&
    !executed_date &&
    !patta_received_date &&
    !patta_registration_date &&
    !registry_date &&
    !agreement_checked_by &&
    !organization_document_handed_over_to_party_date &&
    !client_signature &&
    !accountant_signature &&
    !manager_signature &&
    !registry_client_signature &&
    !registry_accountant_signature &&
    !registry_manager_signature
  ) {
    errors.push("At least one value is required");
  }

  if (errors.length) {
    return res.status(400).json({ success: false, errors });
  }

  try {
    // 🔥 ================= SIGNATURE VALIDATION (REGISTRY) =================
    // (Aap chahein toh yahan Registry signatures ke liye bhi Client -> Accountant -> Manager wali sequence validation laga sakte hain)

    // 🔥 ================= MAIN LOGIC =================

    const items = [
      { value: allotment_date, type: "allotment", id: allotment_id },
      { value: patta_file_date, type: "patta_file", id: patta_file_id },
      { value: patta_date, type: "patta", id: patta_id },
      { value: registration_date, type: "registration", id: registration_id },

      { value: agreement_date, type: "agreement", id: agreement_id },
      { value: booking_date, type: "booking", id: booking_id },
      { value: executed_date, type: "executed", id: executed_id },
      { value: patta_received_date, type: "patta_received", id: patta_received_id },
      { value: patta_registration_date, type: "patta_registration", id: patta_registration_id },
      { value: registry_date, type: "registry", id: registry_id },

      {
        value: organization_document_handed_over_to_party_date,
        type: "organization_document_handed_over_to_party",
        id: organization_document_handed_over_to_party_id
      },
      {
        value: agreement_checked_by,
        type: "agreement_checked_by",
        id: agreement_checked_by_id
      },

      // 🔥 SIGNATURES (Agreement)
      { value: client_signature, type: "client_signature" },
      { value: accountant_signature, type: "accountant_signature" },
      { value: manager_signature, type: "manager_signature" },

      // 🔥 NEW: SIGNATURES (Registry)
      { value: registry_client_signature, type: "registry_client_signature" },
      { value: registry_accountant_signature, type: "registry_accountant_signature" },
      { value: registry_manager_signature, type: "registry_manager_signature" }
    ];

    const insertedIds = [];
    const updatedIds = [];

    for (const item of items) {
      if (!item.value) continue;

      // 1. UPDATE using ID if provided
      if (item.id) {
        const updateResult = await db.fetchQuery(
          `UPDATE documents_date SET document_date = ? WHERE id = ?`,
          [item.value, item.id]
        );
        if (updateResult?.affectedRows > 0) {
          updatedIds.push(item.id);
          continue;
        }
      }

      // 2. CHECK EXISTENCE by type if ID not provided or update failed
      const existing = await db.fetchQuery(
        `SELECT id FROM documents_date WHERE project_id = ? AND plot_id = ? AND type = ? AND is_deleted = 0`,
        [project_id, plot_id, item.type]
      );

      if (existing.length > 0) {
        await db.fetchQuery(
          `UPDATE documents_date SET document_date = ? WHERE id = ?`,
          [item.value, existing[0].id]
        );
        updatedIds.push(existing[0].id);
      } else {
        // 3. INSERT new record
        const insertResult = await db.fetchQuery(
          `INSERT INTO documents_date (project_id, plot_id, type, document_date)
           VALUES (?, ?, ?, ?)`,
          [project_id, plot_id, item.type, item.value]
        );

        if (insertResult?.insertId) {
          insertedIds.push(insertResult.insertId);
        }
      }
    }

    return res.json({
      success: true,
      message: "All data + signatures (Agreement & Registry) saved successfully",
      count: insertedIds.length + updatedIds.length,
      insertedIds,
      updatedIds
    });

  } catch (error) {
    console.error("❌ addDate error:", error);
    return res.status(500).json({
      success: false,
      message: "Something went wrong while saving data"
    });
  }
};

exports.PattaDocs = async (req, res) => {
  const { project_id, plot_no } = req.query;

  const filePath = path.resolve(__dirname, "..", "public", "patta.docx");

  const replacePlaceholders = (xml, data) => {
    Object.keys(data).forEach((key) => {
      const regex = new RegExp(`{${key}}`, "g");
      xml = xml.replace(regex, data[key]);
    });
    return xml;
  };

  try {
    const query = `
      SELECT 
        bookings.*, 
        projects.*, 
        plots.*, 
        plots.plot_font, 
        sector.*, 
        bookings.krutiDev_font, 
        bookings.welcome
      FROM bookings
      JOIN projects ON bookings.project_id = projects.project_id
      JOIN plots ON bookings.plot_id = plots.plot_id
      JOIN sector ON bookings.sector_id = sector.sector_id
      WHERE bookings.project_id = ?
        AND bookings.status = 0
        AND bookings.is_delete = 0
        ${plot_no ? "AND plots.plot_no = ?" : ""}
    `;

    const queryParams = plot_no ? [project_id, plot_no] : [project_id];
    const result = await db.fetchQuery(query, queryParams);

    if (!result || result.length === 0) {
      return res.status(404).send("No data found");
    }

    const row = result[0];

    if (!fs.existsSync(filePath)) {
      return res.status(400).send("Template DOCX file not found");
    }

    const content = fs.readFileSync(filePath);
    const zip = await JSZip.loadAsync(content);

    const formatDateDMY = (dateStr) => {
      if (!dateStr) return "";
      const date = new Date(dateStr);
      if (isNaN(date)) return "";
      const d = String(date.getDate()).padStart(2, "0");
      const m = String(date.getMonth() + 1).padStart(2, "0");
      const y = date.getFullYear();
      return `${d}-${m}-${y}`;
    };

    const safeStr = (v) =>
      v === null || v === undefined || String(v).toLowerCase() === "null"
        ? ""
        : String(v).trim();

    // ✅ ONLY NEW HELPER (decimal fix)
    const to2Decimal = (v) => {
      if (v === null || v === undefined || v === "" || isNaN(v)) return "";
      return Number(Number(v).toFixed(2));
    };

    // ⭐ FULL PLACEHOLDER DATA (NO FIELD REMOVED)
    const data = {
      booking_id: row.booking_id || "",
      customer_name: row.customer_name || "",
      customer_father_name: row.customer_father_name || "",
      customer_age: row.customer_age || "",
      customer_address: row.customer_address || "",
      broker_id: row.broker_id || "",
      broker_number: row.broker_number || "",
      commission_type: row.commission_type || "",
      commission_value: to2Decimal(row.commission_value),
      square_feet_size: to2Decimal(row.square_feet_size),
      mobile_no: row.mobile_no || "",
      adhar_number: row.adhar_number || "",
      pan_number: row.pan_number || "",
      amount_a: to2Decimal(row.amount_a),
      welcome: row.welcome || "",
      plot_id: row.plot_id || "",
      sector_id: row.sector_id || "",
      square_feet_rate: to2Decimal(row.square_feet_rate),
      booking_amount: to2Decimal(row.booking_amount),
      payment_mode: row.payment_mode || "",
      payment_time: row.payment_time || "",
      project_id: row.project_id || "",
      additional_comment: row.additional_comment || "",
      agreement_date: formatDateDMY(row.agreement_date),
      register_date: formatDateDMY(row.register_date),
      refer: row.refer || "",
      create_at: formatDateDMY(row.create_at),
      update_at: formatDateDMY(row.update_at),
      is_delete: row.is_delete || "",
      krutiDev_font: row.krutiDev_font || "",
      custom_field: row.custom_field || "",
      type: row.type || "",
      check_no: row.check_no || "",
      branch_name: row.branch_name || "",
      check_date: formatDateDMY(row.check_date),
      status: row.status || "",
      bank_name: row.bank_name || "",
      towords: row.towords || "",
      relation_prefix: row.relation_prefix || "",
      booking_date: formatDateDMY(row.booking_date),

      // Project + Company
      project_name: row.name || "",
      company_name: row.company_name || "",
      company_logo: row.company_logo || "",
      company_address: row.company_address || "",
      cin_number: row.cin_number || "",
      phone_number: row.phone_number || "",
      gst_pan_type: row.gst_pan_type || "",
      gst_pan_number: row.gst_pan_number || "",
      rera_reg_no: row.rera_reg_no || "--",
      rera_reg_date: formatDateDMY(row.rera_reg_date) || "--",
      image: row.image || "",
      address: row.address || "",

      // Plot
      khasra_no: row.khasra_no || "----",
      square_rate: to2Decimal(row.square_rate),
      dlc_rate: to2Decimal(row.dlc_rate),
      plot_no: row.plot_no || "--",
      height: to2Decimal(row.plot_height),
      plot_width: to2Decimal(row.plot_width),
      north: row.north || "--",
      east: row.east || "--",
      south: row.south || "--",
      west: row.west || "--",
      plot_rate: to2Decimal(row.plot_rate),
      square_feet: to2Decimal(row.square_feet),
      plot_note: row.plot_note || "",
      amount: to2Decimal(row.amount),
      plot_font: row.plot_font || "",
      sector_name: row.sector_name || "",
      plot_number: row.plot_number || "",

      // ✅ MAIN FIX
      square_yard: row.square_feet
        ? to2Decimal(Number(row.square_feet) / 9)
        : "",

      // ⭐ Auto header
      companyHeaderDetails: [
        safeStr(row.company_address),
        row.phone_number ? `Contact No. ${safeStr(row.phone_number)}` : "",
        row.gst_pan_type && row.gst_pan_number
          ? `${safeStr(row.gst_pan_type)} - ${safeStr(row.gst_pan_number)}`
          : "",
      ]
        .filter(Boolean)
        .join(" "),
    };

    let docXml = await zip.file("word/document.xml").async("string");
    docXml = replacePlaceholders(docXml, data);
    zip.file("word/document.xml", docXml);

    const headerFiles = zip.file(/word\/header\d+\.xml/);
    for (const headerFile of headerFiles) {
      let headerXml = await headerFile.async("string");
      headerXml = replacePlaceholders(headerXml, data);
      zip.file(headerFile.name, headerXml);
    }

    const buffer = await zip.generateAsync({ type: "nodebuffer" });
    const base64File = buffer.toString("base64");

    return res.json({
      success: true,
      message: "DOCX file generated successfully",
      fileUrl:
        "data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64," +
        base64File,
      data,
    });
  } catch (error) {
    console.error("❌ PattaDocs Error:", error);
    return res.status(500).send("Server error: " + error.message);
  }
};

