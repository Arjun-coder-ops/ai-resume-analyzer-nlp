const { Queue, Worker } = require('bullmq');
const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');
const Analysis = require('../models/Analysis');

// We use REDIS_URL from env, or a fallback that will fail if not running
const redisOptions = { 
  maxRetriesPerRequest: null 
};

// If REDIS_URL exists, ioredis will parse it properly when passed to the constructor.
// BullMQ allows passing a Redis instance.
const IORedis = process.env.NODE_ENV === 'test' ? require('ioredis-mock') : require('ioredis');
const connection = process.env.REDIS_URL 
  ? new IORedis(process.env.REDIS_URL, redisOptions)
  : new IORedis(redisOptions);

const analyzeQueue = new Queue('analyzeResume', { 
  connection 
});

// Worker processes the queue
// Controlled concurrency to prevent Gemini API quota limits
const QUEUE_CONCURRENCY = parseInt(process.env.QUEUE_CONCURRENCY || '1', 10);
const MAX_RETRIES = parseInt(process.env.MAX_RETRIES || '3', 10);
const RETRY_DELAY = parseInt(process.env.RETRY_DELAY || '10000', 10);

// Note: BullMQ rate limiter ensures we don't exceed Gemini limits
// Gemini Limit: 5 RPM = 1 request every 12s. Since each analysis does 2 requests, 
// we rate limit to 1 job per 30 seconds to be extremely safe (~4 requests/min).
const rateLimitDuration = parseInt(process.env.QUEUE_RATE_LIMIT_DURATION || '30000', 10);

const worker = new Worker('analyzeResume', async (job) => {
  const { analysisId, resumePath, resumeOriginalName, jobDescription, webhookUrl } = job.data;
  console.log(`[Queue Worker] Processing analysis job: ${analysisId}`);

  let analysis = await Analysis.findById(analysisId);
  if (!analysis) {
    throw new Error(`Analysis ${analysisId} not found in DB`);
  }

  // Update status to processing
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
    formData.append('webhook_url', webhookUrl);

    const nlpUrl = `${process.env.NLP_SERVICE_URL || 'http://localhost:5001'}/analyze/async`;
    
    // Trigger Python service. It will return 202 quickly.
    await axios.post(nlpUrl, formData, {
      headers: {
        ...formData.getHeaders(),
        'X-Internal-Token': process.env.INTERNAL_NLP_TOKEN || ''
      }
    });

    // To prevent the worker from moving on to the next job and bursting Gemini requests,
    // we MUST wait for the webhook to complete the analysis.
    // We poll MongoDB locally in the worker to wait for the state transition.
    // Timeout after 3 minutes.
    const startTime = Date.now();
    const timeout = 3 * 60 * 1000;

    while (Date.now() - startTime < timeout) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Poll every 5s
      const current = await Analysis.findById(analysisId);
      if (current.status === 'completed') {
        console.log(`[Queue Worker] Job ${analysisId} completed successfully`);
        return { success: true };
      }
      if (current.status === 'failed') {
        throw new Error(current.errorMessage || 'AI Analysis Failed in webhook');
      }
    }

    throw new Error('Analysis timed out waiting for webhook response from Python.');
  } catch (error) {
    console.error(`[Queue Worker] Error processing job ${analysisId}:`, error.message);
    throw error; // Let BullMQ retry it based on MAX_RETRIES
  } finally {
    // Only cleanup the file if we are completed or have exhausted retries.
    // BullMQ gives us attemptsMade. If attemptsMade >= MAX_RETRIES, it will fail permanently.
    // We defer cleanup to the controller or queue events to be safer.
  }
}, {
  connection,
  concurrency: QUEUE_CONCURRENCY,
  limiter: {
    max: 1,
    duration: rateLimitDuration,
  }
});

// Event listeners for robust error handling and file cleanup
worker.on('completed', async (job) => {
  if (job.data.resumePath && fs.existsSync(job.data.resumePath)) {
    fs.unlink(job.data.resumePath, () => {});
  }
});

worker.on('failed', async (job, err) => {
  console.error(`[Queue Worker] Job ${job.id} failed:`, err.message);
  
  if (job.attemptsMade >= MAX_RETRIES) {
    console.error(`[Queue Worker] Job ${job.id} exhausted all retries. Setting status to failed.`);
    // Update DB on ultimate failure
    await Analysis.findByIdAndUpdate(job.data.analysisId, {
      status: 'failed',
      errorMessage: err.message || 'AI processing failed after multiple retries.',
    });
    // Cleanup file
    if (job.data.resumePath && fs.existsSync(job.data.resumePath)) {
      fs.unlink(job.data.resumePath, () => {});
    }
  }
});

const enqueueAnalysis = async (jobData) => {
  return await analyzeQueue.add('analyzeResume', jobData, {
    attempts: MAX_RETRIES,
    backoff: {
      type: 'fixed',
      delay: RETRY_DELAY,
    },
    jobId: jobData.analysisId, // Prevent duplicate jobs for the same analysis
  });
};

module.exports = { enqueueAnalysis, analyzeQueue, worker };
