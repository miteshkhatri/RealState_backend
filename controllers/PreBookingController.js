const db = require('../utils/helpers');
exports.addprebooking = async (req, res) => {
    const { CustomerName, CustomerNumber, PlotNumber, amount , krutiDev_font } = req.body;


    if (!CustomerName) {
        res.json({
            success: false,
            message: 'Customer name is required'
        })
    }
    if (!CustomerNumber) {
        res.json({
            success: false,
            message: 'Customer number is required'
        })
    }
    
   
    const createDate = new Date();
    const formattedDate = createDate.toISOString().split('T')[0];  
    try {
        const query = `
            INSERT INTO pre_booking
            (customer_name, customer_number, Plot_number, amount, create_at , krutiDev_font)
            VALUES (?,?,?,?,?,?)
        `;
        const params = [
            CustomerName,
            CustomerNumber,
            PlotNumber || null,
            amount || null,
            formattedDate,
            krutiDev_font || null
        ];

        await db.insertQuery(query, params);

        res.json({
            success: true,
            message: 'Pre-booking added successfully',
        });
    } catch (error) {
        console.error('Database Error:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred while adding pre-booking. Please try again later.',
        });
    }
}

exports.updatePreBooking = async (req, res) => {
    const { preBookingId, CustomerName, CustomerNumber, PlotNumber, amount , krutiDev_font } = req.body;
    if (!preBookingId) {
        res.json({
            success: false,
            message: 'preBooking Id is required'
        })
    }
    if (!CustomerName) {
        res.json({
            success: false,
            message: 'Customer name is required'
        })
    }
    if (!CustomerNumber) {
        res.json({
            success: false,
            message: 'Customer number is required'
        })
    }
    // if (!PlotNumber) {
    //     res.json({
    //         success: false,
    //         message: 'Plot number is required'
    //     })
    // }
    // if (!amount) {
    //     res.json({
    //         success: false,
    //         message: 'Amount is required'
    //     })
    // }
    try {
        const query = `UPDATE pre_booking SET  customer_name= ? , customer_number = ?, Plot_number = ?, amount = ? , krutiDev_font = ? WHERE id = ?`;
        const params = [
            CustomerName,
            CustomerNumber,
            PlotNumber || null,
            amount || null,
            krutiDev_font || null,
            preBookingId
        ];
        await db.insertQuery(query, params)
        res.json({
            success: true,
            message: 'Pre-booking update successfully'
        })
    } catch (error) {
        console.log(error)
    }
}

exports.deletePreBooking = async (req, res) => {
    const { preBookingId } = req.query;
    if (!preBookingId) {
        res.json({
            success: false,
            message: 'pre booking id is required'
        })
    }
    try {
        const qurey = `UPDATE pre_booking SET is_delete = ? WHERE id = ?`;
        const params = [1, preBookingId]
        await db.insertQuery(qurey, params)
        res.json({
            success: true,
            message: 'pre-booking delete  successfully '
        })
    } catch (error) {
        console.log(error)
    }
}

exports.getAllPreBooking = async (req, res) => {
    try {
        const qurey = `SELECT * FROM pre_booking WHERE is_delete = ?`;
        const params = [0];
        const result = await db.fetchQuery(qurey, params)
        res.json({
            success: true,
            data: result
        })
    } catch (error) {
        console.log(error)
    }
}