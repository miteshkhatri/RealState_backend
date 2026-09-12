const express = require('express');
const {UpdateProfile } = require('../controllers/profileController')
const verifyToken = require('../middlewares/authMiddleware');
const router = express.Router();
router.use(verifyToken)
 
 
 
router.put('/update'  ,UpdateProfile)

 

module.exports = router;
