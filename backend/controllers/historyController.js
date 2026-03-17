// controllers/historyController.js - Fetch user's past analyses

const Analysis = require('../models/Analysis');

// ──────────────────────────────────────────────────────────────
// @route   GET /api/history
// @desc    Get all completed analyses for the logged-in user
// @access  Private
// ──────────────────────────────────────────────────────────────
const getHistory = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const [analyses, total] = await Promise.all([
      Analysis.find({ user: req.user._id, status: 'completed' })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('-jobDescription'), // Exclude heavy field from list
      Analysis.countDocuments({ user: req.user._id, status: 'completed' }),
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
// @route   DELETE /api/history/:id
// @desc    Delete a specific analysis
// @access  Private
// ──────────────────────────────────────────────────────────────
const deleteAnalysis = async (req, res) => {
  try {
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

module.exports = { getHistory, getAnalysisById, deleteAnalysis };
