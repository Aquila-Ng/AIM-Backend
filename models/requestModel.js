const { pool } = require('../config/db');

async function createRequest(userId, taskType, comments){
    const query = `
        INSERT INTO help_requests (req_user_id, task_type, comments, status)
        VALUES ($1, $2, $3, 'open')
        RETURNING id, req_user_id, task_type, comments, status, created_at;
    `;
    const values = [userId, taskType, comments || null];

    try {
        const results  = await pool.query(query, values);
        return results.rows[0];
    }
    catch (err) {
        console.error('Error creating help request: \n', err);
        throw err;
    }
}

async function findRequestById(requestId){
    const query = `
    SELECT 
        id, req_user_id, task_type, comments, status, 
        matched_helper_id, llm_generated_profile, created_at, updated_at
    FROM help_requests
    WHERE id = $1;`;
    const values = [requestId];
    try {
        const results = await pool.query(query, values);
        return results.rows[0];
    }
    catch (err) {
        console.error(`Error finding Request ID (${requestId}): \n`, err);
        throw err
    }
}

async function updateRequestMatchDetails(requestId, status, matchedHelperId = null, llmProfile = null){
    const query = `
        UPDATE help_requests
        SET
            status = $1,
            matched_helper_id = $2,
            llm_generated_profile = $3,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $4
        RETURNING id, status, matched_helper_id; -- Return updated info`;
    const values = [status, matchedHelperId, llmProfile, requestId];
    try {
        const result = await pool.query(query, values);
        if (result.rowCount === 0) {
            console.warn(`Attempted to update non-existent request ID: ${requestId}`);
            return null;
        }
        console.log(`Request ${requestId} status updated to ${status}. 
                    Matched Helper: ${matchedHelperId || 'None'}.`);
        return result.rows[0];
    }
    catch (err) {
        console.error(`Error updating request match details for ID (${requestId}): \n`, err);
        throw err;
    }
}

module.exports = {
    createRequest,
    findRequestById,
    updateRequestMatchDetails,
}