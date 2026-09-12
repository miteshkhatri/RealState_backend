const express = require('express');
const { login, checkOrInsertPasswordB } = require('../controllers/userController');
const router = express.Router();
const verifyToken = require('../middlewares/authMiddleware')

// router.post('/login', login);
router.post('/login', login);
router.post('/passwordb', checkOrInsertPasswordB);
module.exports = router;
