const { Plots, getallplots, updateplots, deletplots, getPlotStatuses, changePlotStatus, getPlotStatusHistory } = require('../controllers/PlotController')
const verifyToken = require('../middlewares/authMiddleware');
const express = require('express');
const router = express.Router();
router.use(verifyToken)
router.post('/add', Plots)
router.get('/list', getallplots)
router.get('/statuses', getPlotStatuses)
router.get('/status-history/:plot_id', getPlotStatusHistory)
router.put('/', updateplots)
router.put('/change-status', changePlotStatus)
router.delete('/', deletplots)

module.exports = router;