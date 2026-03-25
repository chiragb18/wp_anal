const express = require('express');
const { getMessages, createMessages, createChatBackup, getMessagesByChatId } = require('../controllers/messageController');

const router = express.Router();

router.route('/')
  .get(getMessages)
  .post(createMessages);

router.route('/:chatId')
  .get(getMessagesByChatId);

router.route('/backup')
  .post(createChatBackup);

// Requirement: Standardized export route alias for frontend compatibility
router.route('/export')
  .post(createChatBackup);

module.exports = router;
