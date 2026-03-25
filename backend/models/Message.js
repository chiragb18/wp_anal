const mongoose = require('mongoose');

/**
 * Message Model for WhatsApp AI Analyzer
 * Fills Requirement 5 & 6 (Storage & De-duplication)
 */
const messageSchema = new mongoose.Schema({
  id: { type: String, unique: true, required: true },
  messageId: { type: String }, // Legacy support
  chatId: { type: String, required: true },
  chat_name: { type: String }, // Internal name
  chatName: { type: String },  // Display name
  sender: { type: String, required: true },
  message: { type: String },
  timestamp: { type: Date, required: true },
  timestampIST: { type: String },
  type: { type: String, default: 'chat' },
  hasMedia: { type: Boolean, default: false }
}, {
  timestamps: true 
});

// Optimization: Specific indexes for fast retrieval and ordering
messageSchema.index({ chatId: 1, timestamp: -1 });
messageSchema.index({ chat_name: 1 });
messageSchema.index({ timestamp: -1 });

module.exports = mongoose.model('Message', messageSchema);
