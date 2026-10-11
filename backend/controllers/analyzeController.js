// controllers/analyzeController.js - Resume analysis orchestration

const fs = require('fs');
const Analysis = require('../models/Analysis');
const { enqueueAnalysis } = require('../queue/analyzeQueue');

// ──────────────────────────────────────────────────────────────
// @route   POST /api/analyze
// @desc    Upload resume + job description → enqueue analysis → return job status
// @access  Private
// ──────────────────────────────────────────────────────────────
const analyzeResume = async (req, res) => {
  // Multer puts the uploaded file on req.file
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'Resume PDF is required.' });
  }

  const { jobDescription, jobTitle } = req.body;

  if (!jobDescription || jobDescription.trim().length < 50) {
    // Clean up uploaded file if validation fails
    fs.unlink(req.file.path, () => {});
    return res.status(400).json({
      success: false,
      message: 'Job description must be at least 50 characters.',
    });
  }

  // ── Rate Limiter: 5 trials per user per day ──────────────
  const DAILY_LIMIT = 5;
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const analysesToday = await Analysis.countDocuments({
    user: req.user._id,
    createdAt: { $gte: startOfDay },
  });

  if (analysesToday >= DAILY_LIMIT) {
    fs.unlink(req.file.path, () => {});
    return res.status(429).json({
      success: false,
      message: `Daily limit reached. You have used all ${DAILY_LIMIT} free analyses for today. Your quota resets tomorrow at midnight.`,
      dailyLimit: DAILY_LIMIT,
      trialsUsed: analysesToday,
      trialsRemaining: 0,
    });
  }

  // ── Create analysis record with "processing" status ─────
  let analysis;
  try {
    analysis = await Analysis.create({
      user: req.user._id,
      resumeFilename: req.file.filename,
      resumeOriginalName: req.file.originalname,
      jobTitle: jobTitle ? jobTitle.trim() : 'Untitled Position',
      jobDescription: jobDescription.trim(),
      status: 'processing',
    });
  } catch (dbError) {
    console.error('DB create error:', dbError);
    fs.unlink(req.file.path, () => {});
    return res.status(500).json({ success: false, message: 'Failed to initialize analysis.' });
  }

  // ── Enqueue the job for background/async processing ──
  try {
    const webhookUrl = `${process.env.APP_URL || 'http://localhost:5000'}/api/analyze/webhook/${analysis._id}`;

    await enqueueAnalysis({
      analysisId: analysis._id.toString(),
      resumePath: req.file.path,
      resumeOriginalName: req.file.originalname,
      jobDescription: jobDescription.trim(),
      webhookUrl: webhookUrl,
    });

    // ── Respond to frontend IMMEDIATELY ───────────────────────────────
    res.json({
      success: true,
      message: 'Analysis initiated. AI is processing all sections of your resume.',
      data: {
        analysisId: analysis._id,
        status: 'processing',
        jobTitle: analysis.jobTitle,
        resumeName: analysis.resumeOriginalName,
        createdAt: analysis.createdAt,
      },
    });
  } catch (error) {
    console.error('Analysis initiation error:', error);
    fs.unlink(req.file.path, () => {});
    analysis.status = 'failed';
    analysis.errorMessage = 'Failed to initiate analysis job.';
    await analysis.save();
    res.status(500).json({ success: false, message: 'Failed to initiate analysis.' });
  }
};

// ──────────────────────────────────────────────────────────────
// @route   POST /api/analyze/webhook/:id
// @desc    Receive completed analysis from Python NLP service
// @access  Public (Internal Webhook)
// ──────────────────────────────────────────────────────────────
const handleWebhook = async (req, res) => {
  // ── Webhook Authentication ──────────────────────────────────
  const expectedToken = process.env.INTERNAL_NLP_TOKEN || '';
  const providedToken = req.headers['x-internal-token'] || '';

  if (expectedToken && providedToken !== expectedToken) {
    return res.status(401).json({ success: false, message: 'Unauthorized webhook' });
  }

  const { id } = req.params;
  const {
    status, score, match_level, scoring_breakdown, recommendations,
    matched_skills, missing_skills, extracted_skills, suggestions,
    candidate_info, summary, experience, education, projects,
    certifications, languages, achievements, error
  } = req.body;

  try {
    const analysis = await Analysis.findById(id);
    if (!analysis) {
      return res.status(404).json({ success: false, message: 'Analysis not found' });
    }

    if (status === 'failed' || error) {
      analysis.status = 'failed';
      analysis.errorMessage = error || 'AI processing failed.';
    } else {
      analysis.score = Math.round(score || 0);
      analysis.matchLevel = match_level || 'Good Match';
      analysis.scoringBreakdown = scoring_breakdown || {};
      analysis.recommendations = recommendations || {};
      analysis.matchedSkills = matched_skills || [];
      analysis.missingSkills = missing_skills || [];
      analysis.extractedSkills = extracted_skills || [];
      analysis.suggestions = suggestions || [];
      analysis.candidateInfo = candidate_info || {};
      analysis.summary = summary || '';
      analysis.experience = experience || [];
      analysis.education = education || [];
      analysis.projects = projects || [];
      analysis.certifications = certifications || [];
      analysis.languages = languages || [];
      analysis.achievements = achievements || [];
      analysis.status = 'completed';
      analysis.errorMessage = null;
    }

    await analysis.save();
    return res.json({ success: true, message: 'Webhook received and saved' });
  } catch (err) {
    console.error('Webhook error:', err.message);
    return res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// ──────────────────────────────────────────────────────────────
// @route   GET /api/analyze/quota
// @desc    Get user's daily analysis quota usage (5 trials/day)
// @access  Private
// ──────────────────────────────────────────────────────────────
const getQuota = async (req, res) => {
  try {
    const DAILY_LIMIT = 5;
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const analysesToday = await Analysis.countDocuments({
      user: req.user._id,
      createdAt: { $gte: startOfDay },
    });

    const remaining = Math.max(0, DAILY_LIMIT - analysesToday);

    const tomorrow = new Date();
    tomorrow.setHours(24, 0, 0, 0);

    res.json({
      success: true,
      data: {
        dailyLimit: DAILY_LIMIT,
        trialsUsed: analysesToday,
        trialsRemaining: remaining,
        resetsAt: tomorrow,
      },
    });
  } catch (error) {
    console.error('Quota fetch error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch quota.' });
  }
};

module.exports = { analyzeResume, handleWebhook, getQuota };
