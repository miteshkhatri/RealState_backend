const express = require('express');
const verifyToken = require('../middlewares/authMiddleware');
const { Propertiesadd,  PropertiesList, searchProperties, PropertiesUpdate, PropertiesDelete,Test,PropertiesMerge } = require('../controllers/Properties');

const router = express.Router();

// Apply JWT Auth Middeware to all routes
router.use(verifyToken);

// Create Property
router.post('/add', Propertiesadd);

// Update Property
router.post('/update',PropertiesUpdate);
router.get('/list',PropertiesList);
router.get('/searchProperties',searchProperties);
router.get('/text',Test);

router.post('/delete',PropertiesDelete);
router.post('/merge', PropertiesMerge);


module.exports = router;
