const express = require('express');
const {sectors , sectorsdelete}  = require('../controllers/SectorController')
const verifyToken = require('../middlewares/authMiddleware');
const router = express.Router();
router.use(verifyToken)

router.get('/list'  ,sectors)
router.delete('/'  ,sectorsdelete)

 

module.exports = router;