const express = require('express');
const {AddReceiveAmount , UpdateReceiveAmount , getAllReceiveAmount ,checkReceiptDownload ,deleteReceiveAmount , RemainingAmount , CustomerBaseRecord,handleReceiptDownload} = require('../controllers/ReceiveAmountController')
const verifyToken = require('../middlewares/authMiddleware');

const router = express.Router();
router.use(verifyToken)
 
 
 
router.post('/add'  ,AddReceiveAmount)
router.put('/'  ,UpdateReceiveAmount)
router.get('/list'  ,getAllReceiveAmount)
router.delete('/'  ,deleteReceiveAmount)
router.get('/remainingamount'  ,RemainingAmount)
router.get('/customerbaserecord'  ,CustomerBaseRecord)
router.post('/receiptdownload' ,handleReceiptDownload)
router.get('/checkstutas',checkReceiptDownload)
 

 

module.exports = router;
