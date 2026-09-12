const {CreateUser ,getAllusers , AllUserRole , deleteUser} = require('../controllers/CreateUserContrller')
const verifyToken = require('../middlewares/authMiddleware');
const express = require('express');
const router = express.Router();
router.use(verifyToken)
router.post('/add' ,  CreateUser)
router.get('/' ,  getAllusers)
router.get('/role' ,  AllUserRole)
router.delete('/' ,  deleteUser)

module.exports = router;