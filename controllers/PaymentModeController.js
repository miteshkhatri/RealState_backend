const db = require('../utils/helpers');
exports.paymentMode = async(req, res)=>{
    const qurey = `SELECT * FROM payment_type  ORDER BY 
    payment_type.payment_mode`;
    const result = await db.fetchQuery(qurey)
    res.json({
        success: true,
        data:result
    })
    // console.log(result , 'result payment ')
}