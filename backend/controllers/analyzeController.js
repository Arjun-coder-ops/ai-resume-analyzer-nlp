const fs = require('fs');
const crypto = require('crypto');
const mongoose = require('mongoose');
const Analysis = require('../models/Analysis');
const UserDailyQuota = require('../models/UserDailyQuota');
const { DAILY_LIMIT } = UserDailyQuota;
const analyzeQueue = require('../queue/analyzeQueue');
const { safeUnlink } = analyzeQueue;

/**
 * Timing-safe string comparison to prevent side-channel timing attacks.
 * Both inputs are hashed with SHA-256 to ensure equal-length buffers for crypto.timingSafeEqual.
 */
const safeCompareTokens = (provided, expected) => {
  if (typeof provided !== 'string' || typeof expected !== 'string') {
    return false;
  }
  const cleanProvided = provided.trim();
  const cleanExpected = expected.trim();
  if (!cleanProvided || !cleanExpected) {
    return false;
  }
  const providedHash = crypto.createHash('sha256').update(cleanProvided).digest();
  const expectedHash = crypto.createHash('sha256').update(cleanExpected).digest();
  return crypto.timingSafeEqual(providedHash, expectedHash);
};

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
  const rawKey = req.headers['idempotency-key'] || req.body.idempotencyKey;
  const idempotencyKey =
    typeof rawKey === 'string' && rawKey.trim().length > 0 ? rawKey.trim() : null;

  if (!jobDescription || jobDescription.trim().length < 50) {
    // Clean up uploaded file if validation fails
    safeUnlink(req.file.path);
    return res.status(400).json({
      success: false,
      message: 'Job description must be at least 50 characters.',
    });
  }

  // ── Idempotency Check (Fast-Path) ────────────────────────
  if (idempotencyKey) {
    const existingByIdempotency = await Analysis.findOne({
      user: req.user._id,
      idempotencyKey,
    });
    if (existingByIdempotency) {
      // If the prior attempt suffered a partial submission failure before enqueue,
      // clean up that failed shell to allow clean retry!
      if (
        existingByIdempotency.status === 'failed' &&
        existingByIdempotency.errorMessage === 'Failed to initiate analysis job.'
      ) {
        await Analysis.deleteOne({ _id: existingByIdempotency._id });
      } else {
        // Verify request payload matches the original submission (job description)
        const isSamePayload =
          existingByIdempotency.jobDescription === jobDescription.trim();

        if (!isSamePayload) {
          safeUnlink(req.file.path);
          return res.status(409).json({
            success: false,
            message: 'Idempotency key was previously used with a different request payload.',
          });
        }

        safeUnlink(req.file.path);
        return res.json({
          success: true,
          message: 'Analysis already initiated (idempotent request).',
          data: {
            analysisId: existingByIdempotency._id,
            status: existingByIdempotency.status,
            jobTitle: existingByIdempotency.jobTitle,
            resumeName: existingByIdempotency.resumeOriginalName,
            createdAt: existingByIdempotency.createdAt,
          },
        });
      }
    }
  }

  // Check for duplicate in-flight submission within the last 60 seconds
  const recentDuplicate = await Analysis.findOne({
    user: req.user._id,
    resumeOriginalName: req.file.originalname,
    jobDescription: jobDescription.trim(),
    status: { $in: ['processing', 'queued', 'pending'] },
    createdAt: { $gte: new Date(Date.now() - 60000) },
  });

  if (recentDuplicate) {
    safeUnlink(req.file.path);
    return res.json({
      success: true,
      message: 'Analysis is already in progress for this resume and job description.',
      data: {
        analysisId: recentDuplicate._id,
        status: recentDuplicate.status,
        jobTitle: recentDuplicate.jobTitle,
        resumeName: recentDuplicate.resumeOriginalName,
        createdAt: recentDuplicate.createdAt,
      },
    });
  }

  // ── Atomic Quota Reservation (5 trials per user per day) ─
  const quotaReservation = await UserDailyQuota.reserveDailyQuota(req.user._id);
  if (!quotaReservation) {
    safeUnlink(req.file.path);
    const quotaUsage = await UserDailyQuota.getDailyQuotaUsage(req.user._id);
    return res.status(429).json({
      success: false,
      errorType: 'DAILY_QUOTA_EXHAUSTED',
      message: `Daily limit reached. You have used all ${DAILY_LIMIT} free analyses for today. Your quota resets tomorrow at midnight.`,
      dailyLimit: DAILY_LIMIT,
      trialsUsed: quotaUsage.trialsUsed,
      trialsRemaining: 0,
    });
  }

  const { reservationId } = quotaReservation;

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
      idempotencyKey,
    });
  } catch (dbError) {
    // Check for concurrent duplicate idempotency-key race (MongoDB E11000)
    if (dbError.code === 11000 && idempotencyKey) {
      await UserDailyQuota.rollbackDailyQuota(req.user._id, reservationId);
      safeUnlink(req.file.path);

      const existingAnalysis = await Analysis.findOne({
        user: req.user._id,
        idempotencyKey,
      });

      if (existingAnalysis) {
        const isSamePayload =
          existingAnalysis.jobDescription === jobDescription.trim();

        if (!isSamePayload) {
          return res.status(409).json({
            success: false,
            message: 'Idempotency key was previously used with a different request payload.',
          });
        }

        return res.json({
          success: true,
          message: 'Analysis already initiated (idempotent request).',
          data: {
            analysisId: existingAnalysis._id,
            status: existingAnalysis.status,
            jobTitle: existingAnalysis.jobTitle,
            resumeName: existingAnalysis.resumeOriginalName,
            createdAt: existingAnalysis.createdAt,
          },
        });
      }
    }

    console.error('DB create error:', dbError);
    await UserDailyQuota.rollbackDailyQuota(req.user._id, reservationId);
    safeUnlink(req.file.path);
    return res.status(500).json({ success: false, message: 'Failed to initialize analysis.' });
  }

  // ── Enqueue the job for background/async processing ──
  try {
    const webhookUrl = `${process.env.APP_URL || 'http://localhost:5000'}/api/analyze/webhook/${analysis._id}`;

    await analyzeQueue.enqueueAnalysis({
      analysisId: analysis._id.toString(),
      resumePath: req.file.path,
      resumeOriginalName: req.file.originalname,
      jobDescription: jobDescription.trim(),
      webhookUrl: webhookUrl,
    });
  } catch (enqueueError) {
    console.error('Analysis initiation error (queue enqueue):', enqueueError);
    safeUnlink(req.file.path);
    // Rollback quota reservation only when enqueue fails before acceptance
    await UserDailyQuota.rollbackDailyQuota(req.user._id, reservationId);

    await Analysis.findOneAndUpdate(
      { _id: analysis._id, status: { $in: ['processing', 'queued', 'pending'] } },
      {
        $set: {
          status: 'failed',
          errorMessage: 'Failed to initiate analysis job.',
        },
      }
    );
    return res.status(500).json({ success: false, message: 'Failed to initiate analysis.' });
  }

  // Once enqueued, the submission is accepted by the worker/queue.
  // Quota was already reserved and counted towards the daily limit.
  // Seal the reservation so it can never be refunded.
  // If commit encounters a transient error, retry safely without rolling back accepted quota.
  try {
    await UserDailyQuota.commitDailyQuota(req.user._id, reservationId);
  } catch (commitError) {
    console.error(`[Analyze Controller] Warning: commitDailyQuota failed for reservation ${reservationId}:`, commitError.message);
    try {
      await UserDailyQuota.commitDailyQuota(req.user._id, reservationId);
    } catch (retryError) {
      console.error(`[Analyze Controller] Retry commitDailyQuota failed for reservation ${reservationId}:`, retryError.message);
    }
  }

  // ── Respond to frontend IMMEDIATELY ───────────────────────────────
  return res.json({
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
};

// ──────────────────────────────────────────────────────────────
// @route   POST /api/analyze/webhook/:id
// @desc    Receive completed analysis from Python NLP service
// @access  Internal Webhook
// ──────────────────────────────────────────────────────────────
const handleWebhook = async (req, res) => {
  // ── Webhook Authentication (Fail-Closed) ─────────────────────
  const expectedToken = process.env.INTERNAL_NLP_TOKEN;

  // Fail-closed: Reject if the secret is not configured or empty on the server
  if (!expectedToken || typeof expectedToken !== 'string' || !expectedToken.trim()) {
    console.error('[Webhook Security Error] INTERNAL_NLP_TOKEN is not configured on the server. Rejecting webhook request.');
    return res.status(500).json({
      success: false,
      message: 'Internal webhook authentication is unconfigured on the server.',
    });
  }

  const providedToken = req.headers['x-internal-token'];

  // Reject missing, empty, or mismatched tokens using timing-safe comparison
  if (!providedToken || !safeCompareTokens(providedToken, expectedToken)) {
    return res.status(401).json({ success: false, message: 'Unauthorized webhook' });
  }

  const { id } = req.params;
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ success: false, message: 'Invalid analysis ID' });
  }

  const {
    status, score, match_level, scoring_breakdown, recommendations,
    matched_skills, missing_skills, extracted_skills, suggestions,
    evaluation_notes,
    candidate_info, summary, experience, education, projects,
    certifications, languages, achievements, error
  } = req.body || {};

  try {
    const isFailure = status === 'failed' || Boolean(error);

    if (isFailure) {
      // Atomic conditional update: only update if still non-terminal
      const updated = await Analysis.findOneAndUpdate(
        { _id: id, status: { $in: ['processing', 'queued', 'pending'] } },
        {
          $set: {
            status: 'failed',
            errorMessage: error || 'AI processing failed.',
          },
        },
        { new: true }
      );

      if (!updated) {
        // Document was not in a non-terminal state. Safely inspect current state.
        const current = await Analysis.findById(id);
        if (!current) {
          return res.status(404).json({ success: false, message: 'Analysis not found' });
        }
        if (current.status === 'completed') {
          console.warn(`[Webhook] Ignored stale failure webhook for already completed analysis ${id}`);
          return res.json({ success: true, message: 'Ignored stale failure webhook for completed analysis' });
        }
        return res.json({ success: true, message: `Analysis is already in ${current.status} state` });
      }

      if (updated.user) {
        await UserDailyQuota.refundFailedAnalysisQuota(updated.user, updated._id, updated.createdAt);
      }

      return res.json({ success: true, message: 'Failure webhook processed' });
    } else {
      // Successful completion webhook: atomically set completed state and scores
      const updated = await Analysis.findOneAndUpdate(
        { _id: id, status: { $in: ['processing', 'queued', 'pending'] } },
        {
          $set: {
            score: Math.round(score || 0),
            matchLevel: match_level || 'Good Match',
            scoringBreakdown: scoring_breakdown || {},
            recommendations: recommendations || {},
            evaluationNotes: evaluation_notes || [],
            matchedSkills: matched_skills || [],
            missingSkills: missing_skills || [],
            extractedSkills: extracted_skills || [],
            suggestions: suggestions || [],
            candidateInfo: candidate_info || {},
            summary: summary || '',
            experience: experience || [],
            education: education || [],
            projects: projects || [],
            certifications: certifications || [],
            languages: languages || [],
            achievements: achievements || [],
            status: 'completed',
            errorMessage: null,
          },
        },
        { new: true }
      );

      if (!updated) {
        const current = await Analysis.findById(id);
        if (!current) {
          return res.status(404).json({ success: false, message: 'Analysis not found' });
        }
        if (current.status === 'completed') {
          console.log(`[Webhook] Duplicate completion webhook ignored for already completed analysis ${id}`);
          return res.json({ success: true, message: 'Analysis is already completed' });
        }
        return res.json({ success: true, message: `Analysis is already in ${current.status} state` });
      }

      return res.json({ success: true, message: 'Webhook received and saved' });
    }
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
    const quotaData = await UserDailyQuota.getDailyQuotaUsage(req.user._id);
    res.json({
      success: true,
      data: quotaData,
    });
  } catch (error) {
    console.error('Quota fetch error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch quota.' });
  }
};

module.exports = { analyzeResume, handleWebhook, getQuota };
