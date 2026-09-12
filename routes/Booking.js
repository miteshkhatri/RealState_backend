const {addbooking , allbookings , updatebooking ,PattaDocs, deletebooking , Docs,addDocuments,addDate, cancelBooking,searchBrokers,downloadBooking} = require('../controllers/BookingController')
const verifyToken = require('../middlewares/authMiddleware');
const express = require('express');
const router = express.Router();
router.use(verifyToken)
router.post('/add' ,  addbooking)
router.get('/list' ,  allbookings)
router.put('/' ,  updatebooking)
router.delete('/' ,  deletebooking)
router.get('/downloadDocx' ,  Docs)
router.post('/cancel',cancelBooking)
router.get('/searchBrokers', searchBrokers);
router.post('/downloadBooking', downloadBooking);
router.post('/addDate',addDate);
router.post('/addocuments',addDocuments);
router.get('/PattaDocs',PattaDocs);

module.exports = router;