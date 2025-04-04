const express = require('express');
const mapsController = require('../controllers/mapsController');

const router = express.Router();

router.get('/config', mapsController.getMapConfig);
router.get('/search', mapsController.searchAddress);
router.get('/reverse-geocode', mapsController.reverseGeocode);

module.exports = router;