const express = require('express');
const router = express.Router();
const { getChats, getMessages, getClientStatus } = require('../whatsapp');
const Message = require('../models/Message');

/**
 * Requirement 3: GET /chats
 * Returns all chats
 */
router.get('/chats', async (req, res) => {
    try {
        if (!getClientStatus()) {
            return res.status(503).json({ error: 'WhatsApp is initializing...' });
        }
        
        let chats = await getChats();
        
        // Bonus Requirement 7: Filter personal vs groups
        if (req.query.type === 'group') {
            chats = chats.filter(c => c.isGroup);
        } else if (req.query.type === 'personal') {
            chats = chats.filter(c => !c.isGroup);
        }
        
        res.json({ success: true, count: chats.length, data: chats });
    } catch (error) {
        console.error('Fetch Chats Error:', error.message);
        res.status(500).json({ error: 'Failed to fetch chats' });
    }
});

/**
 * Requirement 4 & 5: GET /messages/:chatId
 * Fetch and store in MongoDB
 */
router.get('/messages/:chatId', async (req, res) => {
    try {
        const { chatId } = req.params;
        const messages = await getMessages(chatId, 100);
        
        // Requirement 6: No duplicate message insertion using unique messageId
        const savedMessages = [];
        for (const msg of messages) {
            // Create a unique messageId based on chat, sender and timestamp
            const messageId = `${chatId}-${msg.timestamp.getTime()}-${msg.sender.length}`;
            
            const updated = await Message.findOneAndUpdate(
                { messageId },
                { ...msg, messageId },
                { upsert: true, new: true }
            );
            savedMessages.push(updated);
        }
        
        res.json({ success: true, count: messages.length, data: messages });
    } catch (error) {
        console.error('Export Messages Error:', error.message);
        res.status(500).json({ error: 'Failed to export messages from chat: ' + error.message });
    }
});

module.exports = router;
