const express = require('express');
const { getChats, getMessagesByChatId, logout, triggerSync, getChatCount } = require('../controllers/whatsappController');

const router = express.Router();

router.route('/chats').get(getChats);
router.route('/sync').post(triggerSync);
router.route('/chats/:chatId/messages').get(getMessagesByChatId);
router.route('/messages/:chatId').get(getMessagesByChatId); // User requirement 7
router.route('/chats/:chatId/count').get(getChatCount);
router.route('/chat/:chatId/count').get(getChatCount); // Match senior engineer requirement
router.route('/logout').post(logout);

module.exports = router;
