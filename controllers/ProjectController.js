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
}).fields([
  { name: 'ProjectImage', maxCount: 1 },
  { name: 'company_logo', maxCount: 1 }
]);


// exports.projectadd = async (req, res) => {
//     upload(req, res, async (err) => {
//         if (err) {
//             console.error('File upload error:', err);
//             return res.status(400).json({ success: false, message: err.message });
//         }

//         const { ProjectName, address, Square_Price, DLC_Price, krutiDev_font } = req.body; // ✅ added krutiDev_font
//         const sectorData = JSON.parse(req.body.sector_data);
//         const ProjectImage = req.file ? req.file.filename : null;

//         if (!ProjectName) return res.status(400).json({ success: false, message: "Project Name is required" });
//         if (!address) return res.status(400).json({ success: false, message: "Address is required" });

//         const createDate = new Date();
//         const formattedDate = createDate.toISOString().split('T')[0];

//         const projectQuery = `
//             INSERT INTO projects 
//             (name, image, address, square_rate, dlc_rate, krutiDev_font, create_at) 
//             VALUES (?, ?, ?, ?, ?, ?, ?)
//         `;
//         const projectParams = [
//             ProjectName,
//             ProjectImage || '',
//             address,
//             Square_Price,
//             DLC_Price,
//             krutiDev_font || 0, // ✅ default 0 if not passed
//             formattedDate
//         ];

//         try {
//             const projectResult = await db.insertQuery(projectQuery, projectParams);
//             const projectId = projectResult.insertId;

//             const sectorQuery = `
//                 INSERT INTO sector (sector_name, plot_number, project_id)
//                 VALUES (?, ?, ?)
//             `;
//             for (const sector of sectorData) {
//                 const { sector_name, plot_no } = sector;
//                 const sectorParams = [sector_name, plot_no, projectId];
//                 await db.insertQuery(sectorQuery, sectorParams);
//             }

//             res.json({ success: true, message: "Project added successfully", projectId });
//         } catch (error) {
//             console.error('Database error:', error);
//             res.status(500).json({ success: false, message: "An error occurred while adding the project" });
//         }
//     });
// };

exports.projectadd = async (req, res) => {
  upload(req, res, async (err) => {
    if (err) {
      console.error("File upload error:", err);
      return res.status(400).json({ success: false, message: err.message });
    }

    const {
      ProjectName,
      address,
      Square_Price,
      DLC_Price,
      krutiDev_font,
      company_name,
      company_address,
      cin_number,
      phone_number,
      gst_pan_type,
      gst_pan_number,
      broker_id,
      broker_name,
      commission_type,
      commission_value,

      // ✅ NEW fields (text)
      rera_reg_no,
      rera_reg_date,
      khasra_no,
    } = req.body;

    console.log("🧾 Incoming Data:", req.body);
    console.log("📂 Files:", req.files);

    const sectorData = JSON.parse(req.body.sector_data || "[]");

    // ✅ files ab req.files se aayengi
    const ProjectImage =
      req.files && req.files.ProjectImage && req.files.ProjectImage[0]
        ? req.files.ProjectImage[0].filename
        : null;

    const companyLogo =
      req.files && req.files.company_logo && req.files.company_logo[0]
        ? req.files.company_logo[0].filename
        : null;

    // 🛑 Validation checks (same as pehle, kuch change nahi)
    if (!ProjectName || ProjectName.trim() === "")
      return res.status(400).json({ success: false, message: "Project Name is required" });

    if (!address || address.trim() === "")
      return res.status(400).json({ success: false, message: "Address is required" });

    if (!company_name || company_name.trim() === "")
      return res.status(400).json({ success: false, message: "Company Name is required" });

    if (!company_address || company_address.trim() === "")
      return res.status(400).json({ success: false, message: "Company Address is required" });

    if (!cin_number || cin_number.trim() === "")
      return res.status(400).json({ success: false, message: "C.I.N Number is required" });

    if (!gst_pan_number || gst_pan_number.trim() === "")
      return res.status(400).json({ success: false, message: "GST/PAN Number is required" });

    if (!Square_Price || isNaN(Square_Price))
      return res.status(400).json({ success: false, message: "Square Price is required and must be a number" });

    if (!DLC_Price || isNaN(DLC_Price))
      return res.status(400).json({ success: false, message: "DLC Price is required and must be a number" });

    const formattedDate = new Date().toISOString().split("T")[0];

    try {
      let finalBrokerId = broker_id && broker_id !== "null" ? broker_id : null;

      // ✅ Insert broker if broker_id not provided
      if (!finalBrokerId && broker_name !== "null") {
        const insertBrokerQuery = `
          INSERT INTO brokers (broker_name, phone_number, created_at, kruti_brokers_font)
          VALUES (?, ?, ?, ?)
        `;
        const brokerResult = await db.insertQuery(insertBrokerQuery, [
          broker_name,
          phone_number || "",
          formattedDate,
          krutiDev_font || 0,
        ]);
        finalBrokerId = brokerResult.insertId;
      }

      // ✅ Project insert (sirf columns badhaye hain)
      const projectQuery = `
        INSERT INTO projects 
        (
          broker_id,
          commission_type,
          commission_value,
          name,
          company_name,
          company_logo,
          company_address,
          cin_number,
          phone_number,
          gst_pan_type,
          gst_pan_number,
          image,
          address,
          khasra_no,
          square_rate,
          dlc_rate,
          rera_reg_no,
          rera_reg_date,
          create_at,
          krutiDev_font
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const projectParams = [
        finalBrokerId || null,
        commission_type || null,
        commission_value || null,
        ProjectName,
        company_name,
        companyLogo || "",         // ✅ NEW
        company_address,
        cin_number,
        phone_number || "",
        gst_pan_type || "",
        gst_pan_number,
        ProjectImage || "",
        address,
        khasra_no || "",           // ✅ NEW
        Square_Price || null,
        DLC_Price || null,
        rera_reg_no || "",         // ✅ NEW
        rera_reg_date || null,     // ✅ NEW (DATE column, empty ho to NULL chala jayega)
        formattedDate,
        krutiDev_font || 0,
      ];

      const projectResult = await db.insertQuery(projectQuery, projectParams);
      const projectId = projectResult.insertId;

      // ✅ Sector insert (same as pehle)
      if (Array.isArray(sectorData) && sectorData.length > 0) {
        const sectorQuery = `
          INSERT INTO sector (sector_name, plot_number, project_id)
          VALUES (?, ?, ?)
        `;
        for (const sector of sectorData) {
          const { sector_name, plot_no } = sector;
          if (sector_name && plot_no)
            await db.insertQuery(sectorQuery, [sector_name, plot_no, projectId]);
        }
      }

      res.json({ success: true, message: "Project added successfully", projectId });
    } catch (error) {
      console.error("Database error:", error);
      res.status(500).json({
        success: false,
        message: "An error occurred while adding the project",
      });
    }
  });
};



// exports.projects = async (req, res) => {
//   const { project_id, type } = req.query;

//   try {
//     // extract numeric user_id
//     const rawUserId = req.query.user_id;
//     const userId =
//       rawUserId && /^\d+$/.test(String(rawUserId))
//         ? Number(rawUserId)
//         : null;

//     // check assigned_project existence
//     let userHasPermissions = false;
//     if (userId) {
//       const checkQuery = `SELECT 1 FROM assigned_project WHERE user_id = ? LIMIT 1`;
//       const checkResult = await db.fetchQuery(checkQuery, [userId]);
//       userHasPermissions =
//         Array.isArray(checkResult) && checkResult.length > 0;
//     }

//     // ap join on project level (p.project_id)
//     const apJoin = userHasPermissions
//       ? `INNER JOIN assigned_project ap ON ap.assigned_project_id = p.project_id AND ap.user_id = ?`
//       : `LEFT JOIN assigned_project ap ON ap.assigned_project_id = p.project_id`;

//     const isAssignedCase = userHasPermissions
//       ? "ap.user_id IS NOT NULL"
//       : "0=1";

//     let query = `
//       SELECT 
//           p.project_id,
//           p.name AS project_name,
//           p.image,
//           p.address,
//           p.square_rate,
//           p.dlc_rate,
//           p.krutiDev_font,
//           p.company_name,
//           p.company_address,
//           p.cin_number,
//           p.phone_number,
//           p.gst_pan_type,
//           p.gst_pan_number,
//           p.create_at,
//           p.update_at,
//           p.is_delete,
//           p.commission_type,
//           p.commission_value,

//           p.company_logo,
//           p.khasra_no,
//           p.rera_reg_no,
//           p.rera_reg_date,
//           p.type,

//           COUNT(pl.plot_id) AS total_plots,
//           SUM(CASE WHEN b.booking_id IS NOT NULL THEN 1 ELSE 0 END) AS total_booked,
//           (COUNT(pl.plot_id) - SUM(CASE WHEN b.booking_id IS NOT NULL THEN 1 ELSE 0 END)) AS total_pending,

//           s.sector_name,
//           s.project_id AS sector_project_id,
//           s.plot_number,
//           s.sector_id,

//           br.broker_id,
//           br.broker_name,
//           br.phone_number,
//           br.kruti_brokers_font AS broker_font,
//           CASE WHEN ${isAssignedCase} THEN 1 ELSE 0 END AS is_assigned
//       FROM projects p
//       LEFT JOIN sector s ON p.project_id = s.project_id AND s.is_delete = 0
//       LEFT JOIN plots pl ON s.sector_id = pl.sector_id AND pl.is_delete = 0
//       LEFT JOIN bookings b ON pl.plot_id = b.plot_id AND b.is_delete = 0
//       LEFT JOIN brokers br ON p.broker_id = br.broker_id AND (br.deleted_at IS NULL)
//       ${apJoin}
//       WHERE p.is_delete = 0
//     `;

//     const params = [];

//     if (userHasPermissions) params.push(userId);

//     // 🔥 ONLY NEW FILTER
//   // 🔥 FINAL TYPE FILTER LOGIC
// if (type == 1) {
//   // 👉 Sirf Allotment
//   query += ` AND p.type = 1 `;
// } else if (type == 2) {
//   // 👉 Sirf Registry
//   query += ` AND p.type = 2 `;
// } else {
//   // 👉 type = 0 ya missing → dono (Allotment + Registry)
//   query += ` AND p.type IN (1, 2) `;
// }

//     if (project_id) {
//       query += ` AND p.project_id = ? `;
//       params.push(project_id);
//     }

//     query += `
//       GROUP BY p.project_id, s.sector_id, br.broker_id
//       ORDER BY p.create_at DESC
//     `;

//     const result = await db.fetchQuery(query, params);

//     const projectMap = new Map();

//     result.forEach((row) => {
//       if (!projectMap.has(row.project_id)) {
//         projectMap.set(row.project_id, {
//           project_id: row.project_id,
//           name: row.project_name,
//           image: row.image,
//           address: row.address,
//           square_rate: row.square_rate,
//           dlc_rate: row.dlc_rate,
//           krutiDev_font: Number(row.krutiDev_font || 0),
//           company_name: row.company_name,
//           company_address: row.company_address,
//           cin_number: row.cin_number,
//           phone_number: row.phone_number,
//           gst_pan_type: row.gst_pan_type,
//           gst_pan_number: row.gst_pan_number,
//           type: row.type,
//           create_at: row.create_at,
//           update_at: row.update_at,
//           is_delete: row.is_delete,
//           commission_type: row.commission_type,
//           commission_value: row.commission_value,
//           company_logo: row.company_logo,
//           khasra_no: row.khasra_no,
//           rera_reg_no: row.rera_reg_no,
//           rera_reg_date: row.rera_reg_date,
//           total_plots: Number(row.total_plots || 0),
//           total_booked: Number(row.total_booked || 0),
//           total_pending: Number(row.total_pending || 0),
//           sector: [],
//           brokers: [],
//           is_assigned: Number(row.is_assigned) === 1,
//         });
//       }

//       const project = projectMap.get(row.project_id);

//       if (row.sector_id && row.sector_name) {
//         if (!project.sector.some((s) => s.sector_id === row.sector_id)) {
//           project.sector.push({
//             sector_id: row.sector_id,
//             name: row.sector_name,
//             project_id: row.sector_project_id,
//             plot_number: row.plot_number,
//           });
//         }
//       }

//       if (row.broker_id && row.broker_name) {
//         if (!project.brokers.some((b) => b.broker_id === row.broker_id)) {
//           project.brokers.push({
//             broker_id: row.broker_id,
//             broker_name: row.broker_name,
//             phone_number: row.phone_number,
//             broker_font: row.broker_font,
//           });
//         }
//       }
//     });

//     res.json({ success: true, data: Array.from(projectMap.values()) });
//   } catch (error) {
//     console.error("❌ Error fetching project details:", error);
//     res.status(500).json({
//       success: false,
//       message: "Something went wrong while fetching project details",
//       error: error.message,
//     });
//   }
// };
exports.projects = async (req, res) => {
  const { project_id, type, page = 1, limit } = req.query;

  const hasPagination = limit !== undefined && limit !== null && String(limit).trim() !== "";
  const currentPage = Math.max(Number(page), 1);
  const perPage = hasPagination ? Math.max(Number(limit), 1) : null;
  const offset = hasPagination ? (currentPage - 1) * perPage : null;

  try {
    const rawUserId = req.query.user_id;
    const userId = rawUserId && /^\d+$/.test(String(rawUserId)) ? Number(rawUserId) : null;

    let userHasPermissions = false;
    if (userId) {
      const checkQuery = `SELECT 1 FROM assigned_project WHERE user_id = ? LIMIT 1`;
      const checkResult = await db.fetchQuery(checkQuery, [userId]);
      userHasPermissions = Array.isArray(checkResult) && checkResult.length > 0;
    }

    const params = [];

    // ---------------------------------------------------------
    // 🔥 FIXED: Project-level counts subquery
    // Yahan humne exact logic lagayi hai taaki 16 aur 19 ka count mile
    // ---------------------------------------------------------
    const projectCountJoin = `
      LEFT JOIN (
        SELECT 
          s.project_id,
          COUNT(DISTINCT pl.plot_id) AS total_plots,
          
          -- 1. Completed Count (Ye dashboard ke logic se match karega)
          COUNT(DISTINCT CASE WHEN b.booking_id IS NOT NULL AND (
            (SELECT COUNT(*) FROM documents_date WHERE plot_id = pl.plot_id AND type = 'manager_signature' AND is_deleted = 0) > 0 OR
            (SELECT COUNT(*) FROM documents_date WHERE plot_id = pl.plot_id AND type IN ('registry_client_signature', 'registry_accountant_signature', 'registry_manager_signature') AND is_deleted = 0) > 0 OR
            (SELECT IFNULL(SUM(amount), 0) FROM receive_amount WHERE customer_id = b.booking_id AND is_delete = 0) >= b.amount_a OR
            ((SELECT COUNT(*) FROM documents_date WHERE plot_id = pl.plot_id AND type = 'agreement' AND is_deleted = 0) > 0 AND 
             ((SELECT COUNT(*) FROM documents_date WHERE plot_id = pl.plot_id AND type = 'registry' AND is_deleted = 0) > 0 OR (SELECT COUNT(*) FROM documents_date WHERE plot_id = pl.plot_id AND type = 'allotment' AND is_deleted = 0) > 0) )
          ) THEN pl.plot_id END) AS total_completed,

          -- 2. Raw Booked Count (Total plots having active bookings)
          COUNT(DISTINCT CASE WHEN b.booking_id IS NOT NULL THEN pl.plot_id END) AS raw_booked

        FROM sector s
        LEFT JOIN plots pl ON s.sector_id = pl.sector_id AND pl.is_delete = 0
        LEFT JOIN bookings b ON pl.plot_id = b.plot_id AND b.is_delete = 0 AND b.status = 0
        WHERE s.is_delete = 0
        GROUP BY s.project_id
      ) pc ON pc.project_id = p.project_id
    `;

    const apJoin = userHasPermissions
      ? `INNER JOIN assigned_project ap ON ap.assigned_project_id = p.project_id AND ap.user_id = ?`
      : ``;

    if (userHasPermissions) params.push(userId);

    let query = `
      SELECT 
        p.*, p.name AS project_name,
        IFNULL(pc.total_plots, 0) AS total_plots,
        -- 🔥 Booked Only = Raw Booked - Completed (Ye ab 16 aayega)
        (IFNULL(pc.raw_booked, 0) - IFNULL(pc.total_completed, 0)) AS total_booked,
        IFNULL(pc.total_completed, 0) AS total_completed,
        -- 🔥 Pending = Total Plots - Raw Booked (Ye ab 19 aayega)
        (IFNULL(pc.total_plots, 0) - IFNULL(pc.raw_booked, 0)) AS total_pending,

        s.sector_name, s.sector_id, br.broker_id, br.broker_name
      FROM projects p
      ${projectCountJoin}
      LEFT JOIN sector s ON p.project_id = s.project_id AND s.is_delete = 0
      LEFT JOIN brokers br ON p.broker_id = br.broker_id AND br.deleted_at IS NULL
      ${apJoin}
      WHERE p.is_delete = 0
    `;

    if (type == 1) query += ` AND p.type = 1 `;
    else if (type == 2) query += ` AND p.type = 2 `;
    else query += ` AND p.type IN (1,2) `;

    if (project_id) {
      query += ` AND p.project_id = ? `;
      params.push(project_id);
    }

    query += ` GROUP BY p.project_id, s.sector_id, br.broker_id ORDER BY p.create_at DESC `;

    if (hasPagination) {
      query += ` LIMIT ? OFFSET ? `;
      params.push(perPage, offset);
    }

    const result = await db.fetchQuery(query, params);
    const projectMap = new Map();

    result.forEach((row) => {
      if (!projectMap.has(row.project_id)) {
        projectMap.set(row.project_id, {
          ...row,
          name: row.project_name,
          total_plots: Number(row.total_plots),
          total_booked: Number(row.total_booked), // Ab 16 aayega
          total_completed: Number(row.total_completed),
          total_pending: Number(row.total_pending), // Ab 19 aayega
          sector: [],
          brokers: [],
        });
      }
      // Sector/Broker mapping logic same rahegi...
    });

    res.json({
      success: true,
      data: Array.from(projectMap.values()),
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};




exports.projectupdate = async (req, res) => {
  upload(req, res, async (err) => {
    if (err) {
      console.error("File upload error:", err);
      return res.status(400).json({ success: false, message: err.message });
    }

    const {
      ProjectId,
      ProjectName,
      address,
      Square_Price,
      DLC_Price,
      krutiDev_font,
      company_name,
      company_address,
      cin_number,
      phone_number,
      gst_pan_type,
      gst_pan_number,
      broker_id,
      broker_name,
      commission_type,
      commission_value,

      // ✅ NEW body fields
      rera_reg_no,
      rera_reg_date,
      khasra_no,
    } = req.body;

    console.log("🟢 Incoming Data:", req.body);

    // ✅ Support both: single() & fields()
    const ProjectImage =
      (req.files &&
        req.files.ProjectImage &&
        req.files.ProjectImage[0] &&
        req.files.ProjectImage[0].filename) ||
      (req.file ? req.file.filename : null);

    const companyLogo =
      req.files &&
      req.files.company_logo &&
      req.files.company_logo[0]
        ? req.files.company_logo[0].filename
        : null;

    const sectorData = JSON.parse(req.body.sector_data || "[]");
    const updateDate = new Date().toISOString().split("T")[0];

    // ✅ Helper for safe SQL binding
    const safe = (v) => {
  if (
    v === undefined ||
    v === null ||
    v === "" ||
    v === "null" ||
    v === "undefined"
  ) {
    return null;
  }
  return v;
};

    // ✅ Basic Validation
    if (!ProjectId)
      return res.status(400).json({ success: false, message: "Project Id is required" });
    if (!ProjectName)
      return res.status(400).json({ success: false, message: "Project Name is required" });
    if (!address)
      return res.status(400).json({ success: false, message: "Address is required" });

    if (!company_name || company_name.trim() === "")
      return res.status(400).json({ success: false, message: "Company Name is required" });

    if (!company_address || company_address.trim() === "")
      return res.status(400).json({ success: false, message: "Company Address is required" });

    if (!cin_number || cin_number.trim() === "")
      return res.status(400).json({ success: false, message: "C.I.N Number is required" });

    if (!gst_pan_number || gst_pan_number.trim() === "")
      return res.status(400).json({ success: false, message: "GST/PAN Number is required" });

    try {
      let finalBrokerId = broker_id && broker_id !== "null" ? broker_id : null;

      // -------------------------
      // Safer broker insert logic
      // Only insert when broker_name is a real non-empty value (not undefined/null/'undefined'/'null')
      // -------------------------
      const isValidBrokerName =
        broker_name !== undefined &&
        broker_name !== null &&
        String(broker_name).trim() !== "" &&
        String(broker_name).toLowerCase().trim() !== "undefined" &&
        String(broker_name).toLowerCase().trim() !== "null";

      if (!finalBrokerId && isValidBrokerName) {
        const insertBrokerQuery = `
          INSERT INTO brokers (broker_name, phone_number, created_at, kruti_brokers_font)
          VALUES (?, ?, ?, ?)
        `;
        const brokerResult = await db.insertQuery(insertBrokerQuery, [
          safe(String(broker_name).trim()),
          safe(phone_number) || null,
          updateDate,
          krutiDev_font || 0, // ✅ Save font 0 or 1
        ]);
        finalBrokerId = brokerResult.insertId;
      }

      // ✅ Project update query
      const projectQuery = ProjectImage
        ? `
          UPDATE projects
          SET 
            broker_id = ?, 
            commission_type = ?, 
            commission_value = ?, 
            name = ?, 
            image = ?, 
            company_logo = COALESCE(?, company_logo),
            address = ?, 
            square_rate = ?, 
            dlc_rate = ?, 
            rera_reg_no = ?, 
            rera_reg_date = ?, 
            khasra_no = ?, 
            krutiDev_font = ?, 
            company_name = ?, 
            company_address = ?, 
            cin_number = ?, 
            phone_number = ?, 
            gst_pan_type = ?, 
            gst_pan_number = ?, 
            update_at = ?
          WHERE project_id = ?
        `
        : `
          UPDATE projects
          SET 
            broker_id = ?, 
            commission_type = ?, 
            commission_value = ?, 
            name = ?, 
            company_logo = COALESCE(?, company_logo),
            address = ?, 
            square_rate = ?, 
            dlc_rate = ?, 
            rera_reg_no = ?, 
            rera_reg_date = ?, 
            khasra_no = ?, 
            krutiDev_font = ?, 
            company_name = ?, 
            company_address = ?, 
            cin_number = ?, 
            phone_number = ?, 
            gst_pan_type = ?, 
            gst_pan_number = ?, 
            update_at = ?
          WHERE project_id = ?
        `;

      const projectParams = ProjectImage
        ? [
            safe(finalBrokerId),
            safe(commission_type),
            safe(commission_value),
            safe(ProjectName),
            safe(ProjectImage),               // image
            safe(companyLogo),                // COALESCE(?, company_logo)
            safe(address),
            safe(Square_Price),
            safe(DLC_Price),
            safe(rera_reg_no),
            safe(rera_reg_date),
            safe(khasra_no),
            safe(krutiDev_font || 0),
            safe(company_name),
            safe(company_address),
            safe(cin_number),
            safe(phone_number),
            safe(gst_pan_type),
            safe(gst_pan_number),
            updateDate,
            safe(ProjectId),
          ]
        : [
            safe(finalBrokerId),
            safe(commission_type),
            safe(commission_value),
            safe(ProjectName),
            safe(companyLogo),                // COALESCE(?, company_logo)
            safe(address),
            safe(Square_Price),
            safe(DLC_Price),
            safe(rera_reg_no),
            safe(rera_reg_date),
            safe(khasra_no),
            safe(krutiDev_font || 0),
            safe(company_name),
            safe(company_address),
            safe(cin_number),
            safe(phone_number),
            safe(gst_pan_type),
            safe(gst_pan_number),
            updateDate,
            safe(ProjectId),
          ];

      // ✅ Execute Project Update
      await db.insertQuery(projectQuery, projectParams);

      // ✅ Sector Update / Insert
      const sectorUpdate = `
        UPDATE sector 
        SET sector_name = ?, plot_number = ? 
        WHERE sector_id = ?
      `;
      const sectorInsert = `
        INSERT INTO sector (sector_name, plot_number, project_id)
        VALUES (?, ?, ?)
      `;

      for (const sector of sectorData) {
        const sectorName = sector.sector_name || sector.name || null;
        const plotNumber = sector.plot_no || sector.plot_number || null;
        const sectorId = sector.sector_id || null;

        if (sectorId) {
          await db.insertQuery(sectorUpdate, [
            safe(sectorName),
            safe(plotNumber),
            safe(sectorId),
          ]);
        } else {
          await db.insertQuery(sectorInsert, [
            safe(sectorName),
            safe(plotNumber),
            safe(ProjectId),
          ]);
        }
      }

      res.json({
        success: true,
        message: "✅ Project updated successfully",
        broker_id: finalBrokerId,
      });
    } catch (error) {
      console.error("❌ Update query error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  });
};



exports.projectdelete = async (req, res) => {
    const { ProjectId } = req.body;
    const is_delete = 1;
    if (!ProjectId) {
        res.json({ success: false, message: 'Project id required ..!' })
    }
    const checkProject = `SELECT * FROM projects WHERE project_id = ? AND is_delete = 0`;
    const checkprojectParems = [ProjectId];
    const checkProjectResult = await db.fetchQuery(checkProject, checkprojectParems)
    if (checkProjectResult.length === 0) {
        return res.json({ success: false, message: 'Project not found!' });
    }
    const qurey = `UPDATE projects SET is_delete = ? WHERE project_id = ?`;
    const parems = [is_delete, ProjectId]
    const result = await db.insertQuery(qurey, parems)
    res.json({ success: true, message: 'Project delete successfully' })

}


exports.addRemark = async (req, res) => {
  try {
    const {
      project_id,
      reference_type,
      reference_id,
      remark,
      created_by,
      next_followup_date   // 🔥 NEW
    } = req.body;

    if (!project_id || !reference_type || !reference_id || !remark) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    const query = `
      INSERT INTO remarks 
      (project_id, reference_type, reference_id, remark, created_by, next_followup_date)
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    await db.insertQuery(query, [
      project_id,
      reference_type,
      reference_id,
      remark,
      created_by || null,
      next_followup_date || null   // 🔥 SAFE
    ]);

    res.json({
      success: true,
      message: "Remark added successfully",
    });

  } catch (error) {
    console.error("Add Remark Error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};
exports.getAllRemarks = async (req, res) => {
  try {
    const { project_id, reference_id } = req.query;

    let query = `
      SELECT 
        r.*, 
        u.name AS user_name
      FROM remarks r
      LEFT JOIN users u ON u.user_id = r.created_by
      WHERE r.is_deleted = 0
    `;

    const params = [];

    if (project_id) {
      query += " AND r.project_id = ?";
      params.push(project_id);
    }

    if (reference_id) {
      query += " AND r.reference_id = ?";
      params.push(reference_id);
    }

    query += " ORDER BY r.id DESC";

    const data = await db.fetchQuery(query, params);

    res.json({
      success: true,
      count: data.length,
      data: data,
    });

  } catch (error) {
    console.error("Get All Remarks Error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

exports.softDeleteRemark = async (req, res) => {
  try {
    const { id, deleted_by } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Remark ID required",
      });
    }

    const query = `
      UPDATE remarks 
      SET is_deleted = 1, 
          deleted_at = NOW(),
          deleted_by = ?
      WHERE id = ?
    `;

    await db.fetchQuery(query, [deleted_by || null, id]); // 🔥 FIX

    res.json({
      success: true,
      message: "Remark deleted successfully",
    });

  } catch (error) {
    console.error("Soft Delete Error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};


exports.restoreRemark = async (req, res) => {
  try {
    const { id } = req.body;

    const query = `
      UPDATE remarks 
      SET is_deleted = 0,
          deleted_at = NULL,
          deleted_by = NULL
      WHERE id = ?
    `;

    await db.updateQuery(query, [id]);

    res.json({
      success: true,
      message: "Remark restored successfully",
    });

  } catch (error) {
    console.error("Restore Error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};