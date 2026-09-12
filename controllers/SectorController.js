const db = require('../utils/helpers');

exports.sectors = async (req, res) => {
    const { project_id } = req.query ? req.query : null;

    let query;
    let params;
    try {
        if (project_id) {
            query = `
                SELECT 
                    s.*,
                    p.krutiDev_font   -- ✅ parent project ka column
                FROM sector s
                LEFT JOIN projects p ON s.project_id = p.project_id
                WHERE s.project_id = ? AND s.is_delete = ?
                ORDER BY s.sector_name ASC
            `;
            params = [project_id || "", 0];
        } else {
            query = `
                SELECT 
                    s.*,
                    p.krutiDev_font   -- ✅ parent project ka column
                FROM sector s
                LEFT JOIN projects p ON s.project_id = p.project_id
                WHERE s.is_delete = ?
                ORDER BY s.sector_name ASC
            `;
            params = [0];
        }

        const result = await db.fetchQuery(query, params);

        return res.json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error(error, 'error fetching sectors');
        return res.status(500).json({
            success: false,
            message: "Something went wrong while fetching sectors"
        });
    }
};


exports.sectorsdelete = async (req, res) => {
    const { sector_id } = req.query;
    if (!sector_id) {
        res.json({
            success: false,
            message: 'Sector id required'
        })
    }
    try {
        const qurey = `UPDATE sector SET  is_delete=? WHERE sector_id=? `;
        const param = [1, sector_id]
        await db.fetchQuery(qurey, param)
        res.json({
            success: true,
            message: 'Sector delete successfully'
        })
    } catch (error) {
        console.log(error)

    }
}