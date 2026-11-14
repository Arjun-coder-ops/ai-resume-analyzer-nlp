// routes/analyzeRoutes.js - Resume analysis route

const express = require('express');
const router = express.Router();
const { analyzeResume, handleWebhook, getQuota } = require('../controllers/analyzeController');
const { protect } = require('../middleware/authMiddleware');
const { upload, validatePdfSignature } = require('../middleware/uploadMiddleware');
const { analysisLimiter } = require('../middleware/rateLimitMiddleware');
const { requireCsrf } = require('../middleware/csrfMiddleware');

// GET /api/analyze/quota
// Protected: check remaining daily trials for user
router.get('/quota', protect, getQuota);

// POST /api/analyze
// Protected: requires JWT
// Accepts: multipart/form-data with 'resume' (PDF) and 'jobDescription' (string)
router.post(
  '/',
  protect,
  requireCsrf,
  analysisLimiter,
  upload.single('resume'), // 'resume' is the field name
  validatePdfSignature,
  analyzeResume
);

// POST /api/analyze/webhook/:id
// Public (Internal Webhook): Receives data from Python service
router.post('/webhook/:id', handleWebhook);

module.exports = router;
