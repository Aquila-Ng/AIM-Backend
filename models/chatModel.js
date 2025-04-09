const { pool } = require('../config/db');

async function createChat(requestId, requesterId, helperId) {
    const query = `
        INSERT INTO chats (request_id, requester_id, helper_id)
        VALUES ($1, $2, $3)
        ON CONFLICT (request_id) DO NOTHING -- Avoid creating duplicate chats
        RETURNING id;`;
    try {
        const result = await pool.query(query, [requestId, requesterId, helperId]);
        if (result.rowCount > 0) {
            console.log(`Chat created for request ${requestId}`);
            return result.rows[0].id;
        } else {
            // Chat might already exist, fetch its ID
            const existingChat = await pool.query('SELECT id FROM chats WHERE request_id = $1', [requestId]);
            console.log(`Chat for request ${requestId} already exists.`);
            return existingChat.rows[0]?.id;
        }
    } catch (err) {
        console.error(`Error creating chat for request ${requestId}:`, err);
        throw err;
    }
}

async function findChatsByUser(userId, page = 1, limit = 10) {
    const offset = (page - 1) * limit;
    // Join chats with requests and the 'other' user's details
    const query = `
        SELECT
            c.id AS chat_id,
            c.request_id,
            r.task_type,
            CASE
                WHEN c.requester_id = $1 THEN c.helper_id
                ELSE c.requester_id
            END AS other_user_id,
            CASE
                WHEN c.requester_id = $1 THEN u_helper.first_name
                ELSE u_requester.first_name
            END AS other_user_first_name,
            CASE
                WHEN c.requester_id = $1 THEN u_helper.last_name
                ELSE u_requester.last_name
            END AS other_user_last_name,
            -- Subquery to get the latest message preview (optional, can impact performance)
            (SELECT content FROM messages m
             WHERE m.chat_id = c.id ORDER BY m.sent_at DESC LIMIT 1) AS last_message_preview,
            (SELECT sent_at FROM messages m
             WHERE m.chat_id = c.id ORDER BY m.sent_at DESC LIMIT 1) AS last_message_time
        FROM chats c
        JOIN help_requests r ON c.request_id = r.id
        LEFT JOIN users u_requester ON c.requester_id = u_requester.id
        LEFT JOIN users u_helper ON c.helper_id = u_helper.id
        WHERE c.requester_id = $1 OR c.helper_id = $1
        ORDER BY last_message_time DESC NULLS LAST, c.created_at DESC -- Order by latest activity
        LIMIT $2 OFFSET $3;
    `;
    // Count total chats for the user
    const countQuery = `SELECT COUNT(*) FROM chats WHERE requester_id = $1 OR helper_id = $1;`;

    try {
        const [result, countResult] = await Promise.all([
            pool.query(query, [userId, limit, offset]),
            pool.query(countQuery, [userId])
        ]);
        const totalChats = parseInt(countResult.rows[0].count, 10);
        const totalPages = Math.ceil(totalChats / limit);
        return {
            chats: result.rows,
            totalPages: totalPages,
            currentPage: page
        };
    } catch (err) {
        console.error(`Error finding chats for user ${userId}:`, err);
        throw err;
    }
}

async function findMessagesByChat(chatId, page = 1, limit = 20) { // Fetch more messages per page
    const offset = (page - 1) * limit;
    // Join with sender details
    const query = `
        SELECT
            m.id AS message_id,
            m.chat_id,
            m.sender_id,
            m.content,
            m.sent_at,
            u.first_name AS sender_first_name -- Fetch sender name
        FROM messages m
        JOIN users u ON m.sender_id = u.id
        WHERE m.chat_id = $1
        ORDER BY m.sent_at ASC -- Show oldest first for typical chat view
        LIMIT $2 OFFSET $3;
    `;
    // Count total messages for potential "load more" on frontend
     const countQuery = `SELECT COUNT(*) FROM messages WHERE chat_id = $1;`;

    try {
         const [result, countResult] = await Promise.all([
            pool.query(query, [chatId, limit, offset]),
            pool.query(countQuery, [chatId])
         ]);
         const totalMessages = parseInt(countResult.rows[0].count, 10);
         const totalPages = Math.ceil(totalMessages / limit); // Total pages if loading all
        return {
            messages: result.rows,
             totalMessages: totalMessages,
             // totalPages: totalPages, // Might not be needed if using "load more"
             currentPage: page
         };
    } catch (err) {
        console.error(`Error finding messages for chat ${chatId}:`, err);
        throw err;
    }
}

async function createMessage(chatId, senderId, content) {
    const query = `
        INSERT INTO messages (chat_id, sender_id, content)
        VALUES ($1, $2, $3)
        RETURNING id, chat_id, sender_id, content, sent_at;
    `;
    const values = [chatId, senderId, content];
    try {
        const result = await pool.query(query, values);
        return result.rows[0];
    } catch (err) {
        console.error(`Error creating message for chat ${chatId} by user ${senderId}:`, err);
        throw err;
    }
}

async function findChatByIdAndUser(chatId, userId) {
    const query = `
        SELECT id, request_id, requester_id, helper_id
        FROM chats
        WHERE id = $1 AND (requester_id = $2 OR helper_id = $2);
    `;
    const values = [chatId, userId];
    try {
        const result = await pool.query(query, values);
        return result.rows[0]; // Returns chat object or undefined
    } catch (err) {
        console.error(`Error verifying user ${userId} access to chat ${chatId}:`, err);
        throw err;
    }
}

module.exports = {
    createChat,
    findChatsByUser,
    findMessagesByChat,
    createMessage,
    findChatByIdAndUser
}
