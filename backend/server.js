// ============================================================
// server.js - Main entry point for the Express backend
// ============================================================

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const dotenv = require('dotenv');
const path = require('path');
const connectDB = require('./config/db');
const { assertApiRuntimeConfig } = require('./config/runtime');

// Load environment variables
dotenv.config();

const app = express();

// Initialize the background queue worker
require('./queue/analyzeQueue');

// ── Middleware ──────────────────────────────────────────────
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'same-site' },
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

const { apiLimiter, ensureRateLimitReady } = require('./middleware/rateLimitMiddleware');
app.use('/api', apiLimiter);

// NOTE: Public static serving of uploaded files (e.g., app.use('/uploads', express.static(...)))
// has been permanently removed to protect candidate confidentiality and prevent unauthenticated access.
// Legitimate file downloads are authenticated and ownership-verified via /api/history/:id/resume.

const { errorMiddleware, notFound } = require('./middleware/errorMiddleware');

// ── Routes ──────────────────────────────────────────────────
app.use('/api/auth',    require('./routes/authRoutes'));
app.use('/api/analyze', require('./routes/analyzeRoutes'));
app.use('/api/history', require('./routes/historyRoutes'));

// ── Health check endpoint ───────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Smart Resume Analyzer API is running', timestamp: new Date().toISOString() });
});

app.get('/api/ready', (req, res) => {
  const mongoose = require('mongoose');
  const databaseReady = mongoose.connection.readyState === 1;
  if (!databaseReady) {
    return res.status(503).json({ status: 'NOT_READY', message: 'Database connection is not ready.' });
  }
  return res.json({ status: 'READY' });
});

// ── Error Handlers (Structured) ─────────────────────────────
app.use(notFound);        // 404 middleware
app.use(errorMiddleware); // Global error middleware

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    assertApiRuntimeConfig();
    await connectDB();
    const { ensureQueueReady } = require('./queue/analyzeQueue');
    await ensureQueueReady();
    await ensureRateLimitReady();

    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`\n🚀 Server running on port ${PORT}`);
      console.log(`📊 Environment: ${process.env.NODE_ENV}`);
      console.log(`🔗 Health: http://0.0.0.0:${PORT}/api/health\n`);
    });

  const { reconcileStaleJobs } = require('./queue/analyzeQueue');

  // Reconcile any orphaned/stale analyses left in 'processing' across server restarts
  setTimeout(() => {
    reconcileStaleJobs().catch((err) => {
      console.error('[Server] Startup reconciliation error:', err.message);
    });
  }, 3000);

  // Periodic reconciliation every 5 minutes
  setInterval(() => {
    reconcileStaleJobs().catch((err) => {
      console.error('[Server] Periodic reconciliation error:', err.message);
    });
  }, 5 * 60 * 1000);

    return server;
  } catch (error) {
    console.error(`❌ API startup failed: ${error.message}`);
    process.exitCode = 1;
    return null;
  }
};

// Export for testing, but only start after dependencies are ready.
if (process.env.NODE_ENV !== 'test') {
  startServer();
}

module.exports = app;
module.exports.startServer = startServer;
