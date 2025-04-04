const express = require('express');
const matchController = require('../controllers/matchController')

const router = express.Router();

router.get('/pending', matchController.getPendingMatches);

router.post('/:matchId/accept', matchController.acceptMatch);

router.post('/:matchId/decline', matchController.declineMatch);

module.exports = router;