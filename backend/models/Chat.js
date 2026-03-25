const mongoose = require('mongoose');

const ChatSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, default: 'Unknown Chat' },
  isGroup: { type: Boolean, default: false },
  unreadCount: { type: Number, default: 0 },
  messageCount: { type: Number, default: 0 }, // Track total messages for real-time count
  timestamp: { type: Date },
  profilePic: { type: String },
  lastSync: { type: Date, default: null }, // Track last successful incremental sync
  lastSyncIST: { type: String }
});

// Optimization: Senior Backend Engineer standard indexes
ChatSchema.index({ name: 1 });
ChatSchema.index({ timestamp: -1 });

module.exports = mongoose.model('Chat', ChatSchema);
