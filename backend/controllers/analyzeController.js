// controllers/analyzeController.js - Resume analysis orchestration

const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const Analysis = require('../models/Analysis');

// ──────────────────────────────────────────────────────────────
// @route   POST /api/analyze
// @desc    Upload resume + job description → call NLP → save results
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

  // ── Create analysis record with "processing" status ─────
  let analysis;
  try {
    analysis = await Analysis.create({
      user: req.user._id,
      resumeFilename: req.file.filename,
      resumeOriginalName: req.file.originalname,
      jobTitle: jobTitle || 'Untitled Position',
      jobDescription: jobDescription.trim(),
      status: 'processing',
    });
  } catch (dbError) {
    console.error('DB create error:', dbError);
    fs.unlink(req.file.path, () => {});
    return res.status(500).json({ success: false, message: 'Failed to initialize analysis.' });
  }

  // ── Forward PDF + job description to Python NLP service ──
  try {
    const formData = new FormData();
    formData.append('resume', fs.createReadStream(req.file.path), {
      filename: req.file.originalname,
      contentType: 'application/pdf',
    });
    formData.append('job_description', jobDescription.trim());

    const nlpResponse = await axios.post(
      `${process.env.NLP_SERVICE_URL || 'http://localhost:5001'}/analyze`,
      formData,
      {
        headers: { ...formData.getHeaders() },
        timeout: 30000, // 30s timeout
      }
    );

    const { score, matched_skills, missing_skills, suggestions } = nlpResponse.data;

    // ── Update analysis record with NLP results ──────────
    analysis.score = Math.round(score);
    analysis.matchedSkills = matched_skills || [];
    analysis.missingSkills = missing_skills || [];
    analysis.suggestions = suggestions || [];
    analysis.status = 'completed';
    await analysis.save();

    // ── Respond to frontend ───────────────────────────────
    res.json({
      success: true,
      message: 'Analysis completed successfully.',
      data: {
        analysisId: analysis._id,
        score: analysis.score,
        matchedSkills: analysis.matchedSkills,
        missingSkills: analysis.missingSkills,
        suggestions: analysis.suggestions,
        jobTitle: analysis.jobTitle,
        resumeName: analysis.resumeOriginalName,
        createdAt: analysis.createdAt,
      },
    });
  } catch (nlpError) {
    console.error('NLP service error:', nlpError.message);

    // Mark analysis as failed
    analysis.status = 'failed';
    analysis.errorMessage = nlpError.message;
    await analysis.save();

    // Determine user-friendly error message
    let message = 'NLP service is unavailable. Please try again later.';
    if (nlpError.code === 'ECONNREFUSED') {
      message = 'NLP analysis service is offline. Please contact support.';
    } else if (nlpError.response?.data?.error) {
      message = nlpError.response.data.error;
    }

    res.status(503).json({ success: false, message });
  } finally {
    // Clean up the uploaded file after processing
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlink(req.file.path, (err) => {
        if (err) console.error('File cleanup error:', err);
      });
    }
  }
};

module.exports = { analyzeResume };
