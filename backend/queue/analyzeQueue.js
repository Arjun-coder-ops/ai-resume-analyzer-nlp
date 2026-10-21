// queue/analyzeQueue.js - Resilient Analysis Job Queue with in-memory and Redis support

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const FormData = require('form-data');
const Analysis = require('../models/Analysis');
const UserDailyQuota = require('../models/UserDailyQuota');

// Controlled settings
const QUEUE_CONCURRENCY = parseInt(process.env.QUEUE_CONCURRENCY || '1', 10);
const MAX_RETRIES = parseInt(process.env.MAX_RETRIES || '3', 10);
const RETRY_DELAY = parseInt(process.env.RETRY_DELAY || '10000', 10);

/**
 * Parses Retry-After header (either integer seconds or HTTP-Date)
 * @param {string|number} headerValue
 * @returns {number|null} delay in milliseconds, or null
 */
const parseRetryAfter = (headerValue) => {
  if (!headerValue) return null;
  const seconds = Number(headerValue);
  if (!isNaN(seconds) && seconds > 0) {
    return Math.round(seconds * 1000);
  }
  const dateMs = Date.parse(headerValue);
  if (!isNaN(dateMs)) {
    const diff = dateMs - Date.now();
    return diff > 0 ? diff : 0;
  }
  return null;
};

/**
 * Safely removes a file from disk without throwing or interrupting caller flow
 * @param {string} filePath
 */
const safeUnlink = (filePath) => {
  if (filePath && fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch (err) {
      if (err && err.code !== 'ENOENT') {
        console.error('[Queue Worker] File cleanup error (ignored):', err.message);
      }
    }
  }
};

/**
 * Core processing function that executes resume analysis via Python NLP service
 * and directly updates the database with comprehensive failure and retry safety.
 */
const processAnalysisJob = async (jobData, attempt = 1, maxAttempts = MAX_RETRIES) => {
  const { analysisId, resumePath, resumeOriginalName, jobDescription, webhookUrl } = jobData;
  console.log(`[Queue Worker] Processing analysis job ${analysisId} (attempt ${attempt}/${maxAttempts})`);

  let analysis = await Analysis.findById(analysisId);
  if (!analysis) {
    const err = new Error(`Analysis ${analysisId} not found in DB`);
    err.isTerminal = true;
    throw err;
  }

  // 1. Safeguard: Never reprocess or overwrite an already completed analysis
  if (analysis.status === 'completed') {
    console.log(`[Queue Worker] Analysis ${analysisId} is already completed. Skipping reprocessing.`);
    safeUnlink(resumePath);
    return { success: true, alreadyCompleted: true };
  }

  // 2. Safeguard: Never regress or reprocess an already failed terminal analysis
  // Note: If the failure was a timeout/restart error set by the stale reconciler,
  // a legitimate retry attempt is permitted to claim ownership.
  const isTimeoutFailure =
    analysis.status === 'failed' &&
    analysis.errorMessage === 'Analysis timed out or was interrupted by a server restart. Please submit your resume again.';

  if (analysis.status === 'failed' && !isTimeoutFailure) {
    console.log(`[Queue Worker] Analysis ${analysisId} is already marked as failed. Skipping reprocessing.`);
    safeUnlink(resumePath);
    return { success: false, alreadyFailed: true };
  }

  // 3. Safeguard: Verify resume document exists on disk
  if (!resumePath || !fs.existsSync(resumePath)) {
    const err = new Error(`Resume file not found at ${resumePath}`);
    err.isTerminal = true;
    const failDoc = await Analysis.findOneAndUpdate(
      { _id: analysisId, status: { $in: ['processing', 'queued', 'pending'] } },
      {
        $set: {
          status: 'failed',
          errorMessage: 'Resume document could not be accessed. Please upload your document again.',
        },
      },
      { new: true }
    );
    if (failDoc?.user) {
      await UserDailyQuota.refundFailedAnalysisQuota(failDoc.user, failDoc.createdAt);
    }
    throw err;
  }

  // Unique per-attempt token to enforce attempt ownership across all MongoDB state mutations
  const attemptToken = jobData.attemptToken || (crypto.randomUUID ? crypto.randomUUID() : `att_${Date.now()}_${Math.random().toString(36).substring(2)}`);

  // Atomic state transition: claim attempt ownership
  // Scoped to non-terminal states or timeout failure so new worker attempt acquires exclusive ownership
  const claimResult = await Analysis.findOneAndUpdate(
    {
      _id: analysisId,
      $or: [
        { status: { $in: ['queued', 'pending', 'processing'] } },
        {
          status: 'failed',
          errorMessage: 'Analysis timed out or was interrupted by a server restart. Please submit your resume again.',
        },
      ],
    },
    {
      $set: {
        status: 'processing',
        heartbeatAt: new Date(),
        attemptToken: attemptToken,
      },
    },
    { new: true }
  );

  if (!claimResult) {
    console.log(`[Queue Worker] Analysis ${analysisId} is already terminal or claimed. Skipping processing.`);
    safeUnlink(resumePath);
    return { success: false, alreadyTerminal: true };
  }

  const HEARTBEAT_INTERVAL_MS = parseInt(process.env.HEARTBEAT_INTERVAL_MS || '25000', 10);
  let heartbeatTimer = setInterval(async () => {
    try {
      const hbRes = await Analysis.updateOne(
        { _id: analysisId, status: 'processing', attemptToken: attemptToken },
        { $set: { heartbeatAt: new Date() } }
      );
      if (hbRes && hbRes.matchedCount === 0) {
        clearInterval(heartbeatTimer);
      }
    } catch (hbErr) {
      console.warn(`[Queue Worker] Failed to update heartbeat for ${analysisId}:`, hbErr.message);
    }
  }, HEARTBEAT_INTERVAL_MS);

  if (heartbeatTimer && heartbeatTimer.unref) {
    heartbeatTimer.unref();
  }

  try {
    const formData = new FormData();
    formData.append('resume', fs.createReadStream(resumePath), {
      filename: resumeOriginalName,
      contentType: 'application/pdf',
    });
    formData.append('job_description', jobDescription);
    formData.append('analysis_id', analysisId);
    if (webhookUrl) {
      formData.append('webhook_url', webhookUrl);
    }

    const nlpUrl = `${process.env.NLP_SERVICE_URL || 'http://localhost:5001'}/analyze`;

    // Trigger Python service directly with timeout
    const response = await axios.post(nlpUrl, formData, {
      headers: {
        ...formData.getHeaders(),
        'X-Internal-Token': process.env.INTERNAL_NLP_TOKEN || '',
      },
      timeout: 120000, // 2 minutes
    });

    const result = response.data;
    if (result && result.status !== 'failed') {
      // Atomic conditional update: only persist scores if STILL owned by this attemptToken
      // and either currently non-terminal or recovering from reconciler timeout
      const updated = await Analysis.findOneAndUpdate(
        {
          _id: analysisId,
          attemptToken: attemptToken,
          $or: [
            { status: { $in: ['processing', 'queued', 'pending'] } },
            {
              status: 'failed',
              errorMessage:
                'Analysis timed out or was interrupted by a server restart. Please submit your resume again.',
            },
          ],
        },
        {
          $set: {
            score: Math.round(result.score || 0),
            matchLevel: result.match_level || 'Good Match',
            scoringBreakdown: result.scoring_breakdown || {},
            matchedSkills: result.matched_skills || [],
            missingSkills: result.missing_skills || [],
            extractedSkills: result.extracted_skills || [],
            suggestions: result.suggestions || [],
            recommendations: result.recommendations || {},
            evaluationNotes: result.evaluation_notes || [],
            candidateInfo: result.candidate_info || {},
            summary: result.summary || '',
            experience: result.experience || [],
            education: result.education || [],
            projects: result.projects || [],
            certifications: result.certifications || [],
            languages: result.languages || [],
            achievements: result.achievements || [],
            mandatoryWarnings: result.mandatory_warnings || [],
            status: 'completed',
            errorMessage: null,
            processedAt: new Date(),
          },
        },
        { new: true }
      );

      if (!updated) {
        // Record was transitioned concurrently by another worker, webhook, or superseded by a newer attempt
        const current = await Analysis.findById(analysisId);
        if (current?.status === 'completed') {
          console.log(`[Queue Worker] Analysis ${analysisId} was already completed concurrently.`);
          safeUnlink(resumePath);
          return { success: true, alreadyCompleted: true };
        }
        if (current?.attemptToken && current.attemptToken !== attemptToken) {
          console.warn(`[Queue Worker] Attempt ${attempt} for ${analysisId} was superseded by attempt ${current.attemptToken}. Discarding stale completion.`);
          // Do NOT delete file as newer attempt is still actively using it!
          return { success: false, superseded: true };
        }
        if (current?.status === 'failed') {
          console.warn(`[Queue Worker] Analysis ${analysisId} was already marked failed concurrently. Discarding completion.`);
          safeUnlink(resumePath);
          return { success: false, alreadyFailed: true };
        }
      }

      console.log(`[Queue Worker] Job ${analysisId} completed successfully`);

      // Clean up temporary resume file on successful persistence
      safeUnlink(resumePath);

      return { success: true };
    } else {
      throw new Error(result?.error || 'AI analysis failed');
    }
  } catch (error) {
    console.error(`[Queue Worker] Error processing job ${analysisId} (attempt ${attempt}/${maxAttempts}):`, error.message);

    const statusCode = error.response?.status;
    // Retryable HTTP statuses: 429 (Rate Limit), 408 (Request Timeout), and 5xx server errors
    const isRetryableStatus =
      statusCode === 429 || statusCode === 408 || (statusCode >= 500 && statusCode < 600);

    // Truly non-retryable client errors: 400 (Bad Request), 401, 403, 404, 413, 415, 422, etc. (excluding 429 and 408)
    const isNonRetryableClientError =
      Boolean(statusCode && statusCode >= 400 && statusCode < 500 && !isRetryableStatus);

    const isFinalAttempt = attempt >= maxAttempts;

    // Parse Retry-After header if present on rate-limited or timeout responses
    const retryAfterHeader = error.response?.headers?.['retry-after'];
    const retryAfterMs = parseRetryAfter(retryAfterHeader);
    if (retryAfterMs !== null) {
      error.retryAfterMs = retryAfterMs;
    }

    // Terminal failure: non-retryable client error OR all retries exhausted
    if (isNonRetryableClientError || isFinalAttempt) {
      try {
        const errorMsg =
          error.response?.data?.error ||
          error.response?.data?.message ||
          error.message ||
          'AI processing failed.';

        // Atomic conditional update: only update if STILL owned by this attemptToken and non-terminal
        const failUpdated = await Analysis.findOneAndUpdate(
          {
            _id: analysisId,
            attemptToken: attemptToken,
            status: { $in: ['processing', 'queued', 'pending'] },
          },
          {
            $set: {
              status: 'failed',
              errorMessage: errorMsg,
            },
          }
        );

        if (failUpdated) {
          safeUnlink(resumePath);
          if (failUpdated.user) {
            await UserDailyQuota.refundFailedAnalysisQuota(failUpdated.user, failUpdated.createdAt);
          }
        } else {
          console.warn(`[Queue Worker] Failure for attempt ${attempt} ignored because job was claimed or completed by another attempt.`);
        }
      } catch (dbErr) {
        console.error('[Queue Worker] Error saving failure state:', dbErr.message);
      }

      // Clean up temporary file only after terminal failure
      safeUnlink(resumePath);

      if (isNonRetryableClientError) {
        error.isTerminal = true;
        try {
          const { UnrecoverableError } = require('bullmq');
          const unrecoverable = new UnrecoverableError(error.message);
          unrecoverable.isTerminal = true;
          throw unrecoverable;
        } catch (e) {
          if (e.name === 'UnrecoverableError') throw e;
          throw error;
        }
      }
    }

    // For retryable errors on intermediate attempts (attempt < maxAttempts):
    // Resume file survives, DB status remains processing, and error is re-thrown for queue backoff
    throw error;
  } finally {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
    }
  }
};

let analyzeQueue = null;
let worker = null;
let redisConnection = null;

// Only instantiate BullMQ when not in test environment and REDIS_URL is configured
const hasRedis = Boolean(process.env.REDIS_URL && process.env.REDIS_URL.trim());
const isTest = process.env.NODE_ENV === 'test';

if (!isTest && hasRedis) {
  try {
    const { Queue, Worker } = require('bullmq');
    const IORedis = require('ioredis');

    const redisOptions = { maxRetriesPerRequest: null };
    redisConnection = new IORedis(process.env.REDIS_URL, redisOptions);
    const connection = redisConnection;

    connection.on('error', (err) => {
      console.error('[Redis Error]', err.message);
    });

    analyzeQueue = new Queue('analyzeResume', { connection });

    worker = new Worker(
      'analyzeResume',
      async (job) => {
        const currentAttempt = (job.attemptsMade || 0) + 1;
        const totalAttempts = job.opts?.attempts || MAX_RETRIES;
        return await processAnalysisJob(job.data, currentAttempt, totalAttempts);
      },
      {
        connection,
        concurrency: QUEUE_CONCURRENCY,
      }
    );

    worker.on('failed', async (job, err) => {
      console.error(`[BullMQ Worker] Job ${job?.id} failed:`, err.message);
      const attemptsMade = (job?.attemptsMade || 0);
      const maxAttempts = job?.opts?.attempts || MAX_RETRIES;

      if (attemptsMade >= maxAttempts || err.isTerminal || err.name === 'UnrecoverableError') {
        try {
          // Atomic update: only mark failed if still non-terminal, never overwrite completed
          await Analysis.findOneAndUpdate(
            { _id: job.data?.analysisId, status: { $in: ['processing', 'queued', 'pending'] } },
            {
              $set: {
                status: 'failed',
                errorMessage: err.message || 'AI processing failed after retrying.',
              },
            }
          );
        } catch (dbErr) {
          console.error('[BullMQ Worker] Failed to update terminal failure in DB:', dbErr.message);
        }

        // Clean up file if still present
        safeUnlink(job.data?.resumePath);
      }
    });

    console.log('✅ BullMQ Redis queue worker initialized');
  } catch (e) {
    console.warn('⚠️ BullMQ initialization failed, falling back to in-memory async processing:', e.message);
    analyzeQueue = null;
    worker = null;
  }
}

// ── In-Memory Queue with Controlled Concurrency and Retries ──────────
const inMemoryQueue = [];
const activeJobs = new Set();
let inMemoryProcessing = false;

const processInMemoryQueue = async () => {
  if (inMemoryProcessing || inMemoryQueue.length === 0) return;
  inMemoryProcessing = true;

  while (inMemoryQueue.length > 0) {
    const item = inMemoryQueue.shift();
    if (!item || !item.jobData) continue;
    const currentAnalysisId = item.jobData.analysisId ? item.jobData.analysisId.toString() : null;
    if (currentAnalysisId) {
      activeJobs.add(currentAnalysisId);
    }

    try {
      let attempt = item.attempt || 1;
      let success = false;

      while (attempt <= MAX_RETRIES && !success) {
        try {
          await processAnalysisJob(item.jobData, attempt, MAX_RETRIES);
          success = true;
        } catch (err) {
          if (err.isTerminal || err.name === 'UnrecoverableError' || attempt >= MAX_RETRIES) {
            console.error(`[In-Memory Worker] Job ${item.jobData.analysisId} permanently failed: ${err.message}`);
            safeUnlink(item.jobData?.resumePath);
            break;
          } else {
            attempt++;
            // Respect Retry-After header if provided, bounded between 500ms and 60000ms
            let delay = RETRY_DELAY;
            if (err.retryAfterMs && typeof err.retryAfterMs === 'number') {
              delay = Math.min(Math.max(err.retryAfterMs, 500), 60000);
            }
            console.warn(`[In-Memory Worker] Retrying job ${item.jobData.analysisId} (attempt ${attempt}/${MAX_RETRIES}) in ${delay}ms...`);
            await new Promise((resolve) => setTimeout(resolve, delay));
          }
        }
      }
    } finally {
      if (currentAnalysisId) {
        activeJobs.delete(currentAnalysisId);
      }
    }
  }

  inMemoryProcessing = false;
};

/**
 * Enqueue analysis job using Redis BullMQ if available,
 * or asynchronous in-memory processing if Redis is unavailable.
 */
const enqueueAnalysis = async (jobData) => {
  if (isTest) {
    return { id: jobData.analysisId };
  }

  if (analyzeQueue) {
    try {
      return await analyzeQueue.add('analyzeResume', jobData, {
        attempts: MAX_RETRIES,
        backoff: {
          type: 'fixed',
          delay: RETRY_DELAY,
        },
        jobId: jobData.analysisId,
      });
    } catch (err) {
      console.warn('⚠️ Redis enqueue failed, using in-memory async fallback:', err.message);
    }
  }

  // Enqueue in memory queue runner with analysisId deduplication against both waiting and active jobs
  const targetId = jobData.analysisId ? jobData.analysisId.toString() : null;
  const isAlreadyActive = targetId && activeJobs.has(targetId);
  const alreadyInQueue = inMemoryQueue.some(
    (item) => item.jobData && item.jobData.analysisId && item.jobData.analysisId.toString() === targetId
  );
  if (!alreadyInQueue && !isAlreadyActive) {
    inMemoryQueue.push({ jobData, attempt: 1 });
    setImmediate(processInMemoryQueue);
  }

  return { id: jobData.analysisId };
};

/**
 * Startup and periodic reconciliation: identifies genuinely orphaned/abandoned jobs left in 'processing',
 * 'queued', or 'pending' across server restarts or unrecoverable worker crashes and transitions them to failed.
 * 
 * Safety invariants:
 * 1. Checks local in-memory active jobs and queue array before considering an in-memory job stale.
 * 2. Checks BullMQ job state (waiting, delayed, active with remaining retries) before considering a BullMQ job stale.
 * 3. Inspects worker liveness via periodic database heartbeat (heartbeatAt); an actively processing analysis
 *    running > 5 minutes is NOT marked failed as long as its worker heartbeat is fresh (< staleThresholdMs).
 * 4. Uses atomic conditional transitions ensuring a racing worker completion is never regressed or overwritten.
 * 5. Safe for concurrent reconcilers across multiple application instances.
 */
const reconcileStaleJobs = async (staleThresholdMs = 5 * 60 * 1000) => {
  try {
    const cutoffTime = new Date(Date.now() - staleThresholdMs);

    // Initial candidate query: non-terminal analyses whose last active timestamp (heartbeatAt, or updatedAt if no heartbeat)
    // is older than the stale threshold
    const candidateAnalyses = await Analysis.find({
      status: { $in: ['processing', 'queued', 'pending'] },
      $or: [
        { heartbeatAt: { $lt: cutoffTime } },
        { heartbeatAt: null, updatedAt: { $lt: cutoffTime } },
        { heartbeatAt: { $exists: false }, updatedAt: { $lt: cutoffTime } },
      ],
    });

    if (candidateAnalyses.length === 0) {
      return 0;
    }

    console.log(`[Job Reconciler] Inspecting ${candidateAnalyses.length} candidate stale analyses...`);
    const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads');
    let reconciledCount = 0;

    for (const analysis of candidateAnalyses) {
      const idStr = analysis._id.toString();

      // 1. Worker Liveness Check (In-Memory Queue):
      // If the job is active in this process's activeJobs set or waiting in inMemoryQueue, it is demonstrably alive!
      const isInMemoryActive = activeJobs && activeJobs.has(idStr);
      const isInMemoryQueued = inMemoryQueue && inMemoryQueue.some(
        (item) => item.jobData && item.jobData.analysisId && item.jobData.analysisId.toString() === idStr
      );
      if (isInMemoryActive || isInMemoryQueued) {
        console.log(`[Job Reconciler] Analysis ${idStr} is actively processing or waiting in local memory. Preserving.`);
        continue;
      }

      // 2. Queue State & Worker Health Check (BullMQ Redis Queue):
      if (analyzeQueue) {
        try {
          const bullJob = await analyzeQueue.getJob(idStr);
          if (bullJob) {
            const jobState = await bullJob.getState();
            // A. If waiting or delayed in BullMQ, it is valid backlog or retry delay; do not fail!
            if (jobState === 'waiting' || jobState === 'delayed') {
              console.log(`[Job Reconciler] Analysis ${idStr} is ${jobState} in BullMQ queue backlog. Preserving.`);
              continue;
            }
            // B. If completed in BullMQ, worker result persistence is in flight
            if (jobState === 'completed') {
              continue;
            }
            // C. If active in BullMQ:
            if (jobState === 'active') {
              // An active queue state alone does NOT prove worker health!
              // Verify worker liveness via Redis lock or active DB heartbeat:
              let isLocked = false;
              if (redisConnection && typeof redisConnection.get === 'function') {
                try {
                  const lockKey = typeof analyzeQueue.toKey === 'function'
                    ? analyzeQueue.toKey(idStr) + ':lock'
                    : `bull:analyzeResume:${idStr}:lock`;
                  const lockVal = await redisConnection.get(lockKey);
                  isLocked = Boolean(lockVal);
                } catch (lockErr) {
                  console.warn(`[Job Reconciler] Lock inspection notice for ${idStr}:`, lockErr.message);
                }
              }

              const lastActive = Math.max(
                analysis.heartbeatAt ? new Date(analysis.heartbeatAt).getTime() : 0,
                analysis.updatedAt ? new Date(analysis.updatedAt).getTime() : 0
              );
              const isHeartbeatActive = lastActive >= cutoffTime.getTime();

              if (isLocked || isHeartbeatActive) {
                console.log(`[Job Reconciler] Analysis ${idStr} worker is active (locked: ${isLocked}, heartbeatActive: ${isHeartbeatActive}). Preserving.`);
                continue;
              }

              console.log(`[Job Reconciler] Analysis ${idStr} is active in BullMQ but worker lock expired and heartbeat stale. Treating as abandoned.`);
            }
          }
        } catch (queueErr) {
          console.warn(`[Job Reconciler] Transient queue inspection error for ${idStr}, preserving:`, queueErr.message);
          continue; // Preserves candidate job during transient Redis or queue inspection error
        }
      }

      // 3. Fresh Database Heartbeat Inspection:
      // Fetch fresh record from DB to verify if a worker updated the heartbeat concurrently
      const freshRecord = await Analysis.findById(analysis._id).select('status heartbeatAt updatedAt resumeFilename');
      if (!freshRecord || ['completed', 'failed'].includes(freshRecord.status)) {
        continue;
      }

      const freshActiveTime = Math.max(
        freshRecord.heartbeatAt ? new Date(freshRecord.heartbeatAt).getTime() : 0,
        freshRecord.updatedAt ? new Date(freshRecord.updatedAt).getTime() : 0
      );
      if (freshActiveTime >= cutoffTime.getTime()) {
        console.log(`[Job Reconciler] Analysis ${idStr} worker heartbeat is fresh. Preserving.`);
        continue;
      }

      // Re-evaluate cutoff at exact update execution point
      const currentCutoff = new Date(Date.now() - staleThresholdMs);

      // 4. Atomic Database State Transition:
      // Only transition if status is still non-terminal AND heartbeatAt remains expired.
      const updated = await Analysis.findOneAndUpdate(
        {
          _id: analysis._id,
          status: { $in: ['processing', 'queued', 'pending'] },
          $or: [
            { heartbeatAt: { $lt: currentCutoff } },
            { heartbeatAt: null, updatedAt: { $lt: currentCutoff } },
            { heartbeatAt: { $exists: false }, updatedAt: { $lt: currentCutoff } },
          ],
        },
        {
          $set: {
            status: 'failed',
            errorMessage:
              'Analysis timed out or was interrupted by a server restart. Please submit your resume again.',
          },
        },
        { new: true }
      );

      if (updated) {
        reconciledCount++;
        if (updated.user) {
          await UserDailyQuota.refundFailedAnalysisQuota(updated.user, updated.createdAt);
        }
        // Clean up orphan file if it still exists on disk
        const targetFilename = updated.resumeFilename || analysis.resumeFilename;
        if (targetFilename) {
          const safeFilename = path.basename(targetFilename);
          const filePath = path.join(uploadDir, safeFilename);
          safeUnlink(filePath);
        }
        console.log(`[Job Reconciler] Marked genuinely abandoned analysis ${analysis._id} as failed.`);
      }
    }

    return reconciledCount;
  } catch (err) {
    console.error('[Job Reconciler] Reconciliation error:', err.message);
    return 0;
  }
};

/**
 * Testing helper to inject mock queue or connection instances in test environments
 */
const setQueueInstancesForTesting = (instances = {}) => {
  if (instances.analyzeQueue !== undefined) analyzeQueue = instances.analyzeQueue;
  if (instances.redisConnection !== undefined) redisConnection = instances.redisConnection;
};

module.exports = {
  enqueueAnalysis,
  analyzeQueue,
  worker,
  redisConnection,
  processAnalysisJob,
  reconcileStaleJobs,
  inMemoryQueue,
  activeJobs,
  parseRetryAfter,
  safeUnlink,
  setQueueInstancesForTesting,
};
