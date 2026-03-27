const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/whatsapp-ai';
    console.log(`[DB] Attempting connection...`);
    
    const conn = await mongoose.connect(mongoUri, {
      connectTimeoutMS: 10000, // Wait 10s max
    });
    console.log(`✅ [DB] MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ [DB] MongoDB Connection Error: ${error.message}`);
    console.error(`[DB] FATAL: Your MONGO_URI environment variable may be missing or incorrect.`);
    // We DON'T exit(1) anymore. We let the server start so it can respond with 500s instead of 502s.
    // This makes debugging much easier for the user!
  }
};

module.exports = connectDB;
