const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const connectDB = require('./config/db');
const { initializeWhatsApp } = require('./whatsapp');

// Routes
const whatsappRoutes = require('./routes/whatsappRoutes');
const messageRoutes = require('./routes/messageRoutes');

dotenv.config();
connectDB();

const app = express();
const server = http.createServer(app);

// 1. CORS - MUST BE FIRST (Express)
const corsOptions = {
  origin: true, // Dynamically reflect the request origin
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// 1b. Socket.io with SAME CORS
const io = new Server(server, {
  cors: corsOptions,
  transports: ['polling', 'websocket']
});

// 2. Body Parsers
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// 3. Request Logger
app.use((req, res, next) => {
  console.log(`[API] ${req.method} ${req.path}`);
  next();
});

// Mount Routers
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/messages', messageRoutes);

// Root
app.get('/', (req, res) => {
  res.json({ success: true, message: 'WhatsApp AI Core Active' });
});

// Start Engine
initializeWhatsApp(io);

// Socket: respond to frontend's check-auth on connect
io.on('connection', (socket) => {
  const { getStatus, getLastQr } = require('./whatsapp');
  const status = getStatus();
  const lastQr = getLastQr();

  console.log('[Socket] Client connected. isReady:', status.isReady);

  if (status.isReady) {
    socket.emit('ready');
  } else if (lastQr) {
    socket.emit('qr', lastQr);
  }
});

// --- GLOBAL ERROR HANDLER (CRITICAL FOR CORS ERRORS) ---
app.use((err, req, res, next) => {
  console.error('[Unhandled Error]', err);
  // Re-apply CORS headers for error responses
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.status(500).json({ 
    success: false, 
    error: 'Internal Server Error',
    message: err.message 
  });
});

const PORT = process.env.PORT || 5000;

// Production Build Serving Logic
if (process.env.NODE_ENV === 'production') {
  const path = require('path');
  const frontendPath = path.join(__dirname, '../frontend/build');

  app.use(express.static(frontendPath));

  app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(path.resolve(frontendPath, 'index.html'));
  });
}

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[Server] Core running on port ${PORT} [Mode: ${process.env.NODE_ENV || 'production'}]`);
});
