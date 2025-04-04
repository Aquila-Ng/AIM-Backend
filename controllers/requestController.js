const requestModels = require('../models/requestModel');
const matchingService = require('../services/matchingServices');

async function createRequest(req, res){
    try {
        if (!req.user || !req.user.userId){
            return res.status(401).json({error: 'User not authenticated'});
        }
        const userId = req.user.userId;
        const {taskType, comments, scheduledDateTime, latitude, longitude, address} = req.body;

        console.log(taskType, comments, scheduledDateTime, latitude, longitude, address);
        if (!taskType){
            return res.status(400).json({error: 'taskType is required'});
        } 

        const scheduleDetails = {
            scheduledDateTime: scheduledDateTime || null,
            latitude: latitude || null,
            longitude: longitude || null,
            address: address || null
        };

        const newRequest = await requestModels.createRequest(userId, taskType, comments, scheduleDetails);
        
        matchingService.findAndOfferMatches(newRequest.id) // Call the renamed function
            .catch(err => {
                console.error(`Error initiating matching/offering service for request ${newRequest.id}:`, err);
            });

        res.status(201).json({
            message: 'Request created successfully. Potential helpers will be notified.',
            requestId: newRequest.id
        });
    } 
    catch (err) {
        console.error('Error in createRequest controller:', err);
        res.status(500).json({ error: 'Failed to create help request.' });
    }
}

// New controller for fetching user's request history
async function getMyRequestHistory(req, res) {
    try {
        if (!req.user || !req.user.userId) {
            return res.status(401).json({ error: 'User not authenticated.' });
        }
        const userId = req.user.userId;
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 10; // Default limit

        const historyData = await requestModels.findRequestsByRequester(userId, page, limit);

        res.status(200).json(historyData);

    } catch (err) {
        console.error('Error fetching request history:', err);
        res.status(500).json({ error: 'Failed to fetch request history.' });
    }
}

module.exports = {
    createRequest,
    getMyRequestHistory
}