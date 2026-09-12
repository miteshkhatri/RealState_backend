const {projectadd , DashboardData,projectData,ProjectDetails,getCompletedAmountAUsers} = require('../controllers/DashboardController')
const verifyToken = require('../middlewares/authMiddleware');
const express = require('express');
// const { projectData } = require('./DashboardController');
const router = express.Router();
router.use(verifyToken)
router.get('/data' ,  DashboardData)
router.get('/projectData',projectData)
router.get('/ProjectDetails',ProjectDetails)
router.get('/completedAmountAUsers', getCompletedAmountAUsers);
module.exports = router;