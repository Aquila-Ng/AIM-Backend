const express = require('express');
const requestController = require('../controllers/requestController');

const router = express.Router();

router.post('/', requestController.createRequest);

router.get('/my-history', requestController.getMyRequestHistory);

module.exports = router;