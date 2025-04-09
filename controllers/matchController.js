const requestModel = require('../models/requestModel'); // Contains match functions now
const {pool} = require('../config/db');

// Controller to get pending matches for the logged-in helper
async function getPendingMatches(req, res) {
    
    try {
        if (!req.user || !req.user.userId) {
            return res.status(401).json({ error: 'User not authenticated.' });
        }
        const helperId = req.user.userId;
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 10;

        const pendingMatchesData = await requestModel.findPendingMatchesForHelper(helperId, page, limit);

        res.status(200).json(pendingMatchesData);

    } catch (err) {
        console.error('Error fetching pending matches:', err);
        res.status(500).json({ error: 'Failed to fetch pending matches.' });
    }
}

// Controller to accept a match offer
// async function acceptMatch(req, res) {
//     try {
//         if (!req.user || !req.user.userId) {
//             return res.status(401).json({ error: 'User not authenticated.' });
//         }
//         const helperId = req.user.userId;
//         const matchId = parseInt(req.params.matchId, 10);

//         if (isNaN(matchId)) {
//              return res.status(400).json({ error: 'Invalid match ID.' });
//         }

//         // 1. Find the potential match record
//         const match = await requestModel.findPotentialMatchById(matchId);

//         if (!match) {
//             return res.status(404).json({ error: 'Match offer not found.' });
//         }

//         // 2. Authorization: Check if the logged-in user is the intended helper
//         if (match.potential_helper_id !== helperId) {
//             return res.status(403).json({ error: 'You are not authorized to respond to this offer.' });
//         }

//         // 3. Check if the match is still pending
//         if (match.status !== 'pending') {
//             return res.status(400).json({ error: `Match offer is already ${match.status}.` });
//         }

//         // --- Transaction recommended here to ensure atomicity ---
//         // Using basic sequential awaits for simplicity, wrap in transaction in production
//         const client = await requestModel.pool.connect(); // Assuming pool is exported from model/db
//         try {
//              await client.query('BEGIN');

//              // 4. Update the potential_match status to 'accepted'
//              const updatedMatch = await requestModel.updatePotentialMatchStatus(matchId, 'accepted'); // Use this function directly now
//              if (!updatedMatch) {
//                   // This means status wasn't 'pending' when update was attempted (race condition?)
//                   throw new Error('Failed to update match status, it might have been resolved already.');
//              }

//              // 5. Update the help_request status and set matched_helper_id
//              await requestModel.updateRequestStatus(match.request_id, 'matched', helperId);

//              // 6. Cancel other pending offers for the same request
//              await requestModel.cancelOtherPendingMatches(match.request_id, matchId);

//              // 7. Create the chat entry
//              const request = await requestModel.findRequestById(match.request_id); // Need requester ID
//              if (request) {
//                   await requestModel.createChat(match.request_id, request.req_user_id, helperId);
//              } else {
//                   console.warn(`Could not find request ${match.request_id} to create chat.`);
//              }

//              await client.query('COMMIT');
//              res.status(200).json({ message: 'Match accepted successfully. Chat initiated.' });

//         } catch (error) {
//              await client.query('ROLLBACK');
//              console.error(`Error accepting match ${matchId}:`, error);
//              res.status(500).json({ error: 'Failed to accept match offer.' });
//         } finally {
//              client.release();
//         }
//         // --- End Transaction ---

//     } catch (err) {
//         console.error('Error processing accept match:', err);
//         res.status(500).json({ error: 'An unexpected error occurred.' });
//     }
// }

async function acceptMatch(req, res) {
    try {
        if (!req.user || !req.user.userId) {
            return res.status(401).json({ error: 'User not authenticated.' });
        }
        const helperId = req.user.userId;
        const matchId = parseInt(req.params.matchId, 10);

        if (isNaN(matchId)) {
             return res.status(400).json({ error: 'Invalid match ID.' });
        }

        // 1. Find the potential match record
        const match = await requestModel.findPotentialMatchById(matchId);

        if (!match) {
            return res.status(404).json({ error: 'Match offer not found.' });
        }

        // 2. Authorization: Check if the logged-in user is the intended helper
        if (match.potential_helper_id !== helperId) {
            return res.status(403).json({ error: 'You are not authorized to respond to this offer.' });
        }

        // 3. Check if the match is still pending
        if (match.status !== 'pending') {
            return res.status(400).json({ error: `Match offer is already ${match.status}.` });
        }

        // --- Transaction recommended here to ensure atomicity ---
        let client;
        try {
             client = await pool.connect(); // Acquire a client from the pool
             await client.query('BEGIN');

             // 4. Update the potential_match status to 'accepted'
             const updatedMatch = await requestModel.updatePotentialMatchStatus(matchId, 'accepted', client); // Pass the client
             if (!updatedMatch) {
                  throw new Error('Failed to update match status, it might have been resolved already.');
             }

             // 5. Update the help_request status and set matched_helper_id
             await requestModel.updateRequestStatus(match.request_id, 'matched', helperId, client); // Pass the client

             // 6. Cancel other pending offers for the same request
             await requestModel.cancelOtherPendingMatches(match.request_id, matchId, client); // Pass the client

             // 7. Create the chat entry
             const request = await requestModel.findRequestById(match.request_id, client); // Pass the client
             if (request) {
                //   await requestModel.createChat(match.request_id, request.req_user_id, helperId, client); // Pass the client
             } else {
                  console.warn(`Could not find request ${match.request_id} to create chat.`);
             }

             await client.query('COMMIT');
             res.status(200).json({ message: 'Match accepted successfully. Chat initiated.' });

        } catch (error) {
             if (client) {
                  await client.query('ROLLBACK');
             }
             console.error(`Error accepting match ${matchId}:`, error);
             res.status(500).json({ error: 'Failed to accept match offer.' });
        } finally {
             if (client) {
                  client.release(); // Release the client back to the pool
             }
        }
        // --- End Transaction ---

    } catch (err) {
        console.error('Error processing accept match:', err);
        res.status(500).json({ error: 'An unexpected error occurred.' });
    }
}

// Controller to decline a match offer
async function declineMatch(req, res) {
     try {
        if (!req.user || !req.user.userId) {
            return res.status(401).json({ error: 'User not authenticated.' });
        }
        const helperId = req.user.userId;
        const matchId = parseInt(req.params.matchId, 10);

        if (isNaN(matchId)) {
             return res.status(400).json({ error: 'Invalid match ID.' });
        }

        const match = await requestModel.findPotentialMatchById(matchId);

        if (!match) {
            return res.status(404).json({ error: 'Match offer not found.' });
        }
        if (match.potential_helper_id !== helperId) {
            return res.status(403).json({ error: 'You are not authorized to respond to this offer.' });
        }
        if (match.status !== 'pending') {
            return res.status(400).json({ error: `Match offer is already ${match.status}.` });
        }

        // Update status to 'declined'
        const updatedMatch = await requestModel.updatePotentialMatchStatus(matchId, 'declined');

        if (updatedMatch) {
             res.status(200).json({ message: 'Match declined successfully.' });
             // Optional: Trigger logic here to offer the request to the next-best helper if desired.
        } else {
             res.status(400).json({ error: 'Failed to decline match, status might have changed.' });
        }

    } catch (err) {
        console.error('Error declining match:', err);
        res.status(500).json({ error: 'Failed to decline match offer.' });
    }
}

module.exports = {
    getPendingMatches,
    acceptMatch,
    declineMatch
};