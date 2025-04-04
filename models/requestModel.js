const { pool } = require('../config/db');

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

// Modified createRequest to include new fields
async function createRequest(userId, taskType, comments, scheduleDetails = {}) {
    const { scheduledDateTime = null, latitude = null, longitude = null, address = null } = scheduleDetails;
    const query = `
        INSERT INTO help_requests (
            req_user_id, task_type, comments, status,
            scheduled_datetime, location_latitude, location_longitude, location_address
        )
        VALUES ($1, $2, $3, 'open', $4, $5, $6, $7)
        RETURNING id, req_user_id, task_type, comments, status, created_at, scheduled_datetime;
    `;
    const values = [
        userId,
        taskType,
        comments || null,
        scheduledDateTime, // Pass null if not provided
        latitude,
        longitude,
        address
    ];

    try {
        const result = await pool.query(query, values);
        return result.rows[0];
    } catch (err) {
        console.error('Error creating help request:', err);
        throw err;
    }
}

// New function to store potential matches
async function createPotentialMatches(requestId, matches){
    if (!matches || matches.length === 0){
        return []
    }

    const query = `
        INSERT INTO 
            potential_matches (request_id, potential_heler_id, score, status)
        VALUES
            ${matches.map((_, i) => `($${i * 3 + 1}, $${i * 3 + 2}, $${i * 3 + 3}, 'pending')`).join(', ')}
        ON CONFLICT 
            (request_id, potential_helper_id) DO NOTHHING -- Avoid errors if somehow offered twice.
        RETURNING id, request_id, potential_helper_id;
    `;

    const values = matches.flatMap(match => [requestId, match.id, match.score]);

    try{
        const results = await pool.query(query, values);
        console.log(`Inserted ${results.rowCount} potential mactches for request ID ${requestId}`);
        return results.rows;
    }
    catch (err){
        console.error(`Error creating potential matches for request ID ${requestId}: \n`, err);
        throw err
    }
}

async function updateRequestStatus(requestId, status, matchedHelperId = null){
    const query = ` 
        UPDATE help_requests
        SET 
            status = $1,
            matched_helper_id = $2, -- Set the final helper ID here
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
        RETURNING id, status, matched_helper_id;
    `;
    const values = [status, matchedHelperId, requestId];
    try {
        const result = await pool.query(query, values);
        if (result.rowCount === 0) {
             console.warn(`Attempted to update status for non-existent request ID: ${requestId}`);
             return null;
        }
        console.log(`Request ${requestId} status updated to ${status}. Matched Helper: ${matchedHelperId || 'None'}.`);
        return result.rows[0];
    } 
    catch (err) {
        console.error(`Error updating request status for ID (${requestId}):`, err);
        throw err;
    }
}

// Function to get requests created by a user (for history page)
async function findRequestsByRequester(userId, page = 1, limit = 10) {
    const offset = (page - 1) * limit;
    // Join with users table to get helper name if matched
    const query = `
        SELECT
            r.id, r.task_type, r.comments, r.status, r.created_at, r.updated_at,
            r.scheduled_datetime, r.location_address,
            u.first_name AS helper_first_name,
            u.last_name AS helper_last_name
        FROM help_requests r
        LEFT JOIN users u ON r.matched_helper_id = u.id
        WHERE r.req_user_id = $1
        ORDER BY r.created_at DESC
        LIMIT $2 OFFSET $3;
    `;
    // Also get total count for pagination
    const countQuery = `SELECT COUNT(*) FROM help_requests WHERE req_user_id = $1;`;

    try {
        const [result, countResult] = await Promise.all([
             pool.query(query, [userId, limit, offset]),
             pool.query(countQuery, [userId])
        ]);
        const totalRequests = parseInt(countResult.rows[0].count, 10);
        const totalPages = Math.ceil(totalRequests / limit);
        return {
            requests: result.rows,
            totalPages: totalPages,
            currentPage: page
        };
    } catch (err) {
        console.error(`Error finding requests for user ${userId}:`, err);
        throw err;
    }
}

// --- Add functions for potential_matches interaction ---

async function findPendingMatchesForHelper(helperId, page = 1, limit = 10) {
    const offset = (page - 1) * limit;
    // Join with requests and requester user details
    const query = `
        SELECT
            pm.id AS match_id, pm.score, pm.offered_at,
            r.id AS request_id, r.task_type, r.comments, r.created_at AS request_created_at,
            r.scheduled_datetime, r.location_address,
            u.first_name AS requester_first_name,
            u.last_name AS requester_last_name,
            u.age AS requester_age -- Add other requester details you want to show (be mindful of privacy)
        FROM potential_matches pm
        JOIN help_requests r ON pm.request_id = r.id
        JOIN users u ON r.req_user_id = u.id
        WHERE pm.potential_helper_id = $1 AND pm.status = 'pending'
        ORDER BY pm.offered_at DESC
        LIMIT $2 OFFSET $3;
    `;
    const countQuery = `SELECT COUNT(*) FROM potential_matches WHERE potential_helper_id = $1 AND status = 'pending';`;

    try {
        const [result, countResult] = await Promise.all([
            pool.query(query, [helperId, limit, offset]),
            pool.query(countQuery, [helperId])
        ]);
        const totalMatches = parseInt(countResult.rows[0].count, 10);
        const totalPages = Math.ceil(totalMatches / limit);
        return {
            matches: result.rows,
            totalPages: totalPages,
            currentPage: page
        };
    } catch (err) {
        console.error(`Error finding pending matches for helper ${helperId}:`, err);
        throw err;
    }
}

async function findPotentialMatchById(matchId) {
    const query = `SELECT * FROM potential_matches WHERE id = $1;`;
    try {
        const result = await pool.query(query, [matchId]);
        return result.rows[0];
    } catch (err) {
        console.error(`Error finding potential match by ID ${matchId}:`, err);
        throw err;
    }
}

async function updatePotentialMatchStatus(matchId, status) {
    const query = `
        UPDATE potential_matches
        SET status = $1, responded_at = CURRENT_TIMESTAMP
        WHERE id = $2 AND status = 'pending' -- Only update if still pending
        RETURNING *;`; // Return the updated row
    try {
        const result = await pool.query(query, [status, matchId]);
        return result.rows[0]; // Will be undefined if match wasn't pending or didn't exist
    } catch (err) {
        console.error(`Error updating potential match status for ID ${matchId}:`, err);
        throw err;
    }
}

// Function to cancel other pending offers for the same request
async function cancelOtherPendingMatches(requestId, acceptedMatchId) {
    const query = `
        UPDATE potential_matches
        SET status = 'cancelled', responded_at = CURRENT_TIMESTAMP
        WHERE request_id = $1 AND status = 'pending' AND id != $2;`;
    try {
        const result = await pool.query(query, [requestId, acceptedMatchId]);
        console.log(`Cancelled ${result.rowCount} other pending matches for request ${requestId}.`);
        return result.rowCount;
    } catch (err) {
        console.error(`Error cancelling other matches for request ${requestId}:`, err);
        throw err;
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
    createPotentialMatches, // New
    updateRequestStatus,    // Renamed/Modified
    findRequestsByRequester,// New
    findPendingMatchesForHelper, // New
    findPotentialMatchById, // New
    updatePotentialMatchStatus, // New
    cancelOtherPendingMatches, // New
    updateRequestMatchDetails // New
};