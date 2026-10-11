// queue/analyzeQueue.js - Resilient Analysis Job Queue with in-memory and Redis support

const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');
const Analysis = require('../models/Analysis');

// Controlled settings
const QUEUE_CONCURRENCY = parseInt(process.env.QUEUE_CONCURRENCY || '1', 10);
const MAX_RETRIES = parseInt(process.env.MAX_RETRIES || '3', 10);
const RETRY_DELAY = parseInt(process.env.RETRY_DELAY || '10000', 10);

/**
 * Core processing function that executes resume analysis via Python NLP service
 * and directly updates the database.
 */
const processAnalysisJob = async (jobData) => {
  const { analysisId, resumePath, resumeOriginalName, jobDescription, webhookUrl } = jobData;
  console.log(`[Queue Worker] Processing analysis job: ${analysisId}`);

  let analysis = await Analysis.findById(analysisId);
  if (!analysis) {
    throw new Error(`Analysis ${analysisId} not found in DB`);
  }

  // Set status to processing
  analysis.status = 'processing';
  await analysis.save();

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
      analysis.score = Math.round(result.score || 0);
      analysis.matchedSkills = result.matched_skills || [];
      analysis.missingSkills = result.missing_skills || [];
      analysis.extractedSkills = result.extracted_skills || [];
      analysis.suggestions = result.suggestions || [];
      analysis.candidateInfo = result.candidate_info || {};
      analysis.summary = result.summary || '';
      analysis.experience = result.experience || [];
      analysis.education = result.education || [];
      analysis.projects = result.projects || [];
      analysis.certifications = result.certifications || [];
      analysis.languages = result.languages || [];
      analysis.achievements = result.achievements || [];
      analysis.status = 'completed';
      analysis.errorMessage = null;

      await analysis.save();
      console.log(`[Queue Worker] Job ${analysisId} completed successfully`);
      return { success: true };
    } else {
      throw new Error(result?.error || 'AI analysis failed');
    }
  } catch (error) {
    console.error(`[Queue Worker] Error processing job ${analysisId}:`, error.message);
    analysis.status = 'failed';
    analysis.errorMessage = error.response?.data?.error || error.message || 'AI processing failed.';
    await analysis.save();
    throw error;
  } finally {
    // Clean up temporary resume file
    if (resumePath && fs.existsSync(resumePath)) {
      fs.unlink(resumePath, (err) => {
        if (err) console.error('[Queue Worker] Cleanup error:', err.message);
      });
    }
  }
};

let analyzeQueue = null;
let worker = null;

// Only instantiate BullMQ when not in test environment and REDIS_URL is configured
const hasRedis = Boolean(process.env.REDIS_URL && process.env.REDIS_URL.trim());
const isTest = process.env.NODE_ENV === 'test';

if (!isTest && hasRedis) {
  try {
    const { Queue, Worker } = require('bullmq');
    const IORedis = require('ioredis');

    const redisOptions = { maxRetriesPerRequest: null };
    const connection = new IORedis(process.env.REDIS_URL, redisOptions);

    connection.on('error', (err) => {
      console.error('[Redis Error]', err.message);
    });

    analyzeQueue = new Queue('analyzeResume', { connection });

    worker = new Worker('analyzeResume', async (job) => {
      return await processAnalysisJob(job.data);
    }, {
      connection,
      concurrency: QUEUE_CONCURRENCY,
    });

    worker.on('failed', async (job, err) => {
      console.error(`[BullMQ Worker] Job ${job?.id} failed:`, err.message);
    });

    console.log('✅ BullMQ Redis queue worker initialized');
  } catch (e) {
    console.warn('⚠️ BullMQ initialization failed, falling back to in-memory async processing:', e.message);
    analyzeQueue = null;
    worker = null;
  }
}

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

  // In-Memory Asynchronous Fallback
  setImmediate(async () => {
    try {
      await processAnalysisJob(jobData);
    } catch (err) {
      console.error('[In-Memory Worker] Job execution failed:', err.message);
    }
  });

  return { id: jobData.analysisId };
};

module.exports = { enqueueAnalysis, analyzeQueue, worker, processAnalysisJob };
