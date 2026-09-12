const {addprebooking , updatePreBooking , deletePreBooking , getAllPreBooking} = require('../controllers/PreBookingController')
const verifyToken = require('../middlewares/authMiddleware');
const express = require('express');
const router = express.Router();
router.use(verifyToken)
router.post('/add' ,  addprebooking)
router.put('/' ,  updatePreBooking)
router.delete('/' ,  deletePreBooking)
router.get('/list' ,  getAllPreBooking)
 

module.exports = router;