// routes/historyRoutes.js - Analysis history routes

const express = require('express');
const router = express.Router();
const { getHistory, getAnalysisById, downloadResume, deleteAnalysis } = require('../controllers/historyController');
const { protect } = require('../middleware/authMiddleware');

// All routes are protected
router.use(protect);

router.get('/',           getHistory);
router.get('/:id',        getAnalysisById);
router.get('/:id/resume', downloadResume);
router.delete('/:id',     deleteAnalysis);

module.exports = router;
