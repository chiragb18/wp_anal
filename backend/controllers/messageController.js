const mongoose = require('mongoose');
const Message = require('../models/Message');
const ChatBackup = require('../models/ChatBackup');

// @desc    Get all captured messages
// @route   GET /api/messages
// @access  Public
const Object = {
  getMessages: async (req, res) => {
    try {
      console.time('Fetch All Messages');
      const messages = await Message.find().lean().sort({ timestamp: -1 });
      console.timeEnd('Fetch All Messages');
      res.status(200).json({ success: true, count: messages.length, data: messages });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, error: 'Server Error' });
    }
  },

  // @desc    Fast export API for specific chat
  // @route   GET /api/messages/:chatId
  getMessagesByChatId: async (req, res) => {
    try {
      const { chatId } = req.params;
      console.time(`Export API Time: ${chatId}`);
      
      // .lean() for ultra-fast pure JSON conversion without Mongoose overhead
      const messages = await Message.find({ chatId }).lean().sort({ timestamp: 1 });
      
      console.timeEnd(`Export API Time: ${chatId}`);
      
      res.status(200).json({ success: true, count: messages.length, data: messages });
    } catch (error) {
      console.error('Fast Export Error:', error);
      res.status(500).json({ success: false, error: 'Fast Export Error' });
    }
  },

  // @desc    Bulk store messages (Export from frontend)
  // @route   POST /api/messages
  createMessages: async (req, res) => {
    try {
      const { messages } = req.body;
      if (!messages || !Array.isArray(messages)) {
         return res.status(400).json({ success: false, error: 'Invalid message data' });
      }

      // Filter out any messages that are missing the 'id' field
      const validMessages = messages.filter(m => m.id);

      if (validMessages.length === 0) {
        return res.status(200).json({ success: true, message: 'No new messages to save', count: 0 });
      }

      // Format/Map messages to include IST timestamp string and align with model
      const formattedInput = validMessages.map(m => {
          const date = m.timestamp ? new Date(m.timestamp) : new Date();
          return {
              id: m.id,
              messageId: m.id, // Legacy support
              chatId: m.chatId,
              chatName: m.chatName,
              chat_name: m.chatName,
              sender: m.sender || 'Unknown',
              message: m.message || '',
              timestamp: date,
              timestampIST: date.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
              hasMedia: !!m.hasMedia,
              type: m.type || 'chat'
          };
      });
      
      // Bulk insert messages. ordered: false allows it to continue if some exist (duplicates)
      try {
        const savedMessages = await Message.insertMany(formattedInput, { ordered: false });
        res.status(201).json({ success: true, count: savedMessages.length, data: savedMessages });
      } catch (insertErr) {
        // Handle common bulk insert errors (e.g. duplicate keys)
        if (insertErr.code === 11000 || (insertErr.writeErrors && insertErr.writeErrors.length > 0)) {
           const writeErrors = insertErr.writeErrors || [];
           const insertedCount = validMessages.length - writeErrors.length;
           res.status(201).json({ 
             success: true, 
             message: 'Export completed (duplicates skipped)', 
             count: insertedCount 
           });
        } else {
          console.error('Bulk Insert Error:', insertErr);
          res.status(500).json({ success: false, error: 'Database error during export' });
        }
      }
    } catch (error) {
       console.error('Critical Export Error:', error);
       res.status(500).json({ success: false, error: 'Failed to process export request' });
    }
  },

  // @desc    Store named chat backup
  // @route   POST /api/messages/backup
  // @desc    Store named chat backup - SERVER SIDE OPTIMIZED
  // @route   POST /api/messages/export
  createChatBackup: async (req, res) => {
    const start = Date.now();
    try {
      const { chatId, chatName, backupName, filters = {} } = req.body;
      
      console.log(`🚀 [Export] Starting server-side backup for ${chatId} -> "${backupName}"`);

      if (!backupName || !chatId) {
        return res.status(400).json({ success: false, error: 'chatId and backupName are required' });
      }

      // Build Query from filters
      const query = { chatId };
      if (filters.searchTerm) {
        query.message = { $regex: filters.searchTerm, $options: 'i' };
      }
      if (filters.filterDate) {
        const date = new Date(filters.filterDate);
        const nextDay = new Date(date);
        nextDay.setDate(date.getDate() + 1);
        query.timestamp = { $gte: date, $lt: nextDay };
      }

      // 1. FETCH FROM DB (NOT FRONTEND)
      const messages = await Message.find(query).lean();
      
      if (messages.length === 0) {
        return res.status(200).json({ success: true, message: 'No messages found matching criteria', count: 0 });
      }

      // 2. Format for backup collection
      const formatted = messages.map(m => ({
          ...m,
          _id: new mongoose.Types.ObjectId(), // New IDs for backup collection
          exportedAt: new Date(),
          exportedAtIST: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
      }));

      // 3. BULK INSERT TO DYNAMIC COLLECTION
      const collectionName = String(backupName).trim();
      const db = mongoose.connection.db;
      await db.collection(collectionName).insertMany(formatted);

      // 4. RECORD IN SUMMARY COLLECTION
      const backupIndex = new ChatBackup({
        chatId: String(chatId),
        chatName: String(chatName || 'Unknown'),
        backupName: collectionName,
        messageCount: messages.length,
        exportedAt: new Date(),
        exportedAtIST: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
      });
      await backupIndex.save();
      
      console.log(`⏱️ [Export] Completed in ${Date.now() - start}ms | Messages: ${messages.length}`);
      res.status(201).json({ 
        success: true, 
        message: `Successfully exported ${messages.length} messages to: ${collectionName}`, 
        count: messages.length 
      });

    } catch (error) {
      console.error('Export Error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
};

module.exports = Object;
