const { getReportList } = require('../controllers/ReportController');
const verifyToken = require('../middlewares/authMiddleware');
const express = require('express');
const router = express.Router();

router.use(verifyToken);
router.get('/list', getReportList);

module.exports = router;
