const express = require('express');
const {getallReference} = require('../controllers/ReferenceController')
const verifyToken = require('../middlewares/authMiddleware');
const router = express.Router();
router.use(verifyToken)
 
 
 
router.get('/all'  ,getallReference)
 

 

module.exports = router;
