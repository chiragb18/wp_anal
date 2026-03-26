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

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cors());

// Mount Routers (THIS FIXES THE 404s)
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
    // Already authenticated and ready — tell the frontend immediately
    socket.emit('ready');
  } else if (lastQr) {
    // QR is waiting to be scanned — resend it to this client
    socket.emit('qr', lastQr);
  }
  // else: WhatsApp is still initializing, frontend will wait for 'qr' or 'ready' events
});

const PORT = process.env.PORT || 5000;

// Production Build Serving Logic (Professional Senior Refactoring)
// Production Build Serving Logic (Professional Senior Refactoring for Express 5)
if (process.env.NODE_ENV === 'production') {
  const path = require('path');
  const frontendPath = path.join(__dirname, '../frontend/build');

  app.use(express.static(frontendPath));

  // SENIOR FOOLPROOF ROUTING: Using a direct Regex to avoid Path-to-Regexp parsing errors.
  // This matches any request that is NOT an API call and serves the React frontend.
  app.get(/^(?!\/api).*/, (req, res) => {
    const path = require('path');
    const frontendPath = path.join(__dirname, '../frontend/build');
    res.sendFile(path.resolve(frontendPath, 'index.html'));
  });
}

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[Server] Core running on port ${PORT} [Mode: ${process.env.NODE_ENV || 'development'}]`);
});
