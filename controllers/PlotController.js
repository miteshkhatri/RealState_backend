const db = require('../utils/helpers');
const multer = require('multer');
const path = require('path');

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
}).single('plot_image');



// exports.Plots = async (req, res) => {
//     upload(req, res, async (err) => {
//         if (err) {
//             console.error('File upload error:', err);
//             return res.status(400).json({ success: false, message: err.message });
//         }

//         const {
//             plot_no,
//             plot_height,
//             plot_width,
//             sector_id,
//             north,
//             east,
//             south,
//             west,
//             plot_rate,
//             project_id,
//             square_feet,
//             plot_note,
//             amount,
//             plot_font   // ⭐ ADDED HERE
//         } = req.body;



//         if (!plot_no) return res.status(400).json({ success: false, message: "Plot number is required" });
//         if (!plot_height || !plot_width) return res.status(400).json({ success: false, message: "plot height , plot width is required" });
//         if (!sector_id) return res.status(400).json({ success: false, message: "Sector id is required" });
//         if (!plot_rate) return res.status(400).json({ success: false, message: "Plot amount is required" });

//         const createDate = new Date();
//         const formattedDate = createDate.toISOString().split('T')[0];

//         const checkPlotnumber = `SELECT * FROM plots WHERE plot_no = ? AND is_delete = ? AND sector_id = ?`;
//         const CheckPlotNoparems = [plot_no || "", 0, sector_id]

//         const resCheckPlot = await db.fetchQuery(checkPlotnumber, CheckPlotNoparems)
//         if (resCheckPlot.length > 0) {
//             return res.json({
//                 success: false,
//                 message: "Plot number already exists in the selected sector"
//             });
//         }

//         const checkSector = `SELECT plot_number FROM sector WHERE sector_id = ?`;
//         const sectorParams = [sector_id];
//         const sectorResult = await db.fetchQuery(checkSector, sectorParams);
//         const maxPlots = sectorResult[0].plot_number;

//         const countPlots = `SELECT COUNT(*) AS plot_count FROM plots WHERE sector_id = ? AND is_delete = ?`;
//         const countParams = [sector_id, 0];
//         const countResult = await db.fetchQuery(countPlots, countParams);

//         const existingPlots = countResult[0].plot_count;

//         if (existingPlots >= maxPlots) {
//             return res.json({
//                 success: false,
//                 message: `You can only add a maximum of ${maxPlots} plots to this sector.`
//             });
//         }

//         const query = `
//             INSERT INTO plots (
//                 plot_no, sector_id, plot_height, plot_width, north, east, south, west, create_at,
//                 plot_rate, project_id, square_feet, plot_note, amount, plot_font
//             ) 
//             VALUES (? , ? , ? , ? , ? , ? , ? , ? , ? , ? , ? , ? , ? , ? , ?)
//         `;

//         const params = [
//             plot_no || null,
//             sector_id,
//             plot_height,
//             plot_width,
//             north || "",
//             east || "",
//             south || "",
//             west || "",
//             formattedDate,
//             plot_rate,
//             project_id || null,
//             square_feet,
//             plot_note || '',
//             amount,
//             plot_font || 0        // ⭐ DEFAULT VALUE ADDED
//         ];

//         try {
//             const result = await db.insertQuery(query, params);
//             res.json({
//                 success: true,
//                 message: "Plot added successfully",
//             });
//         } catch (error) {
//             console.error('Database error:', error);
//             res.status(500).json({ success: false, message: 'Failed to add plot' });
//         }
//     });
// };



// exports.getallplots = async (req, res) => {
//   const { project_id, sector_id, showBooked, plot_id } = req.query;

//   try {
//     let query = '';
//     let params = [];

//     // Booking filter
//     let bookingFilter = '';
//     if (showBooked == "0") {
//       if (plot_id) {
//         // Case 3: specific plot_id + all unbooked plots
//         bookingFilter = `
//           AND (
//             NOT EXISTS (
//               SELECT 1 FROM bookings 
//               WHERE bookings.plot_id = plots.plot_id 
//               AND bookings.status = 0
//             )
//             OR plots.plot_id = ?
//           )
//         `;
//       } else {
//         // Case 1: only unbooked plots
//         bookingFilter = `
//           AND NOT EXISTS (
//             SELECT 1 FROM bookings 
//             WHERE bookings.plot_id = plots.plot_id 
//             AND bookings.status = 0
//           )
//         `;
//       }
//     }
//     // Case 2: showBooked=1 or undefined => no filter needed

//     if (sector_id) {
//       // 👉 Sector-wise filter
//       query = `
//         SELECT 
//             plots.plot_id,
//             plots.plot_no,
//             plots.sector_id,
//             ROUND(plots.plot_height, 2) AS plot_height,
//             ROUND(plots.plot_width, 2) AS plot_width,
//             plots.north,
//             plots.east,
//             plots.south,
//             plots.west,
//             plots.plot_font,
//             plots.create_at,
//             ROUND(plots.plot_rate, 2) AS plot_rate,
//             plots.project_id,
//             ROUND(plots.square_feet, 2) AS square_feet,
//             plots.plot_note,
//             ROUND(plots.amount, 2) AS amount,
//             sector.sector_name,
//             projects.krutiDev_font
//         FROM 
//             plots
//         LEFT JOIN sector ON plots.sector_id = sector.sector_id
//         LEFT JOIN projects ON plots.project_id = projects.project_id
//         WHERE 
//             plots.is_delete = 0 
//             AND plots.sector_id = ?
//             ${bookingFilter}
//       `;
//       params = plot_id ? [sector_id, plot_id] : [sector_id];
//     } else {
//       // 👉 Project-wise filter
//       query = `
//         SELECT 
//             plots.plot_id,
//             plots.plot_no,
//             plots.sector_id,
//             ROUND(plots.plot_height, 2) AS plot_height,
//             ROUND(plots.plot_width, 2) AS plot_width,
//             plots.north,
//             plots.east,
//             plots.south,
//             plots.west,
//             plots.create_at,
//             plots.plot_font,
//             ROUND(plots.plot_rate, 2) AS plot_rate,
//             plots.project_id,
//             ROUND(plots.square_feet, 2) AS square_feet,
//             plots.plot_note,
//             ROUND(plots.amount, 2) AS amount,
//             sector.sector_name,
//             projects.krutiDev_font
//         FROM 
//             plots
//         LEFT JOIN sector ON plots.sector_id = sector.sector_id
//         LEFT JOIN projects ON plots.project_id = projects.project_id
//         WHERE 
//             plots.is_delete = 0 
//             AND plots.project_id = ?
//             ${bookingFilter}
//       `;
//       params = plot_id ? [project_id || '', plot_id] : [project_id || ''];
//     }

//     const result = await db.fetchQuery(query, params);
//     res.json({
//       success: true,
//       data: result
//     });

//   } catch (error) {
//     console.log(error, 'error');
//     res.status(500).json({
//       success: false,
//       message: 'Internal Server Error'
//     });
//   }
// };

// exports.getallplots = async (req, res) => {
//   const { project_id, sector_id, showBooked, plot_id } = req.query;

//   try {
//     let query = '';
//     let params = [];

//     let bookingFilter = '';
//     if (showBooked == "0") {
//       if (plot_id) {
//         bookingFilter = `
//           AND (
//             NOT EXISTS (
//               SELECT 1 FROM bookings 
//               WHERE bookings.plot_id = plots.plot_id 
//               AND bookings.status = 0
//             )
//             OR plots.plot_id = ?
//           )
//         `;
//       } else {
//         bookingFilter = `
//           AND NOT EXISTS (
//             SELECT 1 FROM bookings 
//             WHERE bookings.plot_id = plots.plot_id 
//             AND bookings.status = 0
//           )
//         `;
//       }
//     }

//     if (sector_id) {
//       query = `
//         SELECT 
//             plots.plot_id,
//             plots.plot_no,
//             plots.sector_id,
//             ROUND(plots.plot_height, 2) AS plot_height,
//             ROUND(plots.plot_width, 2) AS plot_width,
//             plots.north,
//             plots.east,
//             plots.south,
//             plots.west,
//             plots.plot_font,
//             plots.create_at,
//             ROUND(plots.plot_rate, 2) AS plot_rate,
//             plots.project_id,
//             ROUND(plots.square_feet, 2) AS square_feet,
//             plots.plot_note,
//             ROUND(plots.amount, 2) AS amount,
//             sector.sector_name,
//             projects.krutiDev_font,

//             -- ⭐⭐⭐ STATUS ADDED HERE ⭐⭐⭐
//             CASE 
//               WHEN EXISTS (
//                 SELECT 1 FROM bookings 
//                 WHERE bookings.plot_id = plots.plot_id 
//                 AND bookings.status = 0
//               )
//               THEN 'booked'
//               ELSE 'available'
//             END AS status

//         FROM plots
//         LEFT JOIN sector ON plots.sector_id = sector.sector_id
//         LEFT JOIN projects ON plots.project_id = projects.project_id
//         WHERE plots.is_delete = 0 
//           AND plots.sector_id = ?
//           ${bookingFilter}
//       `;
//       params = plot_id ? [sector_id, plot_id] : [sector_id];
//     } else {
//       query = `
//         SELECT 
//             plots.plot_id,
//             plots.plot_no,
//             plots.sector_id,
//             ROUND(plots.plot_height, 2) AS plot_height,
//             ROUND(plots.plot_width, 2) AS plot_width,
//             plots.north,
//             plots.east,
//             plots.south,
//             plots.west,
//             plots.create_at,
//             plots.plot_font,
//             ROUND(plots.plot_rate, 2) AS plot_rate,
//             plots.project_id,
//             ROUND(plots.square_feet, 2) AS square_feet,
//             plots.plot_note,
//             ROUND(plots.amount, 2) AS amount,
//             sector.sector_name,
//             projects.krutiDev_font,

//             -- ⭐⭐⭐ STATUS ADDED HERE ⭐⭐⭐
//             CASE 
//               WHEN EXISTS (
//                 SELECT 1 FROM bookings 
//                 WHERE bookings.plot_id = plots.plot_id 
//                 AND bookings.status = 0
//               )
//               THEN 'booked'
//               ELSE 'available'
//             END AS status

//         FROM plots
//         LEFT JOIN sector ON plots.sector_id = sector.sector_id
//         LEFT JOIN projects ON plots.project_id = projects.project_id
//         WHERE plots.is_delete = 0 
//           AND plots.project_id = ?
//           ${bookingFilter}
//       `;
//       params = plot_id ? [project_id || '', plot_id] : [project_id || ''];
//     }

//     const result = await db.fetchQuery(query, params);
//     res.json({
//       success: true,
//       data: result
//     });

//   } catch (error) {
//     console.log(error, 'error');
//     res.status(500).json({
//       success: false,
//       message: 'Internal Server Error'
//     });
//   }
// };


exports.Plots = async (req, res) => {
  upload(req, res, async (err) => {
    if (err) {
      console.error('File upload error:', err);
      return res.status(400).json({ success: false, message: err.message });
    }

    const {
      plot_no,
      plot_height,
      plot_width,
      sector_id,
      north,
      east,
      south,
      west,
      plot_rate,
      project_id,
      square_feet,
      plot_note,
      amount,
      plot_font,
      status_id
    } = req.body;

    const createdBy = req.body.created_by_id || null;

    if (!plot_no) return res.status(400).json({ success: false, message: "Plot number is required" });
    if (!plot_height || !plot_width) return res.status(400).json({ success: false, message: "plot height , plot width is required" });
    if (!sector_id) return res.status(400).json({ success: false, message: "Sector id is required" });
    if (!plot_rate) return res.status(400).json({ success: false, message: "Plot amount is required" });

    const createDate = new Date();
    const formattedDate = createDate.toISOString().split('T')[0];

    // 🔹 Duplicate Plot Check
    const checkPlotnumber = `
            SELECT * FROM plots 
            WHERE plot_no = ? AND is_delete = 0 AND sector_id = ?
        `;
    const resCheckPlot = await db.fetchQuery(checkPlotnumber, [plot_no, sector_id]);

    if (resCheckPlot.length > 0) {
      return res.json({
        success: false,
        message: "Plot number already exists in the selected sector"
      });
    }

    // ===== PROJECT PERMISSION CHECK START =====
    if (project_id && createdBy) {

      const permissionQuery = `
                SELECT plot_no 
                FROM assigned_project 
                WHERE user_id = ? 
                AND assigned_project_id = ?
            `;

      const permissionResult = await db.fetchQuery(permissionQuery, [createdBy, project_id]);

      // 🔥 Only apply limit if assignment exists
      if (permissionResult.length > 0) {

        const allowedPlots = Number(permissionResult[0].plot_no) || 0;

        const countUserPlotsQuery = `
                    SELECT COUNT(*) AS total 
                    FROM plots 
                    WHERE project_id = ? 
                    AND created_by_id = ? 
                    AND is_delete = 0
                `;

        const countUserPlotsResult = await db.fetchQuery(countUserPlotsQuery, [project_id, createdBy]);
        const createdPlots = Number(countUserPlotsResult[0].total) || 0;

        // if (allowedPlots > 0 && createdPlots >= allowedPlots) {
        //     return res.json({
        //         success: false,
        //         message: `Plot creation limit exceeded. You are allowed to create maximum ${allowedPlots} plots for this project.`
        //     });
        // }
      }
    }
    // ===== PROJECT PERMISSION CHECK END =====

    const query = `
            INSERT INTO plots (
                plot_no, sector_id, plot_height, plot_width, north, east, south, west, create_at,
                plot_rate, project_id, status_id, square_feet, plot_note, amount, plot_font, created_by_id
            ) 
            VALUES (? , ? , ? , ? , ? , ? , ? , ? , ? , ? , ? , ? , ? , ? , ? , ? , ?)
        `;

    const params = [
      plot_no || null,
      sector_id,
      plot_height,
      plot_width,
      north || "",
      east || "",
      south || "",
      west || "",
      formattedDate,
      plot_rate,
      project_id || null,
      status_id || null,
      square_feet,
      plot_note || '',
      amount,
      plot_font || 0,
      createdBy
    ];

    try {
      await db.insertQuery(query, params);
      res.json({
        success: true,
        message: "Plot added successfully",
      });
    } catch (error) {
      console.error('Database error:', error);
      res.status(500).json({ success: false, message: 'Failed to add plot' });
    }
  });
};

// exports.getallplots = async (req, res) => {
//   const { project_id, sector_id, showBooked, plot_id } = req.query;

//   try {
//     let query = '';
//     let params = [];

//     let bookingFilter = '';

//     if (showBooked == "0") {
//       if (plot_id) {
//         bookingFilter = `
//           AND (
//             NOT EXISTS (
//               SELECT 1 FROM bookings 
//               WHERE bookings.plot_id = plots.plot_id 
//               AND bookings.status = 0
//               AND bookings.is_delete = 0
//             )
//             OR plots.plot_id = ?
//           )
//         `;
//       } else {
//         bookingFilter = `
//           AND NOT EXISTS (
//             SELECT 1 FROM bookings 
//             WHERE bookings.plot_id = plots.plot_id 
//             AND bookings.status = 0
//             AND bookings.is_delete = 0
//           )
//         `;
//       }
//     }

//     if (sector_id) {
//       query = `
//         SELECT 
//             plots.plot_id,
//             plots.plot_no,
//             plots.sector_id,
//             ROUND(plots.plot_height, 2) AS plot_height,
//             ROUND(plots.plot_width, 2) AS plot_width,
//             plots.north,
//             plots.east,
//             plots.south,
//             plots.west,
//             plots.plot_font,
//             plots.create_at,
//             ROUND(plots.plot_rate, 2) AS plot_rate,
//             plots.project_id,
//             ROUND(plots.square_feet, 2) AS square_feet,
//             plots.plot_note,
//             ROUND(plots.amount, 2) AS amount,
//             sector.sector_name,
//             projects.krutiDev_font,

//             CASE 
//               WHEN EXISTS (
//                 SELECT 1 FROM bookings 
//                 WHERE bookings.plot_id = plots.plot_id 
//                 AND bookings.status = 0
//                 AND bookings.is_delete = 0
//               )
//               THEN 'booked'
//               ELSE 'available'
//             END AS status

//         FROM plots
//         LEFT JOIN sector ON plots.sector_id = sector.sector_id
//         LEFT JOIN projects ON plots.project_id = projects.project_id
//         WHERE plots.is_delete = 0 
//           AND plots.sector_id = ?
//           ${bookingFilter}
//       `;

//       params = plot_id ? [sector_id, plot_id] : [sector_id];

//     } else {

//       query = `
//         SELECT 
//             plots.plot_id,
//             plots.plot_no,
//             plots.sector_id,
//             ROUND(plots.plot_height, 2) AS plot_height,
//             ROUND(plots.plot_width, 2) AS plot_width,
//             plots.north,
//             plots.east,
//             plots.south,
//             plots.west,
//             plots.create_at,
//             plots.plot_font,
//             ROUND(plots.plot_rate, 2) AS plot_rate,
//             plots.project_id,
//             ROUND(plots.square_feet, 2) AS square_feet,
//             plots.plot_note,
//             ROUND(plots.amount, 2) AS amount,
//             sector.sector_name,
//             projects.krutiDev_font,

//             CASE 
//               WHEN EXISTS (
//                 SELECT 1 FROM bookings 
//                 WHERE bookings.plot_id = plots.plot_id 
//                 AND bookings.status = 0
//                 AND bookings.is_delete = 0
//               )
//               THEN 'booked'
//               ELSE 'available'
//             END AS status

//         FROM plots
//         LEFT JOIN sector ON plots.sector_id = sector.sector_id
//         LEFT JOIN projects ON plots.project_id = projects.project_id
//         WHERE plots.is_delete = 0 
//           AND plots.project_id = ?
//           ${bookingFilter}
//       `;

//       params = plot_id ? [project_id || '', plot_id] : [project_id || ''];
//     }

//     const result = await db.fetchQuery(query, params);
//     const finalData = [];

// for (const plot of result) {

//   const documents = await db.fetchQuery(
//     `SELECT id, project_id, plot_id, type, document_date
//      FROM documents_date
//      WHERE project_id = ?
//      AND plot_id = ?`,
//     [plot.project_id, plot.plot_id]
//   );

//   finalData.push({
//     ...plot,
//     documents_date: documents // ✅ yeh add karna hai
//   });
// }

//     res.json({
//       success: true,
//       data: finalData
//     });

//   } catch (error) {
//     console.log(error, 'error');
//     res.status(500).json({
//       success: false,
//       message: 'Internal Server Error'
//     });
//   }
// };



// exports.updateplots = async (req, res) => {
//   const {
//     plot_no,
//     plot_height,
//     plot_width,
//     sector_id,
//     north,
//     east,
//     south,
//     west,
//     plot_rate,
//     plot_id,
//     square_feet,
//     plot_note,
//     plot_font
//   } = req.body;

//   const formattedDate = new Date().toISOString().split("T")[0];

//   // 🔹 AUTO CALCULATION
//   const sqft = Number(square_feet || 0);
//   const rate = Number(plot_rate || 0);
//   const amount = sqft * rate;

//   try {
//     /* ================= DUPLICATE CHECK ================= */
//     const checkPlotnumber = `
//       SELECT plot_id FROM plots
//       WHERE plot_no = ? AND plot_id != ? AND is_delete = 0 AND sector_id = ?
//     `;
//     const resCheckPlot = await db.fetchQuery(checkPlotnumber, [
//       plot_no,
//       plot_id,
//       sector_id
//     ]);

//     if (resCheckPlot.length > 0) {
//       return res.json({
//         success: false,
//         message: "Plot number already exists in the selected sector"
//       });
//     }

//     /* ================= UPDATE PLOT ================= */
//     const updatePlotQuery = `
//       UPDATE plots SET
//         plot_no = ?,
//         sector_id = ?,
//         plot_height = ?,
//         plot_width = ?,
//         north = ?,
//         east = ?,
//         south = ?,
//         west = ?,
//         plot_rate = ?,
//         square_feet = ?,
//         amount = ?,
//         plot_note = ?,
//         plot_font = ?,
//         update_at = ?
//       WHERE plot_id = ?
//     `;

//     await db.insertQuery(updatePlotQuery, [
//       plot_no,
//       sector_id,
//       plot_height,
//       plot_width,
//       north || "",
//       east || "",
//       south || "",
//       west || "",
//       rate,
//       sqft,
//       amount,
//       plot_note || "",
//       plot_font ?? 0,
//       formattedDate,
//       plot_id
//     ]);

//     /* ================= UPDATE BOOKING ================= */
//     const updateBookingQuery = `
//       UPDATE bookings SET
//         square_feet_size = ?,
//         square_feet_rate = ?,
//         amount_a = ?
//       WHERE plot_id = ? AND is_delete = 0
//     `;

//     await db.insertQuery(updateBookingQuery, [
//       sqft,
//       rate,
//       amount,
//       plot_id
//     ]);

//     /* ================= RESPONSE ================= */
//     res.json({
//       success: true,
//       message: "Plot & Booking updated successfully",
//       data: {
//         square_feet: sqft,
//         plot_rate: rate,
//         amount
//       }
//     });

//   } catch (error) {
//     console.error(error);
//     res.status(500).json({
//       success: false,
//       message: "Failed to update plot & booking"
//     });
//   }
// };
// exports.deletplots = async (req, res) => {
//     const { plot_id } = req.body;
//     if (!plot_id) {
//         res.json({
//             success: false,
//             message: 'plot_id is required'
//         })
//     }
//     const updateQurey = `UPDATE plots SET  is_delete = ? WHERE plot_id = ?`
//     const updateparems = [1, plot_id]
//     try {
//         const result = await db.insertQuery(updateQurey, updateparems);
//         res.json({
//             success: true,
//             message: "Plot delete successfully",

//         });
//     } catch (error) {
//         res.status(500).json({ success: false, message: 'Failed to delete plot' })
//     }
// }

exports.getallplots = async (req, res) => {
  const { project_id, sector_id, showBooked, plot_id } = req.query;

  try {
    let query = '';
    let params = [];
    let bookingFilter = '';

    if (showBooked == "0") {
      if (plot_id) {
        bookingFilter = `
          AND (
            (
              NOT EXISTS (
                SELECT 1 FROM bookings 
                WHERE bookings.plot_id = plots.plot_id 
                AND bookings.status = 0
                AND bookings.is_delete = 0
              )
              AND (plots.status_id IS NULL OR plots.status_id NOT IN (2, 3, 4, 5, 6))
            )
            OR plots.plot_id = ?
          )
        `;
      } else {
        bookingFilter = `
          AND NOT EXISTS (
            SELECT 1 FROM bookings 
            WHERE bookings.plot_id = plots.plot_id 
            AND bookings.status = 0
            AND bookings.is_delete = 0
          )
          AND (plots.status_id IS NULL OR plots.status_id NOT IN (2, 3, 4, 5, 6))
        `;
      }
    }

    const selectClause = `
        SELECT 
            plots.plot_id,
            plots.plot_no,
            plots.sector_id,
            ROUND(plots.plot_height, 2) AS plot_height,
            ROUND(plots.plot_width, 2) AS plot_width,
            plots.north,
            plots.east,
            plots.south,
            plots.west,
            plots.plot_font,
            plots.status_id,
            plot_statuses.name as status_name,
            plots.create_at,
            ROUND(plots.plot_rate, 2) AS plot_rate,
            plots.project_id,
            ROUND(plots.square_feet, 2) AS square_feet,
            plots.plot_note,
            ROUND(plots.amount, 2) AS amount,
            sector.sector_name,
            projects.krutiDev_font,
            (SELECT booking_id FROM bookings WHERE plot_id = plots.plot_id AND status = 0 AND is_delete = 0 LIMIT 1) as b_id,
            (SELECT amount_a FROM bookings WHERE plot_id = plots.plot_id AND status = 0 AND is_delete = 0 LIMIT 1) as b_amount_a
    `;

    if (sector_id) {
      query = `
        ${selectClause}
        FROM plots
        LEFT JOIN sector ON plots.sector_id = sector.sector_id
        LEFT JOIN projects ON plots.project_id = projects.project_id
        LEFT JOIN plot_statuses ON plots.status_id = plot_statuses.id
        WHERE plots.is_delete = 0 
          AND plots.sector_id = ?
          ${bookingFilter}
      `;
      params = plot_id ? [sector_id, plot_id] : [sector_id];
    } else {
      query = `
        ${selectClause}
        FROM plots
        LEFT JOIN sector ON plots.sector_id = sector.sector_id
        LEFT JOIN projects ON plots.project_id = projects.project_id
        LEFT JOIN plot_statuses ON plots.status_id = plot_statuses.id
        WHERE plots.is_delete = 0 
          AND plots.project_id = ?
          ${bookingFilter}
      `;
      params = plot_id ? [project_id || '', plot_id] : [project_id || ''];
    }

    const result = await db.fetchQuery(query, params);
    const finalData = [];

    for (const plot of result) {
      // 1. Fetch Documents
      // const documents = await db.fetchQuery(
      //   `SELECT id, project_id, plot_id, type, document_date
      //    FROM documents_date
      //    WHERE project_id = ?
      //    AND plot_id = ?`,
      //   [plot.project_id, plot.plot_id]
      // );
      const documents = await db.fetchQuery(
        `SELECT id, project_id, plot_id, type, document_date
   FROM documents_date
   WHERE project_id = ?
   AND plot_id = ?
   AND is_deleted = 0`,
        [plot.project_id, plot.plot_id]
      );

      // 2. Status Logic
      let currentStatus = 'available';
      let currentStatusId = 1;

      if (plot.b_id) {
        currentStatus = 'booked';
        currentStatusId = 4;

        const receivedData = await db.fetchQuery(
          `SELECT IFNULL(SUM(amount), 0) as total 
           FROM receive_amount 
           WHERE customer_id = ? AND COALESCE(is_delete, 0) = 0`,
          [plot.b_id]
        );
        const received = receivedData[0].total || 0;
        const totalAmountA = Number(plot.b_amount_a) || 0;

        const isManagerSigned = documents.some(d => d.type === 'manager_signature');

        // ✅ NEW: Registry Signatures Check (Client/Accountant/Manager)
        const hasRegistrySignatures = documents.some(d =>
          ['registry_client_signature', 'registry_accountant_signature', 'registry_manager_signature'].includes(d.type)
        );

        const hasAgreement = documents.some(d => d.type === 'agreement');
        const hasRegistryDate = documents.some(d => d.type === 'registry');
        const hasAllotmentDate = documents.some(d => d.type === 'allotment');

        // 🔥 Updated Complete Logic (Old Conditions + Registry Signatures)
        if (
          isManagerSigned ||
          hasRegistrySignatures ||
          (totalAmountA > 0 && received >= totalAmountA) ||
          (hasAgreement && (hasRegistryDate || hasAllotmentDate))
        ) {
          currentStatus = 'completed';
          currentStatusId = -1;
        }
      }

      if (plot.status_id) {
        currentStatusId = plot.status_id;
        if (plot.status_name) {
          currentStatus = plot.status_name.toLowerCase();
        }
      }

      const { b_id, b_amount_a, ...plotData } = plot;

      finalData.push({
        ...plotData,
        status: currentStatus,
        status_id: currentStatusId,
        documents_date: documents
      });
    }

    res.json({
      success: true,
      data: finalData
    });

  } catch (error) {
    console.log(error, 'error');
    res.status(500).json({
      success: false,
      message: 'Internal Server Error'
    });
  }
};



exports.updateplots = async (req, res) => {
  const {
    plot_no,
    plot_height,
    plot_width,
    sector_id,
    north,
    east,
    south,
    west,
    plot_rate,
    plot_id,
    square_feet,
    plot_note,
    plot_font,
    updated_by_id,
    status_id
  } = req.body;

  const formattedDate = new Date().toISOString().split("T")[0];

  // 🔹 AUTO CALCULATION
  const sqft = Number(square_feet || 0);
  const rate = Number(plot_rate || 0);
  const amount = sqft * rate;

  try {
    /* ================= DUPLICATE CHECK ================= */
    const checkPlotnumber = `
      SELECT plot_id FROM plots
      WHERE plot_no = ? AND plot_id != ? AND is_delete = 0 AND sector_id = ?
    `;
    const resCheckPlot = await db.fetchQuery(checkPlotnumber, [
      plot_no,
      plot_id,
      sector_id
    ]);

    if (resCheckPlot.length > 0) {
      return res.json({
        success: false,
        message: "Plot number already exists in the selected sector"
      });
    }

    /* ================= GET OLD PLOT ================= */
    const oldPlotQuery = `SELECT status_id FROM plots WHERE plot_id = ?`;
    const oldPlot = await db.fetchQuery(oldPlotQuery, [plot_id]);
    const oldStatusId = oldPlot.length > 0 ? oldPlot[0].status_id : null;

    /* ================= UPDATE PLOT ================= */
    const updatePlotQuery = `
      UPDATE plots SET
        plot_no = ?,
        sector_id = ?,
        plot_height = ?,
        plot_width = ?,
        north = ?,
        east = ?,
        south = ?,
        west = ?,
        plot_rate = ?,
        square_feet = ?,
        amount = ?,
        plot_note = ?,
        plot_font = ?,
        status_id = ?,
        updated_by_id = ?,
        update_at = ?
      WHERE plot_id = ?
    `;

    await db.insertQuery(updatePlotQuery, [
      plot_no,
      sector_id,
      plot_height,
      plot_width,
      north || "",
      east || "",
      south || "",
      west || "",
      rate,
      sqft,
      amount,
      plot_note || "",
      plot_font ?? 0,
      status_id || null,
      updated_by_id || null,
      formattedDate,
      plot_id
    ]);

    /* ================= UPDATE BOOKING ================= */
    const updateBookingQuery = `
      UPDATE bookings SET
        square_feet_size = ?,
        square_feet_rate = ?,
        amount_a = ?
      WHERE plot_id = ? AND is_delete = 0
    `;

    await db.insertQuery(updateBookingQuery, [
      sqft,
      rate,
      amount,
      plot_id
    ]);

    /* ================= ADD STATUS HISTORY ================= */
    if (String(oldStatusId) !== String(status_id || null)) {
      const historyQuery = `
        INSERT INTO plot_status_history (plot_id, status_id, updated_by, updated_at) 
        VALUES (?, ?, ?, ?)
      `;
      await db.insertQuery(historyQuery, [plot_id, status_id || null, updated_by_id || null, new Date()]);
    }

    /* ================= RESPONSE ================= */
    res.json({
      success: true,
      message: "Plot & Booking updated successfully",
      data: {
        square_feet: sqft,
        plot_rate: rate,
        amount
      }
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Failed to update plot & booking"
    });
  }
};
exports.deletplots = async (req, res) => {
  const { plot_id, deleted_by_id } = req.body;

  if (!plot_id) {
    return res.json({
      success: false,
      message: "plot_id is required"
    });
  }

  const deletedAt = new Date();

  const updateQuery = `
    UPDATE plots SET
      is_delete = 1,
      deleted_by_id = ?,
      deleted_at = ?
    WHERE plot_id = ?
  `;

  await db.insertQuery(updateQuery, [
    deleted_by_id || null,
    deletedAt,
    plot_id
  ]);

  res.json({
    success: true,
    message: "Plot deleted successfully"
  });
};

exports.getPlotStatuses = async (req, res) => {
  try {
    const query = `SELECT * FROM plot_statuses ORDER BY id ASC`;
    const result = await db.fetchQuery(query, []);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error fetching plot statuses:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch plot statuses' });
  }
};

exports.changePlotStatus = async (req, res) => {
  try {
    const { plot_id, status_id, updated_by_id } = req.body;
    if (!plot_id) {
      return res.json({ success: false, message: 'plot_id is required' });
    }

    const oldPlotQuery = `SELECT status_id FROM plots WHERE plot_id = ?`;
    const oldPlot = await db.fetchQuery(oldPlotQuery, [plot_id]);
    const oldStatusId = oldPlot.length > 0 ? oldPlot[0].status_id : null;

    const updateAt = new Date();
    const query = `
      UPDATE plots 
      SET status_id = ?, updated_by_id = ?, update_at = ? 
      WHERE plot_id = ?
    `;

    await db.insertQuery(query, [status_id || null, updated_by_id || null, updateAt, plot_id]);

    if (String(oldStatusId) !== String(status_id || null)) {
      const historyQuery = `
        INSERT INTO plot_status_history (plot_id, status_id, updated_by, updated_at) 
        VALUES (?, ?, ?, ?)
      `;
      await db.insertQuery(historyQuery, [plot_id, status_id || null, updated_by_id || null, new Date()]);
    }
    res.json({
      success: true,
      message: 'Plot status updated successfully'
    });
  } catch (error) {
    console.error('Error updating plot status:', error);
    res.status(500).json({ success: false, message: 'Failed to update plot status' });
  }
};

exports.getPlotStatusHistory = async (req, res) => {
  try {
    const { plot_id } = req.params;
    if (!plot_id) {
      return res.json({ success: false, message: 'plot_id is required' });
    }

    const query = `
      SELECT 
        h.id, 
        h.plot_id, 
        h.updated_at, 
        s.name,
        u.name AS user_name, 
        u.email
      FROM plot_status_history h
      LEFT JOIN plot_statuses s ON h.status_id = s.id
      LEFT JOIN users u ON h.updated_by = u.user_id
      WHERE h.plot_id = ?
      ORDER BY h.updated_at DESC
    `;

    const result = await db.fetchQuery(query, [plot_id]);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error fetching plot status history:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch history' });
  }
};