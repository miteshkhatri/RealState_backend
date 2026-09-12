const db = require('../utils/helpers');

exports.getReportList = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      project_id, 
      start_date, 
      end_date, 
      user_id 
    } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;
    const userId = user_id && /^\d+$/.test(String(user_id)) ? Number(user_id) : null;

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

    let queryParams = userHasPermissions ? [userId] : [];
    let countQueryParams = userHasPermissions ? [userId] : [];

    let whereClauses = [
      `bookings.status = 0`,
      `bookings.is_delete = 0`
    ];

    if (project_id && project_id !== '') {
      whereClauses.push(`bookings.project_id = ?`);
      queryParams.push(project_id);
      countQueryParams.push(project_id);
    }

    const { date_filter_type = 'created' } = req.query;

    if (start_date && end_date) {
      const startParam = `${start_date} 00:00:00`;
      const endParam = `${end_date} 23:59:59`;
      
      if (date_filter_type === 'booking') {
        whereClauses.push(`bookings.booking_date >= ? AND bookings.booking_date <= ?`);
      } else if (date_filter_type === 'due') {
        whereClauses.push(`DATE_ADD(IFNULL(bookings.agreement_date, bookings.booking_date), INTERVAL 45 DAY) >= ? AND DATE_ADD(IFNULL(bookings.agreement_date, bookings.booking_date), INTERVAL 45 DAY) <= ?`);
      } else if (date_filter_type === 'due_expired') {
        whereClauses.push(`DATE_ADD(IFNULL(bookings.agreement_date, bookings.booking_date), INTERVAL 45 DAY) >= ? AND DATE_ADD(IFNULL(bookings.agreement_date, bookings.booking_date), INTERVAL 45 DAY) <= ? AND DATE_ADD(IFNULL(bookings.agreement_date, bookings.booking_date), INTERVAL 45 DAY) < CURDATE()`);
      } else if (date_filter_type === 'due_valid') {
        whereClauses.push(`DATE_ADD(IFNULL(bookings.agreement_date, bookings.booking_date), INTERVAL 45 DAY) >= ? AND DATE_ADD(IFNULL(bookings.agreement_date, bookings.booking_date), INTERVAL 45 DAY) <= ? AND DATE_ADD(IFNULL(bookings.agreement_date, bookings.booking_date), INTERVAL 45 DAY) >= CURDATE()`);
      } else {
        // default to created
        whereClauses.push(`bookings.create_at >= ? AND bookings.create_at <= ?`);
      }
      
      queryParams.push(startParam);
      queryParams.push(endParam);
      countQueryParams.push(startParam);
      countQueryParams.push(endParam);
    } else {
      if (date_filter_type === 'due_expired') {
        whereClauses.push(`DATE_ADD(IFNULL(bookings.agreement_date, bookings.booking_date), INTERVAL 45 DAY) < CURDATE()`);
      }
    }

    const whereString = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const selectQuery = `
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
        CASE WHEN ${isAssignedCase} THEN 1 ELSE 0 END AS is_assigned
      FROM bookings
      LEFT JOIN plots ON bookings.plot_id = plots.plot_id
      LEFT JOIN sector ON bookings.sector_id = sector.sector_id
      LEFT JOIN payment_type ON bookings.payment_mode = payment_type.id
      LEFT JOIN projects ON bookings.project_id = projects.project_id
      LEFT JOIN reference ON bookings.refer = reference.id
      LEFT JOIN brokers ON bookings.broker_id = brokers.broker_id
      ${apJoin}
      ${whereString}
      ORDER BY bookings.booking_id DESC
    `;

    const rows = await db.fetchQuery(selectQuery, queryParams);

    // Grouping logic (Identical to BookingTable)
    const groupedMap = new Map();
    rows.forEach(row => {
      const key = `${row.project_id}_${row.plot_no}`;
      if (!groupedMap.has(key)) {
        groupedMap.set(key, { 
          ...row, 
          all_customers: [{ 
            name: row.customer_name, 
            mobile: row.mobile_no, 
            font: row.krutiDev_font, 
            id: row.booking_id 
          }] 
        });
      } else {
        let existing = groupedMap.get(key);
        const exists = existing.all_customers.find(c => c.name === row.customer_name && c.mobile === row.mobile_no);
        if (!exists) {
          existing.all_customers.push({ 
            name: row.customer_name, 
            mobile: row.mobile_no, 
            font: row.krutiDev_font, 
            id: row.booking_id 
          });
        }
        
        // Match BookingTable logic: keep the oldest booking as the primary row
        const existingDate = new Date(existing.create_at || 0);
        const currentDate = new Date(row.create_at || 0);
        if (currentDate < existingDate) {
          const mergedCustomers = existing.all_customers;
          groupedMap.set(key, { ...row, all_customers: mergedCustomers });
        } else if (currentDate.getTime() === existingDate.getTime()) {
          if (row.booking_id < existing.booking_id) {
            const mergedCustomers = existing.all_customers;
            groupedMap.set(key, { ...row, all_customers: mergedCustomers });
          }
        }
      }
    });

    let groupedData = Array.from(groupedMap.values());
    groupedData.forEach(r => {
      r.all_customers.sort((a, b) => Number(a.id) - Number(b.id));
    });

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

    groupedData = await attachReceivedAmount(groupedData);

    const { dateSortType, dateSortOrder } = req.query;
    if (dateSortType) {
      groupedData.sort((a, b) => {
        let valA, valB;
        if (dateSortType === "created") {
          valA = new Date(a.create_at || 0).getTime();
          valB = new Date(b.create_at || 0).getTime();
        } else if (dateSortType === "booking") {
          valA = new Date(a.booking_date || 0).getTime();
          valB = new Date(b.booking_date || 0).getTime();
        } else if (dateSortType === "due") {
          const dueA = a.agreement_date || a.booking_date;
          const dueB = b.agreement_date || b.booking_date;
          valA = dueA ? new Date(dueA).getTime() + (45 * 24 * 60 * 60 * 1000) : 0;
          valB = dueB ? new Date(dueB).getTime() + (45 * 24 * 60 * 60 * 1000) : 0;
        }

        if (dateSortOrder === "desc") {
          return valB - valA;
        }
        return valA - valB;
      });
    }

    // Pagination on the grouped data
    const totalRecords = groupedData.length;
    const totalPages = Math.ceil(totalRecords / limitNum);
    const paginatedData = groupedData.slice(offset, offset + limitNum);

    const grand_total_amount = groupedData.reduce((sum, row) => sum + Number(row.amount_a || 0), 0);
    const grand_received_amount = groupedData.reduce((sum, row) => sum + Number(row.received_amount || 0), 0);
    const grand_pending_amount = groupedData.reduce((sum, row) => sum + Number(row.pending_amount || 0), 0);

    res.status(200).json({
      success: true,
      data: paginatedData,
      grand_total_amount,
      grand_received_amount,
      grand_pending_amount,
      pagination: {
        total_records: totalRecords,
        total_pages: totalPages,
        current_page: pageNum,
        limit: limitNum
      }
    });

  } catch (error) {
    console.error("? Error in getReportList:", error);
    res.status(500).json({
      success: false,
      message: "Something went wrong while fetching report",
      error: error.message
    });
  }
};
