const {paymentMode} = require('../controllers/PaymentModeController')
const verifyToken = require('../middlewares/authMiddleware');
const express = require('express');
const router = express.Router();
router.use(verifyToken)

router.use('/mode' , paymentMode)



module.exports = router;