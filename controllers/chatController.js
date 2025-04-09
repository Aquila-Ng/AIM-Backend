const chatModel = require('../models/chatModel');

async function getUserChats(req, res) {
    try {
        const userId = req.user.userId; // From authenticateToken middleware
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 10;

        const chatData = await chatModel.findChatsByUser(userId, page, limit);
        res.status(200).json(chatData);

    }
    catch (error) {
        console.error('Error fetching user chats:', error);
        res.status(500).json({ error: 'Failed to retrieve chats.' });
    }
}

// Get messages for a specific chat
async function getChatMessages(req, res) {
    try {
        const userId = req.user.userId;
        const chatId = parseInt(req.params.chatId, 10);
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 20; // Default limit for messages

        if (isNaN(chatId)) {
            return res.status(400).json({ error: 'Invalid chat ID.' });
        }

        // Verify user is part of this chat before fetching messages
        const chat = await chatModel.findChatByIdAndUser(chatId, userId);
        if (!chat) {
            return res.status(403).json({ error: 'Access denied to this chat.' });
        }

        const messageData = await chatModel.findMessagesByChat(chatId, page, limit);
        res.status(200).json(messageData);

    } 
    catch (error) {
        console.error(`Error fetching messages for chat ${req.params.chatId}:`, error);
        res.status(500).json({ error: 'Failed to retrieve messages.' });
    }
}

// Post a new message to a chat
async function postMessageToChat(req, res) {
    try {
        const userId = req.user.userId;
        const chatId = parseInt(req.params.chatId, 10);
        const { content } = req.body;

        if (isNaN(chatId)) {
            return res.status(400).json({ error: 'Invalid chat ID.' });
        }
        if (!content || typeof content !== 'string' || content.trim().length === 0) {
            return res.status(400).json({ error: 'Message content cannot be empty.' });
        }
        if (content.length > 2000) { // Add a reasonable length limit
             return res.status(400).json({ error: 'Message content is too long.' });
        }

        // Verify user is part of this chat before allowing post
        const chat = await chatModel.findChatByIdAndUser(chatId, userId);
        if (!chat) {
            return res.status(403).json({ error: 'Access denied to this chat.' });
        }

        const newMessage = await chatModel.createMessage(chatId, userId, content.trim());

        // Optional: Use Socket.IO here to broadcast the message to other users in the chat
        // For now, just return the created message
        res.status(201).json(newMessage);

    } 
    catch (error) {
        console.error(`Error posting message to chat ${req.params.chatId}:`, error);
        res.status(500).json({ error: 'Failed to send message.' });
    }
}

module.exports = {
    getUserChats,
    getChatMessages,
    postMessageToChat
};
