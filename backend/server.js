// ============================================================
// server.js - Main entry point for the Express backend
// ============================================================

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const connectDB = require('./config/db');

// Load environment variables
dotenv.config();

// Connect to MongoDB
connectDB();

const app = express();

// ── Middleware ──────────────────────────────────────────────
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve uploaded files statically (for debugging only)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const { errorMiddleware, notFound } = require('./middleware/errorMiddleware');

// ── Routes ──────────────────────────────────────────────────
app.use('/api/auth',    require('./routes/authRoutes'));
app.use('/api/analyze', require('./routes/analyzeRoutes'));
app.use('/api/history', require('./routes/historyRoutes'));

// ── Health check endpoint ───────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Smart Resume Analyzer API is running', timestamp: new Date().toISOString() });
});

// ── Error Handlers (Structured) ─────────────────────────────
app.use(notFound);      // 404 middleware
app.use(errorMiddleware); // Global error middleware

const PORT = process.env.PORT || 5000;

// Export for testing, but only listen if not in a test environment
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 Server running on port ${PORT}`);
    console.log(`📊 Environment: ${process.env.NODE_ENV}`);
    console.log(`🔗 Health: http://0.0.0.0:${PORT}/api/health\n`);
  });
}

module.exports = app;
