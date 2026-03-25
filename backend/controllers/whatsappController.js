const { getClient, getStatus, syncAllChats, logoutAndReset, getCachedChats, triggerOnDemandMessageSync } = require('../whatsapp');
const Chat = require('../models/Chat');
const Message = require('../models/Message');

const whatsappController = {
  // @desc    Get all active WhatsApp chats with memory caching
  getChats: async (req, res) => {
    const start = Date.now();
    try {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      const forceRefresh = req.query.refresh === 'true';

      // Instant Retrieval Strategy: Check memory, fallback immediately to fast DB query
      let chats = getCachedChats();
      if (chats.length === 0) {
        // High-speed lean query for instant initial loading
        chats = await Chat.find().sort({ timestamp: -1 }).lean();
      }
      
      if (forceRefresh) {
        // Async trigger to not block the request
        syncAllChats().catch(() => {});
      }

      console.log(`⏱️ [API] getChats: ${Date.now() - start}ms | Cached: ${chats.length > 0}`);
      res.status(200).json({ success: true, count: chats.length, data: chats });
    } catch (error) {
      console.error('getChats error:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch chats' });
    }
  },

  // @desc    Get Real-time count of messages in a chat
  getChatCount: async (req, res) => {
    const start = Date.now();
    try {
      const { chatId } = req.params;
      const count = await Message.countDocuments({ chatId });
      
      console.log(`⏱️ [API] getChatCount for ${chatId}: ${Date.now() - start}ms | Count: ${count}`);
      res.status(200).json({ success: true, count });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to get count' });
    }
  },

  // @desc    Optimized historical message loading with pagination
  getMessagesByChatId: async (req, res) => {
    const start = Date.now();
    try {
      const { chatId } = req.params;
      const limit = parseInt(req.query.limit) || 50; // Optimized default: 50
      const before = req.query.before;
      
      // LAZY SYNC: Fetch newer messages if no 'before' (top of chat)
      if (!before) {
        triggerOnDemandMessageSync(chatId, limit).catch(e => {});
      }

      let query = { chatId };
      if (before) {
        const beforeMsg = await Message.findOne({ id: before });
        if (beforeMsg) query.timestamp = { $lt: beforeMsg.timestamp };
      }
      
      const messages = await Message.find(query)
        .sort({ timestamp: -1 })
        .limit(limit);

      console.log(`⏱️ [API] getMessagesByChatId: ${Date.now() - start}ms | Limit: ${limit} | Found: ${messages.length}`);
      res.status(200).json({ success: true, count: messages.length, data: messages });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Error loading messages' });
    }
  },

  triggerSync: async (req, res) => {
    try {
      const client = getClient();
      if (!client) return res.status(503).json({ success: false, error: 'WhatsApp not ready' });

      await syncAllChats();
      res.status(200).json({ success: true, message: 'Sync triggered' });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  logout: async (req, res) => {
    try {
      await logoutAndReset();
      res.status(200).json({ success: true, message: 'Logged out' });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Logout failed' });
    }
  }
};

module.exports = whatsappController;
