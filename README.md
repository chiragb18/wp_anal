# 🚀 WhatsApp AI Chat Analyzer

A production-grade, high-performance WhatsApp Web integration designed for real-time monitoring, deep historical archival, and future AI-driven insights. 

**This project is a full-stack dashboard featuring architectural design patterns for speed, accuracy, and scalability.**

---

## 🛠️ Technology Stack
- **Frontend**: React.js with Material UI (MUI) Premium Dark Theme.
- **Backend**: Node.js (Express), Socket.io for Real-time streaming.
- **WhatsApp Engine**: [whatsapp-web.js](https://github.com/pedroslopez/whatsapp-web.js).
- **Database**: MongoDB (Mongoose) with professional indexing and lean queries.
- **AI Ready**: Python-supported `ai-service` module for future integration.

---

## ⚡ Key Features (Engineered for Performance)
- **🚀 High-Speed Sync**: Implemented parallel metadata retrieval for hundreds of chats, returning your dashboard from the database in milliseconds.
- **✅ Group Accuracy**: Advanced resolution for group conversations; accurately identifies sender names and pushnames instead of generic labels.
- **🔄 Instant Real-Time Flow**: Socket.io streams new messages directly into the UI while simultaneously mirroring them to the database for atomic consistency.
- **🛠️ Robust Scaling**: Lazy loading and infinite scrolling implemented on the frontend to handle 10k+ message histories without lag.
- **📁 Multi-Format Export**: Server-side processing for high-speed chat archival and export to MongoDB.

---

## 🏗️ Getting Started

### 1. Prerequisites
- Node.js (v20+)
- MongoDB (Local or Atlas)
- Git

### 2. Installations
Clone the repository and install dependencies in both the frontend and backend:

```bash
# Setup Backend
cd backend
npm install

# Setup Frontend
cd ../frontend
npm install
```

### 3. Configuration
Create a `.env` file in the `backend/` directory:
```env
PORT=5000
MONGODB_URI=your_mongodb_connection_string
NODE_ENV=development
```

### 4. How to Run
**Start the Backend:**
```bash
cd backend
npm run dev
```

**Start the Frontend:**
```bash
cd frontend
npm start
```

---

## 🚢 Deployment Logic
The project is built with a **production-first** mindset. In production, the backend serves the compiled React build automatically to minimize networking overhead and increase security.

For full deployment instructions, see the `deployment_guide.md` file in the project directory.

---

## 📂 Project Structure
```bash
/whatsapp-ai-project
├── /backend     # Node.js Server & WhatsApp Engine
├── /frontend    # React MUI Dashboard
├── /ai-service  # Future Python AI Integration
└── /tmp         # Temporary logs and exports
```

---

*Built with high-performance engineering & precision.* 🚀
