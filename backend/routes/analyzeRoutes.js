// routes/analyzeRoutes.js - Resume analysis route

const express = require('express');
const router = express.Router();
const { analyzeResume, handleWebhook, getQuota } = require('../controllers/analyzeController');
const { protect } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

// GET /api/analyze/quota
// Protected: check remaining daily trials for user
router.get('/quota', protect, getQuota);

// POST /api/analyze
// Protected: requires JWT
// Accepts: multipart/form-data with 'resume' (PDF) and 'jobDescription' (string)
router.post(
  '/',
  protect,
  upload.single('resume'), // 'resume' is the field name
  analyzeResume
);

// POST /api/analyze/webhook/:id
// Public (Internal Webhook): Receives data from Python service
router.post('/webhook/:id', handleWebhook);

module.exports = router;
