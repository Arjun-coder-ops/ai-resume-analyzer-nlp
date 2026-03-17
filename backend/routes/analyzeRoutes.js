// routes/analyzeRoutes.js - Resume analysis route

const express = require('express');
const router = express.Router();
const { analyzeResume } = require('../controllers/analyzeController');
const { protect } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

// POST /api/analyze
// Protected: requires JWT
// Accepts: multipart/form-data with 'resume' (PDF) and 'jobDescription' (string)
router.post(
  '/',
  protect,
  upload.single('resume'), // 'resume' is the field name
  analyzeResume
);

module.exports = router;
