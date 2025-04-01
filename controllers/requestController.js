const requestModels = require('../models/requestModel');
const matchingService = require('../services/matchingServices');

async function createRequest(req, res){
    try {
        const userId = req.user.userId;
        const { taskType, comments } = req.body;

        if (!taskType){
            return res.status(400).json({ error: 'Task type is required'});
        }

        const newRequest = await requestModels.createRequest(userId, taskType, comments);

        matchingService.findAndAssignMatch(newRequest.id)
            .catch(err => {
                console.error(`Error initiating matching service for request ${newRequest.id}: \n`, err)
            })

        res.status(201).json({
            message: `Request created successfully. Matching process initiated.`,
            requestId: newRequest.id
        });
    } 
    catch (err) {
        console.error('Error in createRequest controller: \n', err);
        res.status(500).json({error: 'Failed to create help request'});
    }
}

module.exports = {
    createRequest
}