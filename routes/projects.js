const express = require('express');
const {projectadd  , projects , projectupdate , projectdelete, addRemark, getAllRemarks, softDeleteRemark, restoreRemark} = require('../controllers/ProjectController')
const verifyToken = require('../middlewares/authMiddleware');
const router = express.Router();
router.use(verifyToken)
 
 
router.post('/add' ,projectadd)
router.get('/all'  ,projects)
router.post('/update'  ,projectupdate)
router.post('/delete'  ,projectdelete)

router.post("/add-remark", addRemark);
router.get("/get-remarks", getAllRemarks);
router.post("/delete-remark", softDeleteRemark);
router.post("/restore-remark", restoreRemark);
 

module.exports = router;
