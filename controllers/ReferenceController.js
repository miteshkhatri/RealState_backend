const db = require('../utils/helpers');
exports.getallReference =async (req, res)=>{
    
    try {
        const qurey = `SELECT * FROM reference`;
        const result = await db.fetchQuery(qurey , null)
        res.json({
            success:true,
            data:result
        })
    } catch (error) {
        console.log(error)
    }
}