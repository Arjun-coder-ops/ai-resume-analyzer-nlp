const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Analysis = require('../models/Analysis');

// ──────────────────────────────────────────────────────────────
// @route   GET /api/history
// @desc    Get all completed and failed analyses for the logged-in user
// @access  Private
// ──────────────────────────────────────────────────────────────
const getHistory = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const [analyses, total] = await Promise.all([
      Analysis.find({ user: req.user._id, status: { $in: ['completed', 'failed'] } })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('-jobDescription'), // Exclude heavy field from list
      Analysis.countDocuments({ user: req.user._id, status: { $in: ['completed', 'failed'] } }),
    ]);

    res.json({
      success: true,
      data: analyses,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
        limit,
      },
    });
  } catch (error) {
    console.error('History fetch error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch history.' });
  }
};

// ──────────────────────────────────────────────────────────────
// @route   GET /api/history/:id
// @desc    Get a single analysis by ID (must belong to user)
// @access  Private
// ──────────────────────────────────────────────────────────────
const getAnalysisById = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ success: false, message: 'Analysis not found.' });
    }

    const analysis = await Analysis.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!analysis) {
      return res.status(404).json({ success: false, message: 'Analysis not found.' });
    }

    res.json({ success: true, data: analysis });
  } catch (error) {
    console.error('Get analysis error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch analysis.' });
  }
};

// ──────────────────────────────────────────────────────────────
// @route   GET /api/history/:id/resume
// @desc    Securely download/stream the resume PDF for an analysis owned by user
// @access  Private (Authenticated & Ownership Verified)
// ──────────────────────────────────────────────────────────────
const downloadResume = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ success: false, message: 'Analysis not found.' });
    }

    // Ownership check: strictly isolate to logged-in user
    const analysis = await Analysis.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!analysis) {
      return res.status(404).json({ success: false, message: 'Analysis not found.' });
    }

    if (!analysis.resumeFilename) {
      return res.status(404).json({ success: false, message: 'Resume file not found for this analysis.' });
    }

    // Secure path containment check against directory traversal
    const uploadDir = path.resolve(process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads'));
    const safeFilename = path.basename(analysis.resumeFilename);
    const resolvedPath = path.resolve(uploadDir, safeFilename);

    if (!resolvedPath.startsWith(uploadDir + path.sep)) {
      return res.status(403).json({ success: false, message: 'Access denied: invalid file path.' });
    }

    if (!fs.existsSync(resolvedPath)) {
      return res.status(404).json({
        success: false,
        message: 'Resume file is no longer available on disk.',
      });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(analysis.resumeOriginalName || 'resume.pdf')}"`
    );

    const readStream = fs.createReadStream(resolvedPath);
    readStream.on('error', (err) => {
      console.error('[Resume Stream Error]', err.message);
      if (!res.headersSent) {
        res.status(500).json({ success: false, message: 'Failed to stream resume file.' });
      }
    });
    readStream.pipe(res);
  } catch (error) {
    console.error('Resume download error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve resume file.' });
  }
};

// ──────────────────────────────────────────────────────────────
// @route   DELETE /api/history/:id
// @desc    Delete a specific analysis
// @access  Private
// ──────────────────────────────────────────────────────────────
const deleteAnalysis = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ success: false, message: 'Analysis not found.' });
    }

    const analysis = await Analysis.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!analysis) {
      return res.status(404).json({ success: false, message: 'Analysis not found.' });
    }

    res.json({ success: true, message: 'Analysis deleted successfully.' });
  } catch (error) {
    console.error('Delete analysis error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete analysis.' });
  }
};

module.exports = { getHistory, getAnalysisById, downloadResume, deleteAnalysis };
