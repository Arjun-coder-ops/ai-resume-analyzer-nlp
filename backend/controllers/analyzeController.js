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
    formData.append('analysis_id', analysis._id.toString());
    
    // Webhook URL where Python will POST the results back
    const webhookUrl = `${process.env.APP_URL || 'http://localhost:5000'}/api/analyze/webhook/${analysis._id}`;
    formData.append('webhook_url', webhookUrl);

    // Fire the request to the Python async endpoint, but DON'T await it
    axios.post(
      `${process.env.NLP_SERVICE_URL || 'http://localhost:5001'}/analyze/async`,
      formData,
      { headers: { ...formData.getHeaders() } }
    ).catch(async (nlpError) => {
      console.error('Failed to trigger NLP service:', nlpError.message);
      // If the initial connection fails completely
      analysis.status = 'failed';
      analysis.errorMessage = 'AI Analysis service is currently offline.';
      await analysis.save();
    });

    // ── Respond to frontend IMMEDIATELY ───────────────────────────────
    res.json({
      success: true,
      message: 'Analysis started. Please wait for the AI to process your resume.',
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
    res.status(500).json({ success: false, message: 'Failed to initiate analysis.' });
  } finally {
    // Clean up the uploaded file after processing
    if (req.file && fs.existsSync(req.file.path)) {
      setTimeout(() => {
        fs.unlink(req.file.path, (err) => {
          if (err) console.error('File cleanup error:', err);
        });
      }, 5000); // Wait 5s before deleting so Python has time to read it in transmission
    }
  }
};

// ──────────────────────────────────────────────────────────────
// @route   POST /api/analyze/webhook/:id
// @desc    Receive completed analysis from Python NLP service
// @access  Public (Internal Webhook)
// ──────────────────────────────────────────────────────────────
const handleWebhook = async (req, res) => {
  const { id } = req.params;
  const { 
    status, score, matched_skills, missing_skills, suggestions, 
    experience, education, projects, error 
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
      analysis.matchedSkills = matched_skills || [];
      analysis.missingSkills = missing_skills || [];
      analysis.suggestions = suggestions || [];
      analysis.experience = experience || '';
      analysis.education = education || '';
      analysis.projects = projects || [];
      analysis.status = 'completed';
    }

    await analysis.save();
    return res.json({ success: true, message: 'Webhook received and saved' });
  } catch (err) {
    console.error('Webhook error:', err.message);
    return res.status(500).json({ success: false, message: 'Server Error' });
  }
};

module.exports = { analyzeResume, handleWebhook };
