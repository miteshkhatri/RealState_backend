const db = require('../utils/helpers');

exports.DashboardData = async (req, res) => {
  try {
    const joinQuery = `
      SELECT
        -- total projects
        (SELECT COUNT(*) FROM projects WHERE is_delete = 0) AS total_projects,

        -- total bookings (unique plots)
        (SELECT COUNT(DISTINCT plot_id)
         FROM bookings
         WHERE is_delete = 0 AND status = 0) AS total_bookings,

        -- raw receive (ignore)
        (
          SELECT IFNULL(SUM(amount),0)
          FROM receive_amount
          WHERE is_delete = 0
        ) AS total_receive_amount,

        -- pre booking
        (SELECT COUNT(*) FROM pre_booking WHERE is_delete = 0) AS total_pre_booking,

        -- ✅ booked (latest booking per plot)
        (
          SELECT SUM(amount_per_plot) FROM (
            SELECT plot_id, MAX(amount_a) AS amount_per_plot
            FROM bookings
            WHERE is_delete = 0 AND status = 0
            GROUP BY plot_id
          ) t
        ) AS total_booked_amount_dedup,

        -- ✅ FINAL RECEIVED (ONLY latest booking per plot)
        (
          SELECT SUM(amount_per_plot) FROM (
            SELECT 
              b.plot_id,
              IFNULL(SUM(r.amount),0) AS amount_per_plot
            FROM bookings b
            LEFT JOIN receive_amount r
              ON r.customer_id = b.booking_id AND r.is_delete = 0
            WHERE b.is_delete = 0
              AND b.status = 0
              AND b.booking_id = (
                SELECT MAX(b2.booking_id)
                FROM bookings b2
                WHERE b2.plot_id = b.plot_id
                  AND b2.is_delete = 0
                  AND b2.status = 0
              )
            GROUP BY b.plot_id
          ) t
        ) AS total_received_amount_dedup,

        -- ✅ FINAL PENDING
        (
          (
            SELECT SUM(amount_per_plot) FROM (
              SELECT plot_id, MAX(amount_a) AS amount_per_plot
              FROM bookings
              WHERE is_delete = 0 AND status = 0
              GROUP BY plot_id
            ) t1
          )
          -
          (
            SELECT SUM(amount_per_plot) FROM (
              SELECT 
                b.plot_id,
                IFNULL(SUM(r.amount),0) AS amount_per_plot
              FROM bookings b
              LEFT JOIN receive_amount r
                ON r.customer_id = b.booking_id AND r.is_delete = 0
              WHERE b.is_delete = 0
                AND b.status = 0
                AND b.booking_id = (
                  SELECT MAX(b2.booking_id)
                  FROM bookings b2
                  WHERE b2.plot_id = b.plot_id
                    AND b2.is_delete = 0
                    AND b2.status = 0
                )
              GROUP BY b.plot_id
            ) t2
          )
        ) AS total_pending_amount,

        -- ✅ TODAY RECEIVED AMOUNT
        (
          SELECT IFNULL(SUM(amount), 0)
          FROM receive_amount
          WHERE is_delete = 0
            AND DATE(created_at) = CURDATE()
        ) AS today_received_amount,

        -- ✅ TODAY BOOKED PLOTS (unique)
        (
          SELECT COUNT(DISTINCT plot_id)
          FROM bookings
          WHERE is_delete = 0
            AND status = 0
            AND DATE(create_at) = CURDATE()
        ) AS today_booked_count

      FROM dual;
    `;

    const result = await db.fetchQuery(joinQuery);
    const row = result && result[0] ? result[0] : {};

    return res.status(200).json({
      success: true,
      totalProjects: Number(row.total_projects || 0),
      totalBookings: Number(row.total_bookings || 0),
      total_pre_booking: Number(row.total_pre_booking || 0),
      total_booked_amount: Number(row.total_booked_amount_dedup || 0),

      // raw
      total_receive_amount: Number(row.total_receive_amount || 0),

      // correct
      total_received_amount_dedup: Number(row.total_received_amount_dedup || 0),
      total_pending_amount: Number(row.total_pending_amount || 0),

      // ✅ new
      today_received_amount: Number(row.today_received_amount || 0),
      today_booked_count: Number(row.today_booked_count || 0)
    });

  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    return res.status(500).json({
      message: 'Error fetching dashboard data',
      error: error.message
    });
  }
};





exports.projectData = async (req, res) => {
  try {
    const rawUserId = req.query.user_id;
    const userId = rawUserId && /^\d+$/.test(String(rawUserId)) ? Number(rawUserId) : null;

    let userHasAssignedProjects = false;
    if (userId) {
      const checkRes = await db.fetchQuery(`SELECT COUNT(*) AS cnt FROM assigned_project WHERE user_id = ${userId}`);
      userHasAssignedProjects = !!(checkRes && checkRes[0] && Number(checkRes[0].cnt) > 0);
    }

    let projectWhere = `p.is_delete = 0`;
    if (userId && userHasAssignedProjects) {
      projectWhere += ` AND p.project_id IN (SELECT assigned_project_id FROM assigned_project WHERE user_id = ${userId})`;
    }

    const projects = await db.fetchQuery(`SELECT project_id, name as project_name, krutiDev_font FROM projects p WHERE ${projectWhere} ORDER BY p.project_id`);

    if (!projects || projects.length === 0) {
      return res.status(200).json({ success: true, data: [] });
    }

    const projectIds = projects.map(p => p.project_id);

    const plotsData = await db.fetchQuery(`
      SELECT 
        p.plot_id, p.project_id, p.plot_no,
        b.booking_id, b.amount_a,
        (SELECT IFNULL(SUM(amount), 0) FROM receive_amount WHERE customer_id = b.booking_id AND is_delete = 0) as total_received,
        (SELECT IFNULL(SUM(amount), 0) FROM receive_amount 
          WHERE customer_id = b.booking_id 
          AND is_delete = 0 
         AND DATE(created_at) = CURDATE()) as today_received,
        (SELECT IFNULL(SUM(amount_a), 0) FROM bookings 
          WHERE plot_id = p.plot_id 
          AND is_delete = 0 
          AND status = 0
          AND DATE(create_at) = CURDATE()) as today_booked_amount,
        (SELECT COUNT(*) FROM bookings 
          WHERE plot_id = p.plot_id 
          AND is_delete = 0 
          AND status = 0
          AND DATE(create_at) = CURDATE()) as today_booked_count,
        (SELECT GROUP_CONCAT(type) 
        FROM documents_date WHERE plot_id = p.plot_id AND is_deleted = 0) as doc_types
      FROM plots p
      LEFT JOIN bookings b ON b.plot_id = p.plot_id AND b.is_delete = 0 AND b.status = 0
      WHERE p.project_id IN (${projectIds.join(',')}) AND p.is_delete = 0
      GROUP BY p.plot_id
    `);

    const finalData = projects.map(project => {
      const projectPlots = plotsData.filter(plot => plot.project_id === project.project_id);
      
      let total_plots = projectPlots.length;
      let total_completed = 0;
      let total_booked = 0;
      let total_booked_amount = 0;
      let total_received_amount = 0;
      let total_today_received = 0;
      let total_today_booked_amount = 0;
      let total_today_booked = 0;
      
      let uniquePlotNumbers = new Set();

      projectPlots.forEach(plot => {
        uniquePlotNumbers.add(plot.plot_no);
        
        if (plot.booking_id) {
          const docs = plot.doc_types ? plot.doc_types.split(',') : [];
          const received = Number(plot.total_received || 0);
          const amountA = Number(plot.amount_a || 0);
          const todayReceived = Number(plot.today_received || 0);
          const todayBookedAmount = Number(plot.today_booked_amount || 0);
          const todayBookedCount = Number(plot.today_booked_count || 0);

          const isComplete = 
            docs.includes('manager_signature') || 
            docs.some(t => ['registry_client_signature', 'registry_accountant_signature', 'registry_manager_signature'].includes(t)) ||
            (amountA > 0 && received >= amountA) ||
            (docs.includes('agreement') && (docs.includes('registry') || docs.includes('allotment')));

          if (isComplete) {
            total_completed++;
          } else {
            total_booked++;
          }

          total_booked_amount += amountA;
          total_received_amount += received;
          total_today_received += todayReceived;
          total_today_booked_amount += todayBookedAmount;

          // ✅ FIX: Ek plot ek baar count hoga, chahe kitni bhi bookings hon
          if (todayBookedCount > 0) {
            total_today_booked++;
          }
        }
      });

      return {
        project_id: project.project_id,
        project_name: project.project_name,
        krutiDev_font: Number(project.krutiDev_font) === 1,
        total_plots,
        total_booked, 
        total_completed, 
        total_pending_plots: Math.max(0, total_plots - (total_booked + total_completed)),
        plot_numbers: Array.from(uniquePlotNumbers).sort((a, b) => a - b).join(', '),
        total_booked_amount,
        total_received_amount,
        pending_amount: Math.max(0, total_booked_amount - total_received_amount),
        total_today_received,
        total_today_booked_amount,
        today_pending_amount: Math.max(0, total_today_booked_amount - total_today_received),
        total_today_booked
      };
    });

    res.status(200).json({ success: true, data: finalData });

  } catch (error) {
    console.error('❌ ProjectData Logic Error:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

exports.getCompletedAmountAUsers = async (req, res) => {
  const { project_id, page = 1, limit = 10, sort = "" } = req.query;

  if (!project_id) {
    return res.json({ success: false, message: "project_id required", data: [] });
  }

  let sortCols = [];
  try {
    if (sort) sortCols = JSON.parse(decodeURIComponent(sort));
  } catch (e) {
    sortCols = [];
  }

  const allowedKeys = {
    plot_no: { field: "plot_no", type: "string" },
    customer_name: { field: "customer_name", type: "string" },
    plot_size: { field: "plot_size", type: "number" },
    agreement_date: { field: "agreement_date", type: "date" },
    registry_date: { field: "registry_date", type: "date" },
    total_amount: { field: "total_amount", type: "number" },
  };

  try {
    const rows = await db.fetchQuery(
      `
      SELECT 
        b.booking_id,
        b.customer_name,
        b.amount_a,
        b.plot_id,
        p.plot_no,
        p.square_feet,
        b.krutiDev_font AS booked_krutiDev_font,
        IFNULL(SUM(r.amount), 0) AS total_received
      FROM bookings b
      LEFT JOIN plots p ON b.plot_id = p.plot_id
      LEFT JOIN receive_amount r 
        ON b.booking_id = r.customer_id
        AND COALESCE(r.is_delete, 0) = 0
      WHERE b.project_id = ?
      AND b.is_delete = 0
      AND b.status = 0
      GROUP BY b.booking_id
      `,
      [project_id]
    );

    const data = [];
    const seenPlots = new Set();

    for (const r of rows) {
      if (seenPlots.has(r.plot_id)) continue;

      const totalAmount = Number(r.amount_a) || 0;
      const received = Number(r.total_received) || 0;

      const sigCheck = await db.fetchQuery(
        `SELECT COUNT(*) as total 
         FROM documents_date
         WHERE project_id = ? 
         AND plot_id = ? 
         AND type = 'manager_signature'
         AND is_deleted = 0`,
        [project_id, r.plot_id]
      );

      const isManagerSigned = sigCheck[0].total > 0;

      const regSigCheck = await db.fetchQuery(
        `SELECT COUNT(*) as total 
         FROM documents_date
         WHERE project_id = ? 
         AND plot_id = ? 
         AND type IN (
           'registry_client_signature',
           'registry_accountant_signature',
           'registry_manager_signature'
         )
         AND is_deleted = 0`,
        [project_id, r.plot_id]
      );

      const hasRegistrySignatures = regSigCheck[0].total > 0;

      const docsRows = await db.fetchQuery(
        `SELECT type, document_date, id 
         FROM documents_date
         WHERE project_id = ? 
         AND plot_id = ?
         AND is_deleted = 0`,
        [project_id, r.plot_id]
      );

      const registry_date =
        docsRows.find((d) => d.type === "registry")?.document_date || null;

      const agreement_date =
        docsRows.find((d) => d.type === "agreement")?.document_date || null;

      const allotment_date =
        docsRows.find((d) => d.type === "allotment")?.document_date || null;

      if (
        !isManagerSigned &&
        !hasRegistrySignatures &&
        received < totalAmount &&
        !(agreement_date && (registry_date || allotment_date))
      ) {
        continue;
      }

      seenPlots.add(r.plot_id);

      data.push({
        booking_id: r.booking_id,
        customer_name: r.customer_name,
        booked_krutiDev_font: r.booked_krutiDev_font,
        project_id: project_id,
        plot_id: r.plot_id,
        plot_no: r.plot_no,
        plot_size: r.square_feet,
        agreement_date: agreement_date,
        registry_date: registry_date,
        allotment_date: allotment_date,
        total_amount: totalAmount,
        received_amount: received,
        remaining_amount: Math.max(totalAmount - received, 0),
        extra_paid: Math.max(received - totalAmount, 0),
        is_manager_signed: isManagerSigned,
        is_registry_signed: hasRegistrySignatures,
        documents_date: docsRows,
      });
    }

    const grand_total_amount = data.reduce(
      (sum, d) => sum + (Number(d.total_amount) || 0),
      0
    );

    const grand_received_amount = data.reduce(
      (sum, d) => sum + (Number(d.received_amount) || 0),
      0
    );

    const grand_pending_amount = data.reduce(
      (sum, d) => sum + (Number(d.remaining_amount) || 0),
      0
    );

    if (sortCols.length > 0) {
      data.sort((a, b) => {
        for (const sc of sortCols) {
          const colInfo = allowedKeys[sc.key];
          if (!colInfo) continue;

          const dir = sc.dir === "desc" ? -1 : 1;
          let valA = a[colInfo.field];
          let valB = b[colInfo.field];
          let result = 0;

          if (colInfo.type === "string") {
            if (sc.key === "plot_no") {
              result = (valA || "").localeCompare(valB || "", undefined, {
                numeric: true,
              });
            } else {
              result = (valA || "")
                .toString()
                .localeCompare((valB || "").toString());
            }
          } else if (colInfo.type === "number") {
            result = (Number(valA) || 0) - (Number(valB) || 0);
          } else if (colInfo.type === "date") {
            const da = valA ? new Date(valA).getTime() : 0;
            const db2 = valB ? new Date(valB).getTime() : 0;
            result = da - db2;
          }

          if (result !== 0) return result * dir;
        }
        return 0;
      });
    }

    const pageNo = parseInt(page);
    const limitNo = parseInt(limit);
    const total_records = data.length;

    const paginatedData = data.slice(
      (pageNo - 1) * limitNo,
      pageNo * limitNo
    );

    return res.json({
      success: true,
      count: total_records,
      grand_total_amount,
      grand_received_amount,
      grand_pending_amount,
      data: paginatedData,
    });
  } catch (error) {
    console.error("❌ getCompletedAmountAUsers Error:", error);
    return res.json({
      success: false,
      message: "Error fetching users",
      data: [],
    });
  }
};


exports.ProjectDetails = async (req, res) => {
  const { project_id, filter } = req.query;

  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.max(parseInt(req.query.limit) || 10, 1);
  const offset = (page - 1) * limit;

  const allowedWithoutProject = new Set(["today", "today_received"]);
  const filterValue = filter || "all";

  if (!project_id && !allowedWithoutProject.has(filterValue)) {
    return res.status(400).json({ success: false, message: "project_id is required" });
  }

  try {
    const projectId = (project_id && project_id !== 'null') ? Number(project_id) : null;

    if (project_id && isNaN(projectId)) {
      return res.status(400).json({ success: false, message: "Invalid project_id" });
    }

    const allowedFilters = new Set(["all", "booked", "available", "completed", "sold", "pending", "today", "today_received", undefined, null, ""]);
    const safeFilter = allowedFilters.has(filterValue) ? filterValue : "all";

    const projectCondition = projectId ? `AND plots.project_id = ?` : ``;
    const queryParams = projectId ? [projectId] : [];

    let baseQuery = `
      SELECT 
        plots.*, sector.sector_name, projects.krutiDev_font AS project_font, projects.name AS project_name,
        b.booking_id, b.customer_name, b.customer_father_name, b.customer_age, b.customer_address, 
        b.mobile_no, b.adhar_number, b.pan_number, b.broker_id, bk.broker_name, b.broker_number, 
        b.commission_type, b.commission_value, b.square_feet_size, b.square_feet_rate, 
        b.booking_amount, b.amount_a, b.welcome AS amount_b, b.payment_mode, b.payment_time, 
        b.agreement_date, b.register_date, b.refer, b.additional_comment, b.status AS booking_status, 
        b.type, b.check_no, b.branch_name, b.check_date, b.bank_name, b.relation_prefix, 
        b.booking_date, b.custom_field, b.krutiDev_font AS booked_krutiDev_font,
        b.create_at AS booking_created_at
      FROM plots
      LEFT JOIN sector ON plots.sector_id = sector.sector_id
      LEFT JOIN projects ON plots.project_id = projects.project_id
      LEFT JOIN bookings b ON b.plot_id = plots.plot_id AND b.is_delete = 0 AND b.status = 0
      LEFT JOIN brokers bk ON bk.broker_id = b.broker_id
      WHERE plots.is_delete = 0 ${projectCondition}
      GROUP BY plots.plot_id
      ORDER BY plots.plot_no ASC
    `;

    const allPlots = await db.fetchQuery(baseQuery, queryParams);

    const processedPlots = await Promise.all(allPlots.map(async (plot) => {
      const docs = await db.fetchQuery(
        `SELECT id, type, document_date FROM documents_date WHERE plot_id = ? AND is_deleted = 0`,
        [plot.plot_id]
      );

      let currentStatus = plot.booking_id ? 'booked' : 'available';
      let totalReceived = 0;
      let todayReceived = 0;
      let pendingAmount = 0;

      if (plot.booking_id) {
        const receivedData = await db.fetchQuery(
          `SELECT IFNULL(SUM(amount), 0) as total FROM receive_amount 
           WHERE customer_id = ? AND COALESCE(is_delete, 0) = 0`,
          [plot.booking_id]
        );
        totalReceived = receivedData[0].total || 0;

        const todayReceivedData = await db.fetchQuery(
          `SELECT IFNULL(SUM(amount), 0) as total FROM receive_amount 
           WHERE customer_id = ? AND COALESCE(is_delete, 0) = 0 AND DATE(created_at) = CURDATE()`,
          [plot.booking_id]
        );
        todayReceived = todayReceivedData[0].total || 0;

        const totalAmountA = Number(plot.amount_a) || 0;

        // per-plot pending amount
        pendingAmount = Math.max(0, totalAmountA - Number(totalReceived || 0));

        const isManagerSigned = docs.some(d => d.type === 'manager_signature');
        const hasRegistrySignatures = docs.some(d => 
          ['registry_client_signature', 'registry_accountant_signature', 'registry_manager_signature'].includes(d.type)
        );
        const hasAgreement = docs.some(d => d.type === 'agreement');
        const hasRegistryDate = docs.some(d => d.type === 'registry');
        const hasAllotmentDate = docs.some(d => d.type === 'allotment');

        if (
          isManagerSigned || 
          hasRegistrySignatures || 
          (totalAmountA > 0 && totalReceived >= totalAmountA) || 
          (hasAgreement && (hasRegistryDate || hasAllotmentDate))
        ) {
          currentStatus = 'completed';
        }
      }

      const isBookedToday = plot.booking_created_at
        ? new Date(plot.booking_created_at).toDateString() === new Date().toDateString()
        : false;

      return {
        ...plot,
        calculatedStatus: currentStatus,
        total_received: totalReceived,
        today_received: todayReceived,
        pending_amount: pendingAmount,
        is_booked_today: isBookedToday,
        documents_date: docs,
        bookings: plot.booking_id ? [{ ...plot }] : []
      };
    }));

    let filteredData = processedPlots;

    if (safeFilter === "available") {
      filteredData = processedPlots.filter(p => p.calculatedStatus === 'available');
    } else if (safeFilter === "booked") {
      filteredData = processedPlots.filter(p => p.calculatedStatus === 'booked');
    } else if (safeFilter === "completed") {
      filteredData = processedPlots.filter(p => p.calculatedStatus === 'completed');
    } else if (safeFilter === "pending") {
      filteredData = processedPlots.filter(p => Number(p.pending_amount) > 0);
    } else if (safeFilter === "sold") {
      filteredData = processedPlots.filter(p => p.calculatedStatus === 'booked' || p.calculatedStatus === 'completed');
    } else if (safeFilter === "today") {
      filteredData = processedPlots.filter(p => p.is_booked_today);
    } else if (safeFilter === "today_received") {
      const basePlots = processedPlots.filter(p => Number(p.today_received) > 0);
      const expandedRows = [];
      for (const plot of basePlots) {
        const entries = await db.fetchQuery(
          `SELECT * FROM receive_amount 
           WHERE customer_id = ? AND COALESCE(is_delete, 0) = 0 AND DATE(created_at) = CURDATE()
           ORDER BY id ASC`,
          [plot.booking_id]
        );
        entries.forEach(entry => {
          expandedRows.push({ ...plot, today_entry: entry, today_received: Number(entry.amount) });
        });
      }
      filteredData = expandedRows;
    }

    const { sortField, sortOrder } = req.query;

    if (sortField) {
      filteredData.sort((a, b) => {
        let valA, valB;

        switch (sortField) {
          case "Plot No":
            valA = a.plot_no || "";
            valB = b.plot_no || "";
            if (!isNaN(valA) && !isNaN(valB)) {
              valA = Number(valA);
              valB = Number(valB);
            }
            break;
          case "Name":
          case "Contact Info":
            valA = (a.customer_name || "").toLowerCase();
            valB = (b.customer_name || "").toLowerCase();
            break;
          case "Size":
            valA = Number(a.square_feet) || 0;
            valB = Number(b.square_feet) || 0;
            break;
          case "Dates":
            valA = new Date(a.agreement_date || a.booking_date || 0).getTime();
            valB = new Date(b.agreement_date || b.booking_date || 0).getTime();
            break;
          case "Project":
            valA = (a.project_name || "").toLowerCase();
            valB = (b.project_name || "").toLowerCase();
            break;
          case "Sector":
            valA = (a.sector_name || "").toLowerCase();
            valB = (b.sector_name || "").toLowerCase();
            break;
          case "Plot Rate":
            valA = Number(a.plot_rate) || 0;
            valB = Number(b.plot_rate) || 0;
            break;
          case "Amount":
          case "Total Amount":
            valA = Number(a.amount_a || a.amount) || 0;
            valB = Number(b.amount_a || b.amount) || 0;
            break;
          case "Booking Amt":
            valA = Number(a.booking_amount) || 0;
            valB = Number(b.booking_amount) || 0;
            break;
          case "Received":
            valA = Number(a.total_received) || 0;
            valB = Number(b.total_received) || 0;
            break;
          case "Pending Amt":
            valA = Number(a.pending_amount) || 0;
            valB = Number(b.pending_amount) || 0;
            break;
          case "Direction":
            valA = (a.east || "").toLowerCase();
            valB = (b.east || "").toLowerCase();
            break;
          default:
            valA = "";
            valB = "";
        }

        if (valA < valB) return sortOrder === "desc" ? 1 : -1;
        if (valA > valB) return sortOrder === "desc" ? -1 : 1;
        return 0;
      });
    }

    const total_records_filtered = filteredData.length;
    const paginatedData = filteredData.slice(offset, offset + limit);

    const total_booked_count = processedPlots.filter(p => p.calculatedStatus !== 'available').length;
    const total_available_count = processedPlots.filter(p => p.calculatedStatus === 'available').length;

    const grand_total_amount    = filteredData.reduce((sum, d) => sum + (Number(d.amount_a)       || 0), 0);
    const grand_received_amount = filteredData.reduce((sum, d) => sum + (Number(d.total_received)  || 0), 0);
    const grand_pending_amount  = filteredData.reduce((sum, d) => sum + (Math.max((Number(d.amount_a) || 0) - (Number(d.total_received) || 0), 0)), 0);
    const grand_today_received  = filteredData.reduce((sum, d) => sum + (Number(d.today_received)  || 0), 0);

    return res.json({
      success: true,
      filter: safeFilter,
      total_records: total_records_filtered,
      total_booked: total_booked_count,
      total_available: total_available_count,
      grand_total_amount,
      grand_received_amount,
      grand_pending_amount,
      grand_today_received,
      data: paginatedData
    });

  } catch (error) {
    console.error("ProjectDetails error:", error);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// exports.ProjectDetails = async (req, res) => {
//   const { project_id, filter } = req.query;

//   // ✅ pagination params
//   const page = Math.max(parseInt(req.query.page) || 1, 1);
//   const limit = Math.max(parseInt(req.query.limit) || 10, 1);
//   const offset = (page - 1) * limit;

//   if (!project_id) {
//     return res.status(400).json({ success: false, message: "project_id is required" });
//   }

//   try {
//     const projectId = Number(project_id);
//     if (isNaN(projectId)) {
//       return res.status(400).json({ success: false, message: "Invalid project_id" });
//     }

//     const allowedFilters = new Set(["all", "booked", "available", undefined, null, ""]);
//     const filterValue = allowedFilters.has(filter) ? (filter || "all") : "all";

//     /* =====================================================
//         1️⃣ TOTAL COUNT (pagination ke liye)
//      ===================================================== */
//     let countQuery = `
//       SELECT COUNT(DISTINCT plots.plot_id) AS total
//       FROM plots
//       LEFT JOIN bookings b ON b.plot_id = plots.plot_id
//         AND b.is_delete = 0
//         AND b.status = 0
//       WHERE plots.is_delete = 0
//         AND plots.project_id = ?
//     `;

//     if (filterValue === "available") countQuery += ` AND b.booking_id IS NULL`;
//     if (filterValue === "booked") countQuery += ` AND b.booking_id IS NOT NULL`;

//     const countResult = await db.fetchQuery(countQuery, [projectId]);
//     const total_records = countResult[0]?.total || 0;

//     /* =====================================================
//         2️⃣ PAGINATED PLOT IDS (REAL PAGINATION)
//      ===================================================== */
//     let plotIdQuery = `
//       SELECT DISTINCT plots.plot_id
//       FROM plots
//       LEFT JOIN bookings b ON b.plot_id = plots.plot_id
//         AND b.is_delete = 0
//         AND b.status = 0
//       WHERE plots.is_delete = 0
//         AND plots.project_id = ?
//     `;

//     if (filterValue === "available") plotIdQuery += ` AND b.booking_id IS NULL`;
//     if (filterValue === "booked") plotIdQuery += ` AND b.booking_id IS NOT NULL`;

//     plotIdQuery += ` ORDER BY plots.plot_no ASC LIMIT ? OFFSET ?`;

//     const plotIdRows = await db.fetchQuery(plotIdQuery, [
//       projectId,
//       limit,
//       offset,
//     ]);

//     const plotIds = plotIdRows.map(r => r.plot_id);

//     if (plotIds.length === 0) {
//       return res.json({
//         success: true,
//         filter: filterValue,
//         total_records,
//         total_booked: 0,
//         total_available: 0,
//         data: []
//       });
//     }

//     /* =====================================================
//         3️⃣ FULL DATA (ONLY CURRENT PAGE)
//      ===================================================== */
//     let query = `
//       SELECT 
//         plots.*,
//         sector.sector_name,
//         projects.krutiDev_font AS project_font,
//         projects.name AS project_name,
//         b.booking_id,
//         b.customer_name,
//         b.customer_father_name,
//         b.krutiDev_font AS booked_krutiDev_font,
//         b.customer_age,
//         b.customer_address,
//         b.mobile_no,
//         b.adhar_number,
//         b.pan_number,
//         b.broker_id,
//         bk.broker_name,
//         b.broker_number,
//         b.commission_type,
//         b.commission_value,
//         b.square_feet_size,
//         b.square_feet_rate,
//         b.booking_amount,
//         b.amount_a,
//         b.welcome AS amount_b,
//         b.payment_mode,
//         b.payment_time,
//         b.agreement_date,
//         b.register_date,
//         b.refer,
//         b.additional_comment,
//         b.status AS booking_status,
//         b.type,
//         b.check_no,
//         b.branch_name,
//         b.check_date,
//         b.bank_name,
//         b.relation_prefix,
//         b.booking_date,
//         b.custom_field,
//         b.create_at AS booking_create_at,
//         b.update_at AS booking_update_at,
//         b.is_delete AS booking_is_delete
//       FROM plots
//       LEFT JOIN sector ON plots.sector_id = sector.sector_id
//       LEFT JOIN projects ON plots.project_id = projects.project_id
//       LEFT JOIN bookings b ON b.plot_id = plots.plot_id
//         AND b.is_delete = 0
//         AND b.status = 0
//       LEFT JOIN brokers bk ON bk.broker_id = b.broker_id
//       WHERE plots.plot_id IN (${plotIds.map(() => "?").join(",")})
//       ORDER BY plots.plot_no ASC
//     `;

//     const rows = await db.fetchQuery(query, plotIds);

//     /* =====================================================
//         4️⃣ SAME RESPONSE MAPPING (UNCHANGED)
//      ===================================================== */
//     const plotsMap = {};
//     for (const row of rows) {
//       const plotId = row.plot_id;

//       if (!plotsMap[plotId]) {
//         plotsMap[plotId] = {
//           plot_id: row.plot_id,
//           plot_no: row.plot_no,
//           sector_id: row.sector_id,
//           plot_height: row.plot_height,
//           plot_width: row.plot_width,
//           north: row.north,
//           east: row.east,
//           south: row.south,
//           west: row.west,
//           plot_font: row.plot_font,
//           plot_create_at: row.create_at,
//           plot_rate: row.plot_rate,
//           project_id: row.project_id,
//           project_name: row.project_name,
//           square_feet: row.square_feet,
//           plot_note: row.plot_note,
//           amount: row.amount,
//           sector_name: row.sector_name,
//           project_font: Number(row.project_font) || 0,
//           booked_krutiDev_font: Number(row.booked_krutiDev_font) || 0,
//           bookings: []
//         };
//       }

//       if (row.booking_id) {
//         plotsMap[plotId].bookings.push({
//           booking_id: row.booking_id,
//           customer_name: row.customer_name,
//           customer_father_name: row.customer_father_name,
//           customer_age: row.customer_age,
//           customer_address: row.customer_address,
//           mobile_no: row.mobile_no,
//           adhar_number: row.adhar_number,
//           pan_number: row.pan_number,
//           broker_id: row.broker_id,
//           broker_name: row.broker_name,
//           broker_number: row.broker_number,
//           commission_type: row.commission_type,
//           commission_value: row.commission_value,
//           square_feet_size: row.square_feet_size,
//           square_feet_rate: row.square_feet_rate,
//           booking_amount: row.booking_amount,
//           amount_a: row.amount_a,
//           amount_b: row.amount_b,
//           payment_mode: row.payment_mode,
//           payment_time: row.payment_time,
//           agreement_date: row.agreement_date,
//           register_date: row.register_date,
//           refer: row.refer,
//           additional_comment: row.additional_comment,
//           booked_krutiDev_font: row.booked_krutiDev_font,
//           booking_status: row.booking_status,
//           type: row.type,
//           check_no: row.check_no,
//           branch_name: row.branch_name,
//           check_date: row.check_date,
//           bank_name: row.bank_name,
//           relation_prefix: row.relation_prefix,
//           booking_date: row.booking_date,
//           custom_field: row.custom_field,
//           create_at: row.booking_create_at,
//           update_at: row.booking_update_at,
//           is_delete: row.booking_is_delete,
//           project_id: row.project_id,
//           project_name: row.project_name
//         });
//       }
//     }

//     const formatted = Object.values(plotsMap);

//     // ✅ Documents ko pehle fetch kar rahe hain taaki filter mein use ho sake
//     for (const plot of formatted) {
//       const documents = await db.fetchQuery(
//         `SELECT id, project_id, plot_id, type, document_date
//          FROM documents_date
//          WHERE project_id = ?
//          AND plot_id = ?`,
//         [plot.project_id, plot.plot_id]
//       );
//       plot.documents_date = documents;
//     }

//     /* =====================================================
//         5️⃣ 🔥 FILTER LOGIC (Hide Completed from Booked)
//      ===================================================== */
//     let finalData = formatted;

//     if (filterValue === "booked") {
//       const filtered = [];
//       for (const plot of formatted) {
//         if (plot.bookings.length === 0) continue;

//         const b = plot.bookings[0];
//         const totalAmount = Number(b.amount_a) || 0;

//         // Payment status check
//         const receivedData = await db.fetchQuery(
//           `SELECT IFNULL(SUM(amount),0) as total FROM receive_amount 
//            WHERE customer_id = ? AND COALESCE(is_delete,0)=0`,
//           [b.booking_id]
//         );
//         const received = receivedData[0].total || 0;

//         const docs = plot.documents_date || [];
//         const isManagerSigned = docs.some(d => d.type === 'manager_signature');
//         const hasAgreement = docs.some(d => d.type === 'agreement');
//         const hasRegistry = docs.some(d => d.type === 'registry');
//         const hasAllotment = docs.some(d => d.type === 'allotment');

//         // Agar plot complete hai toh skip (hide) karo
//         const isComplete = 
//           isManagerSigned || 
//           received >= totalAmount || 
//           (hasAgreement && (hasRegistry || hasAllotment));

//         if (!isComplete) {
//           filtered.push(plot);
//         }
//       }
//       finalData = filtered;
//     }

//     const total_booked = formatted.filter(p => p.bookings.length > 0).length;
//     const total_available = total_records - total_booked;

//     return res.json({
//       success: true,
//       filter: filterValue,
//       total_records,
//       total_booked,
//       total_available,
//       data: finalData // ✅ Filtered data yahan bhej rahe hain
//     });

//   } catch (error) {
//     console.error("ProjectDetails error:", error);
//     return res.status(500).json({ success: false, message: "Internal Server Error" });
//   }
// };




// exports.ProjectDetails = async (req, res) => {
//   const { project_id, filter } = req.query;

//   if (!project_id) {
//     return res.status(400).json({ success: false, message: "project_id is required" });
//   }

//   try {
//     const projectId = Number(project_id);
//     if (isNaN(projectId)) {
//       return res.status(400).json({ success: false, message: "Invalid project_id" });
//     }

//     const allowedFilters = new Set(["all", "booked", "available", undefined, null, ""]);
//     const filterValue = allowedFilters.has(filter) ? (filter || "all") : "all";

//    let query = `
//   SELECT 
//     plots.*,
//     sector.sector_name,
//     projects.krutiDev_font AS project_font,
//     projects.name AS project_name,
//     b.booking_id,
//     b.customer_name,
//     b.customer_father_name,
//     b.krutiDev_font AS booked_krutiDev_font,
//     b.customer_age,
//     b.customer_address,
//     b.mobile_no,
//     b.adhar_number,
//     b.pan_number,
//     b.broker_id,
//     bk.broker_name,
//     b.broker_number,
//     b.commission_type,
//     b.commission_value,
//     b.square_feet_size,
//     b.square_feet_rate,
//     b.booking_amount,
//     b.amount_a,
//     b.welcome AS amount_b,
//     b.payment_mode,
//     b.payment_time,
//     b.agreement_date,
//     b.register_date,
//     b.refer,
//     b.additional_comment,
//     b.status AS booking_status,
//     b.type,
//     b.check_no,
//     b.branch_name,
//     b.check_date,
//     b.bank_name,
//     b.relation_prefix,
//     b.booking_date,
//     b.custom_field,
//     b.create_at AS booking_create_at,
//     b.update_at AS booking_update_at,
//     b.is_delete AS booking_is_delete
//   FROM plots
//   LEFT JOIN sector ON plots.sector_id = sector.sector_id
//   LEFT JOIN projects ON plots.project_id = projects.project_id
//   LEFT JOIN bookings b ON b.plot_id = plots.plot_id 
//         AND b.is_delete = 0 
//         AND b.status = 0
//   LEFT JOIN brokers bk ON bk.broker_id = b.broker_id
//   WHERE plots.is_delete = 0
//     AND plots.project_id = ?
// `;

//     if (filterValue === "available") query += ` AND b.booking_id IS NULL`;
//     if (filterValue === "booked") query += ` AND b.booking_id IS NOT NULL`;

//     query += ` ORDER BY plots.plot_no ASC, b.booking_id ASC`;

//     const rows = await db.fetchQuery(query, [projectId]);

//     const plotsMap = {};
//     for (const row of rows) {
//       const plotId = row.plot_id;

//       if (!plotsMap[plotId]) {
//         plotsMap[plotId] = {
//           plot_id: row.plot_id,
//           plot_no: row.plot_no,
//           sector_id: row.sector_id,
//           plot_height: row.plot_height,
//           plot_width: row.plot_width,
//           north: row.north,
//           east: row.east,
//           south: row.south,
//           west: row.west,
//           plot_font: row.plot_font,
//           plot_create_at: row.create_at,
//           plot_rate: row.plot_rate,
//           project_id: row.project_id,
//           project_name: row.project_name,   // ⭐ NOW AVAILABLE
//           square_feet: row.square_feet,
//           plot_note: row.plot_note,
//           amount: row.amount,
//           sector_name: row.sector_name,
//  project_font: Number(row.project_font) || 0,   // ✅ sirf project font
//          // ✅ project font
//  booked_krutiDev_font: Number(row.booked_krutiDev_font) || 0,


//           bookings: []
//         };
//       }

//       if (row.booking_id) {
//         plotsMap[plotId].bookings.push({
//           booking_id: row.booking_id,
//           customer_name: row.customer_name,
//           customer_father_name: row.customer_father_name,
//           customer_age: row.customer_age,
//           customer_address: row.customer_address,
//           mobile_no: row.mobile_no,
//           adhar_number: row.adhar_number,
//           pan_number: row.pan_number,
//           broker_id: row.broker_id,
//           broker_name: row.broker_name,
//           broker_number: row.broker_number,
//           commission_type: row.commission_type,
//           commission_value: row.commission_value,
//           square_feet_size: row.square_feet_size,
//           square_feet_rate: row.square_feet_rate,
//           booking_amount: row.booking_amount,
//           amount_a: row.amount_a,
//           amount_b: row.amount_b,
//           payment_mode: row.payment_mode,
//           payment_time: row.payment_time,
//           agreement_date: row.agreement_date,
//           register_date: row.register_date,
//           refer: row.refer,
//           additional_comment: row.additional_comment,
//           booked_krutiDev_font: row.booked_krutiDev_font,
//           booking_status: row.booking_status,
//           type: row.type,
//           check_no: row.check_no,
//           branch_name: row.branch_name,
//           check_date: row.check_date,
//           bank_name: row.bank_name,
//           relation_prefix: row.relation_prefix,
//           booking_date: row.booking_date,
//           custom_field: row.custom_field,
//           create_at: row.booking_create_at,
//           update_at: row.booking_update_at,
//           is_delete: row.booking_is_delete,
//           project_id: row.project_id,
//           project_name: row.project_name     // ⭐ ALSO HERE
//         });
//       }
//     }

//     const formatted = Object.values(plotsMap);
//     const total_records = formatted.length;
//     const total_booked = formatted.filter((p) => p.bookings.length > 0).length;
//     const total_available = total_records - total_booked;

//     return res.json({
//       success: true,
//       filter: filterValue,
//       total_records,
//       total_booked,
//       total_available,
//       data: formatted
//     });

//   } catch (error) {
//     console.error("ProjectDetails error:", error);
//     return res.status(500).json({ success: false, message: "Internal Server Error" });
//   }
// };