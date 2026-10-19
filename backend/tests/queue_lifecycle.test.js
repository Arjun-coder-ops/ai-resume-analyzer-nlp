// tests/queue_lifecycle.test.js - Lifecycle, failure recovery, and consistency tests
process.env.NODE_ENV = 'test';

const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const Analysis = require('../models/Analysis');
const User = require('../models/User');
const { processAnalysisJob, reconcileStaleJobs, enqueueAnalysis, activeJobs, inMemoryQueue, setQueueInstancesForTesting } = require('../queue/analyzeQueue');
const { handleWebhook } = require('../controllers/analyzeController');

jest.mock('axios');
jest.setTimeout(20000);

describe('Background Job Lifecycle & State Consistency Tests', () => {
  let testUser1;
  let testUser2;
  const createdTempFiles = [];

  const createTempPdf = () => {
    const filePath = path.join(__dirname, `temp_test_${Date.now()}_${Math.random().toString(36).substring(7)}.pdf`);
    fs.writeFileSync(filePath, '%PDF-1.4 test resume content');
    createdTempFiles.push(filePath);
    return filePath;
  };

  beforeAll(async () => {
    process.env.INTERNAL_NLP_TOKEN = process.env.INTERNAL_NLP_TOKEN || 'test_internal_token_secret_32bytes';

    // Connect to in-memory/test MongoDB or existing connection
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/resume_analyzer_test');
    }

    // Clean up test data
    await Analysis.deleteMany({ jobTitle: /TestLifecycle/ });
    await User.deleteMany({ email: /test_lifecycle_user/ });

    testUser1 = await User.create({
      name: 'Test Lifecycle User 1',
      email: `test_lifecycle_user1_${Date.now()}@example.com`,
      password: 'password123',
    });

    testUser2 = await User.create({
      name: 'Test Lifecycle User 2',
      email: `test_lifecycle_user2_${Date.now()}@example.com`,
      password: 'password123',
    });
  });

  afterAll(async () => {
    for (const f of createdTempFiles) {
      if (fs.existsSync(f)) {
        try { fs.unlinkSync(f); } catch (e) {}
      }
    }
    await Analysis.deleteMany({ jobTitle: /TestLifecycle/ });
    await User.deleteMany({ email: /test_lifecycle_user/ });
    if (mongoose.connection && mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  });

  afterEach(() => {
    jest.clearAllMocks();
    axios.post.mockReset();
  });

  // ── TEST 1: Successful Analysis Reaches Persisted Completed State ──────────
  test('1. Successful analysis reaches persisted completed state and preserves scoring integrity', async () => {
    const analysis = await Analysis.create({
      user: testUser1._id,
      resumeFilename: 'test.pdf',
      resumeOriginalName: 'TestResume.pdf',
      jobTitle: 'TestLifecycle - Software Engineer',
      jobDescription: 'Software Engineer with React and Node.js expertise required.',
      status: 'processing',
    });

    axios.post.mockResolvedValueOnce({
      data: {
        status: 'completed',
        score: 84,
        match_level: 'Strong Match',
        scoring_breakdown: {
          skills_match: { score: 34, max: 40 },
          experience_alignment: { score: 21, max: 25 },
          education_credentials: { score: 14, max: 15 },
          content_impact: { score: 8, max: 10 },
          ats_parseability: { score: 7, max: 10 },
        },
        matched_skills: ['React', 'Node.js'],
        missing_skills: ['AWS'],
        suggestions: ['Include cloud deployment metrics'],
      },
    });

    const result = await processAnalysisJob({
      analysisId: analysis._id.toString(),
      resumePath: createTempPdf(),
      resumeOriginalName: 'TestResume.pdf',
      jobDescription: analysis.jobDescription,
    });

    expect(result.success).toBe(true);

    const updated = await Analysis.findById(analysis._id);
    expect(updated.status).toBe('completed');
    expect(updated.score).toBe(84);
    expect(updated.matchLevel).toBe('Strong Match');
    expect(updated.scoringBreakdown.skills_match.score).toBe(34);
    expect(updated.matchedSkills).toContain('React');
    expect(updated.errorMessage).toBeNull();
  });

  // ── TEST 2: NLP Failure Reaches Persisted Failed State on Retry Exhaustion ─
  test('2. NLP-service failure reaches persisted failed state after retry exhaustion', async () => {
    const analysis = await Analysis.create({
      user: testUser1._id,
      resumeFilename: 'fail_test.pdf',
      resumeOriginalName: 'FailResume.pdf',
      jobTitle: 'TestLifecycle - Backend Developer',
      jobDescription: 'Backend Developer with Node.js and MongoDB.',
      status: 'processing',
    });

    axios.post.mockRejectedValue(new Error('Connection refused by NLP service: 503 Service Unavailable'));

    // Attempt 3 of 3 (final attempt)
    await expect(
      processAnalysisJob(
        {
          analysisId: analysis._id.toString(),
          resumePath: createTempPdf(),
          resumeOriginalName: 'FailResume.pdf',
          jobDescription: analysis.jobDescription,
        },
        3,
        3
      )
    ).rejects.toThrow();

    const updated = await Analysis.findById(analysis._id);
    expect(updated.status).toBe('failed');
    expect(updated.errorMessage).toMatch(/Connection refused/);
  });

  // ── TEST 3: Retryable Errors are Re-thrown for Queue Retry ───────────────
  test('3. Retryable 5xx/network errors do not mark status as failed prematurely on intermediate attempts', async () => {
    const analysis = await Analysis.create({
      user: testUser1._id,
      resumeFilename: 'retry_test.pdf',
      resumeOriginalName: 'RetryResume.pdf',
      jobTitle: 'TestLifecycle - Full Stack',
      jobDescription: 'Full Stack Developer with TypeScript.',
      status: 'processing',
    });

    axios.post.mockRejectedValueOnce(new Error('NLP timeout 504 Gateway Timeout'));

    // Attempt 1 of 3
    await expect(
      processAnalysisJob(
        {
          analysisId: analysis._id.toString(),
          resumePath: createTempPdf(),
          resumeOriginalName: 'RetryResume.pdf',
          jobDescription: analysis.jobDescription,
        },
        1,
        3
      )
    ).rejects.toThrow('NLP timeout 504');

    // Analysis status should NOT be set to failed yet
    const afterAttempt1 = await Analysis.findById(analysis._id);
    expect(afterAttempt1.status).toBe('processing');
  });

  // ── TEST 4: Permanent 4xx Client Errors are Marked Failed Immediately ─────
  test('4. Permanent 4xx client errors are terminated immediately without retrying', async () => {
    const analysis = await Analysis.create({
      user: testUser1._id,
      resumeFilename: 'client_err.pdf',
      resumeOriginalName: 'ClientErr.pdf',
      jobTitle: 'TestLifecycle - QA Engineer',
      jobDescription: 'QA Engineer with Cypress.',
      status: 'processing',
    });

    const clientError = new Error('Request failed with status code 400');
    clientError.response = {
      status: 400,
      data: { error: 'Invalid or corrupted PDF document structure' },
    };
    axios.post.mockRejectedValueOnce(clientError);

    // Attempt 1 of 3, but error is 400 Bad Request
    await expect(
      processAnalysisJob(
        {
          analysisId: analysis._id.toString(),
          resumePath: createTempPdf(),
          resumeOriginalName: 'ClientErr.pdf',
          jobDescription: analysis.jobDescription,
        },
        1,
        3
      )
    ).rejects.toThrow();

    const updated = await Analysis.findById(analysis._id);
    expect(updated.status).toBe('failed');
    expect(updated.errorMessage).toBe('Invalid or corrupted PDF document structure');
  });

  // ── TEST 5: Reprocessing a Completed Job Does Not Overwrite Results ───────
  test('5. Reprocessing a completed job does not overwrite successful scores or revert status', async () => {
    const completedAnalysis = await Analysis.create({
      user: testUser1._id,
      resumeFilename: 'completed.pdf',
      resumeOriginalName: 'CompletedResume.pdf',
      jobTitle: 'TestLifecycle - Senior Architect',
      jobDescription: 'Cloud Architect with Microservices.',
      status: 'completed',
      score: 91,
      matchLevel: 'Strong Match',
    });

    const result = await processAnalysisJob({
      analysisId: completedAnalysis._id.toString(),
      resumePath: createTempPdf(),
      resumeOriginalName: 'CompletedResume.pdf',
      jobDescription: completedAnalysis.jobDescription,
    });

    expect(result.alreadyCompleted).toBe(true);

    const fresh = await Analysis.findById(completedAnalysis._id);
    expect(fresh.status).toBe('completed');
    expect(fresh.score).toBe(91);
    expect(fresh.matchLevel).toBe('Strong Match');
    // Ensure axios was never called
    expect(axios.post).not.toHaveBeenCalled();
  });

  // ── TEST 6: Stale Failure Webhook Cannot Overwrite Completed Analysis ─────
  test('6. Stale failure webhook cannot overwrite an already completed analysis', async () => {
    const completedAnalysis = await Analysis.create({
      user: testUser1._id,
      resumeFilename: 'webhook_test.pdf',
      resumeOriginalName: 'WebhookResume.pdf',
      jobTitle: 'TestLifecycle - DevOps',
      jobDescription: 'DevOps Engineer with Kubernetes.',
      status: 'completed',
      score: 88,
    });

    const req = {
      params: { id: completedAnalysis._id.toString() },
      headers: { 'x-internal-token': process.env.INTERNAL_NLP_TOKEN },
      body: {
        status: 'failed',
        error: 'Late-arriving failure from disconnected worker',
      },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await handleWebhook(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        message: expect.stringMatching(/completed/i),
      })
    );

    const fresh = await Analysis.findById(completedAnalysis._id);
    expect(fresh.status).toBe('completed');
    expect(fresh.score).toBe(88);
  });

  // ── TEST 7: Stale Job Reconciliation ─────────────────────────────────────
  test('7. Stale job reconciliation marks abandoned processing jobs as failed', async () => {
    // Create an analysis simulated as running 10 minutes ago
    const staleAnalysis = await Analysis.create({
      user: testUser1._id,
      resumeFilename: 'stale.pdf',
      resumeOriginalName: 'StaleResume.pdf',
      jobTitle: 'TestLifecycle - Stale Worker',
      jobDescription: 'Software Developer role requirements.',
      status: 'processing',
    });

    // Manually push updatedAt back by 10 minutes with timestamps disabled
    await Analysis.updateOne(
      { _id: staleAnalysis._id },
      { $set: { updatedAt: new Date(Date.now() - 10 * 60 * 1000) } },
      { timestamps: false }
    );

    const reconciledCount = await reconcileStaleJobs(5 * 60 * 1000);
    expect(reconciledCount).toBeGreaterThanOrEqual(1);

    const fresh = await Analysis.findById(staleAnalysis._id);
    expect(fresh.status).toBe('failed');
    expect(fresh.errorMessage).toMatch(/interrupted by a server restart/);
  });

  // ── TEST 8: Recent Completed Analysis is Not Touched by Reconciliation ────
  test('8. Reconciler leaves completed analyses untouched', async () => {
    const completedOld = await Analysis.create({
      user: testUser1._id,
      resumeFilename: 'completed_old.pdf',
      resumeOriginalName: 'CompletedOld.pdf',
      jobTitle: 'TestLifecycle - Untouched',
      jobDescription: 'Role description.',
      status: 'completed',
      score: 85,
    });

    await Analysis.updateOne(
      { _id: completedOld._id },
      { $set: { updatedAt: new Date(Date.now() - 20 * 60 * 1000) } },
      { timestamps: false }
    );

    await reconcileStaleJobs(5 * 60 * 1000);

    const fresh = await Analysis.findById(completedOld._id);
    expect(fresh.status).toBe('completed');
    expect(fresh.score).toBe(85);
  });

  // ── TEST 9: Missing Analysis ID Handling in Worker ────────────────────────
  test('9. Missing analysis record throws terminal error without infinite retry', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();

    await expect(
      processAnalysisJob({
        analysisId: fakeId,
        resumePath: createTempPdf(),
        resumeOriginalName: 'Fake.pdf',
        jobDescription: 'Job description text.',
      })
    ).rejects.toThrow(/not found in DB/);
  });

  // ── TEST 10: In-Memory Fallback Enqueue Safety ────────────────────────────
  test('10. In-memory fallback handles enqueue gracefully when Redis is unavailable', async () => {
    const jobData = {
      analysisId: new mongoose.Types.ObjectId().toString(),
      resumePath: createTempPdf(),
      resumeOriginalName: 'Fallback.pdf',
      jobDescription: 'Job description text.',
    };

    const res = await enqueueAnalysis(jobData);
    expect(res).toHaveProperty('id', jobData.analysisId);
  });

  // ── TEST 11 (Test A - Part 1): Concurrent Completion and Failure (Completion Wins First) ──
  test('11. Test A1: Concurrent completion and failure - completion wins first and preserves scores', async () => {
    const analysis = await Analysis.create({
      user: testUser1._id,
      resumeFilename: 'test_a1.pdf',
      resumeOriginalName: 'TestA1.pdf',
      jobTitle: 'TestLifecycle - Concurrent Race A1',
      jobDescription: 'Software Engineer with React and Node.js expertise required.',
      status: 'processing',
    });

    const tempPdf = createTempPdf();

    axios.post.mockResolvedValueOnce({
      data: {
        status: 'completed',
        score: 87,
        match_level: 'Strong Match',
        scoring_breakdown: {
          skills_match: { score: 35, max: 40 },
          experience_alignment: { score: 22, max: 25 },
        },
        matched_skills: ['React', 'Node.js'],
        missing_skills: [],
      },
    });

    // 1. Worker completes the job successfully
    const result = await processAnalysisJob({
      analysisId: analysis._id.toString(),
      resumePath: tempPdf,
      resumeOriginalName: 'TestA1.pdf',
      jobDescription: analysis.jobDescription,
    });
    expect(result.success).toBe(true);

    // 2. Concurrent/stale failure handler attempts to mark the record as failed
    const failureUpdate = await Analysis.findOneAndUpdate(
      { _id: analysis._id, status: { $in: ['processing', 'queued', 'pending'] } },
      {
        $set: {
          status: 'failed',
          errorMessage: 'Late failure from concurrent worker attempt',
        },
      }
    );

    // Atomic conditional update must match 0 documents because status is already 'completed'
    expect(failureUpdate).toBeNull();

    // 3. Verify final DB state remains completed with scores intact
    const fresh = await Analysis.findById(analysis._id);
    expect(fresh.status).toBe('completed');
    expect(fresh.score).toBe(87);
    expect(fresh.matchLevel).toBe('Strong Match');
    expect(fresh.errorMessage).toBeNull();
  });

  // ── TEST 12 (Test A - Part 2): Concurrent Completion and Failure (Failure Wins First) ─────
  test('12. Test A2: Concurrent completion and failure - failure wins first and prevents corrupted hybrid state', async () => {
    const analysis = await Analysis.create({
      user: testUser1._id,
      resumeFilename: 'test_a2.pdf',
      resumeOriginalName: 'TestA2.pdf',
      jobTitle: 'TestLifecycle - Concurrent Race A2',
      jobDescription: 'DevOps Engineer with Kubernetes and Terraform experience required.',
      status: 'processing',
    });

    const tempPdf = createTempPdf();

    // 1. Failure transition wins first (e.g. worker timeout or fatal error)
    const failureUpdate = await Analysis.findOneAndUpdate(
      { _id: analysis._id, status: { $in: ['processing', 'queued', 'pending'] } },
      {
        $set: {
          status: 'failed',
          errorMessage: 'Initial processing failed due to upstream network failure.',
        },
      },
      { new: true }
    );
    expect(failureUpdate).not.toBeNull();
    expect(failureUpdate.status).toBe('failed');

    // 2. Late completion attempt arrives
    const completionResult = await processAnalysisJob({
      analysisId: analysis._id.toString(),
      resumePath: tempPdf,
      resumeOriginalName: 'TestA2.pdf',
      jobDescription: analysis.jobDescription,
    });

    // Guard rejects completion since status is already terminal failed and avoids redundant external call
    expect(completionResult.alreadyFailed).toBe(true);
    expect(axios.post).not.toHaveBeenCalled();

    // 3. Verify database state remains cleanly failed without score corruption
    const fresh = await Analysis.findById(analysis._id);
    expect(fresh.status).toBe('failed');
    expect(fresh.errorMessage).toBe('Initial processing failed due to upstream network failure.');
    expect(fresh.score).toBe(0);
  });

  // ── TEST 13 (Test B): Delayed Failure Webhook and Duplicate Completion Webhook ────────────
  test('13. Test B: Delayed failure webhook and duplicate completion webhook cannot corrupt completed analysis', async () => {
    const analysis = await Analysis.create({
      user: testUser1._id,
      resumeFilename: 'test_b.pdf',
      resumeOriginalName: 'TestB.pdf',
      jobTitle: 'TestLifecycle - Webhook Race',
      jobDescription: 'Frontend Engineer with React and TypeScript.',
      status: 'completed',
      score: 94,
      matchLevel: 'Strong Match',
      errorMessage: null,
    });

    // 1. Deliver delayed failure webhook for already completed analysis
    const failureReq = {
      params: { id: analysis._id.toString() },
      headers: { 'x-internal-token': process.env.INTERNAL_NLP_TOKEN || '' },
      body: {
        status: 'failed',
        error: 'Delayed failure payload arriving after completion',
      },
    };
    const failureRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await handleWebhook(failureReq, failureRes);

    expect(failureRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        message: expect.stringMatching(/completed/i),
      })
    );

    // Verify record remains untouched
    let fresh = await Analysis.findById(analysis._id);
    expect(fresh.status).toBe('completed');
    expect(fresh.score).toBe(94);
    expect(fresh.errorMessage).toBeNull();

    // 2. Deliver duplicate completion webhook with different scores
    const duplicateReq = {
      params: { id: analysis._id.toString() },
      headers: { 'x-internal-token': process.env.INTERNAL_NLP_TOKEN || '' },
      body: {
        status: 'completed',
        score: 40, // Attacker or bug sending lower score
        match_level: 'Low Match',
      },
    };
    const duplicateRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await handleWebhook(duplicateReq, duplicateRes);

    expect(duplicateRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        message: expect.stringMatching(/already completed/i),
      })
    );

    // Verify existing completed score was NOT corrupted or overwritten
    fresh = await Analysis.findById(analysis._id);
    expect(fresh.status).toBe('completed');
    expect(fresh.score).toBe(94);
    expect(fresh.matchLevel).toBe('Strong Match');
  });

  // ── TEST 14 (Test C): HTTP 429 Retryable Classification, PDF Preservation & Bounded Retries ──
  test('14. Test C: HTTP 429 is classified as retryable, preserves PDF, and fails only upon retry exhaustion', async () => {
    const analysis = await Analysis.create({
      user: testUser1._id,
      resumeFilename: 'test_c_429.pdf',
      resumeOriginalName: 'TestC429.pdf',
      jobTitle: 'TestLifecycle - Rate Limit 429',
      jobDescription: 'Site Reliability Engineer with Kubernetes and Prometheus.',
      status: 'processing',
    });

    const tempPdf = createTempPdf();
    expect(fs.existsSync(tempPdf)).toBe(true);

    const rateLimitError = new Error('Request failed with status code 429');
    rateLimitError.response = {
      status: 429,
      headers: { 'retry-after': '2' },
      data: { error: 'Rate limit exceeded: Please wait 2 seconds.' },
    };

    // Attempt 1 of 3: Should be treated as retryable, NOT fatal
    axios.post.mockRejectedValueOnce(rateLimitError);

    let caughtErr;
    try {
      await processAnalysisJob(
        {
          analysisId: analysis._id.toString(),
          resumePath: tempPdf,
          resumeOriginalName: 'TestC429.pdf',
          jobDescription: analysis.jobDescription,
        },
        1,
        3
      );
    } catch (err) {
      caughtErr = err;
    }

    expect(caughtErr).toBeDefined();
    // Must NOT be an UnrecoverableError
    expect(caughtErr.name).not.toBe('UnrecoverableError');
    expect(caughtErr.isTerminal).toBeFalsy();
    // Must parse Retry-After header: 2 seconds = 2000ms
    expect(caughtErr.retryAfterMs).toBe(2000);

    // Analysis status must remain 'processing' (not marked failed prematurely on attempt 1)
    let fresh = await Analysis.findById(analysis._id);
    expect(fresh.status).toBe('processing');

    // PDF document MUST still exist on disk for the next attempt
    expect(fs.existsSync(tempPdf)).toBe(true);

    // Attempt 3 of 3 (final attempt): Retries exhausted, now transitions to terminal failure
    axios.post.mockRejectedValueOnce(rateLimitError);

    await expect(
      processAnalysisJob(
        {
          analysisId: analysis._id.toString(),
          resumePath: tempPdf,
          resumeOriginalName: 'TestC429.pdf',
          jobDescription: analysis.jobDescription,
        },
        3,
        3
      )
    ).rejects.toThrow();

    // After retry exhaustion, status transitions to failed and file is safely cleaned up
    fresh = await Analysis.findById(analysis._id);
    expect(fresh.status).toBe('failed');
    expect(fresh.errorMessage).toMatch(/Rate limit exceeded/);
    expect(fs.existsSync(tempPdf)).toBe(false);
  });

  // ── TEST 15 (Test D): HTTP 408 Retryable vs HTTP 400 Non-Retryable Client Error ───────────
  test('15. Test D: HTTP 408 Request Timeout is retryable, whereas HTTP 400 Bad Request terminates immediately', async () => {
    // Part 1: HTTP 408 Request Timeout
    const analysis408 = await Analysis.create({
      user: testUser1._id,
      resumeFilename: 'test_d_408.pdf',
      resumeOriginalName: 'TestD408.pdf',
      jobTitle: 'TestLifecycle - Timeout 408',
      jobDescription: 'Data Engineer with Spark and Python.',
      status: 'processing',
    });
    const tempPdf408 = createTempPdf();

    const timeoutErr = new Error('Request failed with status code 408');
    timeoutErr.response = {
      status: 408,
      data: { error: 'Request Timeout: Gateway timed out processing request.' },
    };
    axios.post.mockRejectedValueOnce(timeoutErr);

    let caught408;
    try {
      await processAnalysisJob(
        {
          analysisId: analysis408._id.toString(),
          resumePath: tempPdf408,
          resumeOriginalName: 'TestD408.pdf',
          jobDescription: analysis408.jobDescription,
        },
        1,
        3
      );
    } catch (err) {
      caught408 = err;
    }

    // HTTP 408 must be retryable on attempt 1
    expect(caught408.name).not.toBe('UnrecoverableError');
    expect(caught408.isTerminal).toBeFalsy();
    const fresh408 = await Analysis.findById(analysis408._id);
    expect(fresh408.status).toBe('processing');
    expect(fs.existsSync(tempPdf408)).toBe(true);

    // Part 2: HTTP 400 Bad Request (Genuinely unrecoverable client error)
    const analysis400 = await Analysis.create({
      user: testUser1._id,
      resumeFilename: 'test_d_400.pdf',
      resumeOriginalName: 'TestD400.pdf',
      jobTitle: 'TestLifecycle - Bad Request 400',
      jobDescription: 'Frontend Engineer with Angular and CSS.',
      status: 'processing',
    });
    const tempPdf400 = createTempPdf();

    const badReqErr = new Error('Request failed with status code 400');
    badReqErr.response = {
      status: 400,
      data: { error: 'Invalid PDF format: file corrupted' },
    };
    axios.post.mockRejectedValueOnce(badReqErr);

    let caught400;
    try {
      await processAnalysisJob(
        {
          analysisId: analysis400._id.toString(),
          resumePath: tempPdf400,
          resumeOriginalName: 'TestD400.pdf',
          jobDescription: analysis400.jobDescription,
        },
        1,
        3
      );
    } catch (err) {
      caught400 = err;
    }

    // HTTP 400 must terminate retries immediately (UnrecoverableError / isTerminal: true)
    expect(caught400.name === 'UnrecoverableError' || caught400.isTerminal === true).toBe(true);
    const fresh400 = await Analysis.findById(analysis400._id);
    expect(fresh400.status).toBe('failed');
    expect(fresh400.errorMessage).toBe('Invalid PDF format: file corrupted');
    expect(fs.existsSync(tempPdf400)).toBe(false);
  });

  // ── TEST 16 (Test E): BullMQ Terminal Failure Handler Cannot Overwrite Completed Analysis ──
  test('16. Test E: BullMQ terminal failure handler cannot overwrite completed analysis record', async () => {
    const analysis = await Analysis.create({
      user: testUser1._id,
      resumeFilename: 'test_e.pdf',
      resumeOriginalName: 'TestE.pdf',
      jobTitle: 'TestLifecycle - BullMQ Event Race',
      jobDescription: 'Security Engineer with AWS IAM and SOC2 compliance.',
      status: 'completed',
      score: 96,
      matchLevel: 'Strong Match',
      errorMessage: null,
    });

    const tempPdf = createTempPdf();

    // Simulate BullMQ terminal failure event firing late (e.g. queue timeout or stalled job event)
    const terminalUpdateResult = await Analysis.findOneAndUpdate(
      { _id: analysis._id, status: { $in: ['processing', 'queued', 'pending'] } },
      {
        $set: {
          status: 'failed',
          errorMessage: 'BullMQ terminal failure event from stalled job listener',
        },
      }
    );

    // Terminal failure update matches 0 documents because record is completed
    expect(terminalUpdateResult).toBeNull();

    // Database record remains completely intact with completed status and valid scores
    const fresh = await Analysis.findById(analysis._id);
    expect(fresh.status).toBe('completed');
    expect(fresh.score).toBe(96);
    expect(fresh.errorMessage).toBeNull();
  });

  // ── TEST 17: Long-running analysis with fresh worker heartbeat is preserved ──
  test('17. Analysis running longer than 5 minutes remains processing when its worker heartbeat is active', async () => {
    const longRunningAnalysis = await Analysis.create({
      user: testUser1._id,
      resumeFilename: 'long_running.pdf',
      resumeOriginalName: 'LongRunning.pdf',
      jobTitle: 'TestLifecycle - Long Running Active Worker',
      jobDescription: 'Senior Architect role with extensive requirements.',
      status: 'processing',
    });

    // Simulate an analysis started 10 minutes ago, but whose worker updated heartbeat 30 seconds ago
    await Analysis.updateOne(
      { _id: longRunningAnalysis._id },
      {
        $set: {
          createdAt: new Date(Date.now() - 10 * 60 * 1000),
          updatedAt: new Date(Date.now() - 10 * 60 * 1000),
          heartbeatAt: new Date(Date.now() - 30 * 1000),
        },
      },
      { timestamps: false }
    );

    // Run reconciliation with 5-minute threshold
    const reconciledCount = await reconcileStaleJobs(5 * 60 * 1000);
    expect(reconciledCount).toBe(0);

    // The analysis must remain in 'processing' status and must NOT be marked failed
    const fresh = await Analysis.findById(longRunningAnalysis._id);
    expect(fresh.status).toBe('processing');
    expect(fresh.errorMessage).toBeNull();
  });

  // ── TEST 18: In-memory fallback active job is preserved during reconciliation ──
  test('18. Reconciler preserves analyses that are actively in the local in-memory worker set', async () => {
    const inMemoryActiveAnalysis = await Analysis.create({
      user: testUser1._id,
      resumeFilename: 'in_memory_active.pdf',
      resumeOriginalName: 'InMemoryActive.pdf',
      jobTitle: 'TestLifecycle - In-Memory Active Worker',
      jobDescription: 'Software Engineer role.',
      status: 'processing',
    });

    // Simulate updatedAt 10 minutes ago with no fresh heartbeat
    await Analysis.updateOne(
      { _id: inMemoryActiveAnalysis._id },
      {
        $set: {
          updatedAt: new Date(Date.now() - 10 * 60 * 1000),
          heartbeatAt: null,
        },
      },
      { timestamps: false }
    );

    // Register analysisId in activeJobs to demonstrate local in-memory execution
    activeJobs.add(inMemoryActiveAnalysis._id.toString());

    try {
      const reconciledCount = await reconcileStaleJobs(5 * 60 * 1000);
      expect(reconciledCount).toBe(0);

      const fresh = await Analysis.findById(inMemoryActiveAnalysis._id);
      expect(fresh.status).toBe('processing');
      expect(fresh.errorMessage).toBeNull();
    } finally {
      activeJobs.delete(inMemoryActiveAnalysis._id.toString());
    }
  });

  // ── TEST 19: Genuinely abandoned job (expired heartbeat) is transitioned to failed ──
  test('19. Genuinely abandoned job with expired heartbeat is failed by reconciler', async () => {
    const abandonedAnalysis = await Analysis.create({
      user: testUser1._id,
      resumeFilename: 'abandoned.pdf',
      resumeOriginalName: 'Abandoned.pdf',
      jobTitle: 'TestLifecycle - Genuinely Abandoned',
      jobDescription: 'Role description.',
      status: 'processing',
    });

    // Both updatedAt and heartbeatAt are 15 minutes old (stale)
    await Analysis.updateOne(
      { _id: abandonedAnalysis._id },
      {
        $set: {
          updatedAt: new Date(Date.now() - 15 * 60 * 1000),
          heartbeatAt: new Date(Date.now() - 15 * 60 * 1000),
        },
      },
      { timestamps: false }
    );

    const reconciledCount = await reconcileStaleJobs(5 * 60 * 1000);
    expect(reconciledCount).toBeGreaterThanOrEqual(1);

    const fresh = await Analysis.findById(abandonedAnalysis._id);
    expect(fresh.status).toBe('failed');
    expect(fresh.errorMessage).toMatch(/interrupted by a server restart/);
  });

  // ── TEST 20: Reconciler racing with worker completion cannot regress state ──
  test('20. Reconciler racing with worker completion cannot regress completed analysis', async () => {
    const racingAnalysis = await Analysis.create({
      user: testUser1._id,
      resumeFilename: 'racing.pdf',
      resumeOriginalName: 'Racing.pdf',
      jobTitle: 'TestLifecycle - Racing Worker',
      jobDescription: 'Role description.',
      status: 'processing',
    });

    await Analysis.updateOne(
      { _id: racingAnalysis._id },
      {
        $set: {
          updatedAt: new Date(Date.now() - 10 * 60 * 1000),
          heartbeatAt: new Date(Date.now() - 10 * 60 * 1000),
        },
      },
      { timestamps: false }
    );

    // Simulate worker completing right before reconciler's atomic findOneAndUpdate
    await Analysis.updateOne(
      { _id: racingAnalysis._id },
      {
        $set: {
          status: 'completed',
          score: 93,
          matchLevel: 'Strong Match',
          errorMessage: null,
        },
      }
    );

    // Reconciler runs
    const reconciledCount = await reconcileStaleJobs(5 * 60 * 1000);
    expect(reconciledCount).toBe(0);

    const fresh = await Analysis.findById(racingAnalysis._id);
    expect(fresh.status).toBe('completed');
    expect(fresh.score).toBe(93);
    expect(fresh.errorMessage).toBeNull();
  });

  // ── TEST 21: Concurrent reconcilers execute safely without conflict ──
  test('21. Concurrent reconcilers execute safely across multiple instances without double-processing', async () => {
    const job1 = await Analysis.create({
      user: testUser1._id,
      resumeFilename: 'concurrent_reconcile_1.pdf',
      resumeOriginalName: 'Conc1.pdf',
      jobTitle: 'TestLifecycle - Conc 1',
      jobDescription: 'Description 1.',
      status: 'processing',
    });

    const job2 = await Analysis.create({
      user: testUser1._id,
      resumeFilename: 'concurrent_reconcile_2.pdf',
      resumeOriginalName: 'Conc2.pdf',
      jobTitle: 'TestLifecycle - Conc 2',
      jobDescription: 'Description 2.',
      status: 'processing',
    });

    const staleTime = new Date(Date.now() - 12 * 60 * 1000);
    await Analysis.updateMany(
      { _id: { $in: [job1._id, job2._id] } },
      { $set: { updatedAt: staleTime, heartbeatAt: staleTime } },
      { timestamps: false }
    );

    // Simulate 2 reconciler instances running at the exact same moment
    const [countInstance1, countInstance2] = await Promise.all([
      reconcileStaleJobs(5 * 60 * 1000),
      reconcileStaleJobs(5 * 60 * 1000),
    ]);

    // Total transitioned across both instances must equal exactly 2
    expect(countInstance1 + countInstance2).toBe(2);

    const fresh1 = await Analysis.findById(job1._id);
    const fresh2 = await Analysis.findById(job2._id);
    expect(fresh1.status).toBe('failed');
    expect(fresh2.status).toBe('failed');
  });

  // ── TEST 22: Active worker completion recovers analysis falsely marked failed by timeout reconciler race ──
  test('22. Active worker completion recovers analysis falsely marked failed by timeout reconciler race', async () => {
    const analysis = await Analysis.create({
      user: testUser1._id,
      resumeFilename: 'reconcile_race_recovery.pdf',
      resumeOriginalName: 'ReconcileRace.pdf',
      jobTitle: 'TestLifecycle - Reconcile Race Recovery',
      jobDescription: 'Backend Engineer with Node.js and MongoDB.',
      status: 'processing',
    });

    const tempPdf = createTempPdf();

    // 1. Mock NLP service call: while worker is awaiting response, reconciler marks status as failed due to timeout race
    axios.post.mockImplementationOnce(async () => {
      await Analysis.updateOne(
        { _id: analysis._id },
        {
          $set: {
            status: 'failed',
            errorMessage: 'Analysis timed out or was interrupted by a server restart. Please submit your resume again.',
            heartbeatAt: null,
          },
        }
      );
      return {
        data: {
          status: 'completed',
          score: 91,
          match_level: 'Strong Match',
          scoring_breakdown: { hard_skills: 90, soft_skills: 85, experience: 95 },
          mandatory_warnings: [],
        },
      };
    });

    const completionResult = await processAnalysisJob({
      analysisId: analysis._id.toString(),
      resumePath: tempPdf,
      resumeOriginalName: 'ReconcileRace.pdf',
      jobDescription: analysis.jobDescription,
    });

    expect(completionResult.success).toBe(true);

    // 2. Database document must be cleanly transitioned to completed with authentic scores
    const fresh = await Analysis.findById(analysis._id);
    expect(fresh.status).toBe('completed');
    expect(fresh.score).toBe(91);
    expect(fresh.matchLevel).toBe('Strong Match');
    expect(fresh.errorMessage).toBeNull();
  });

  // ── TEST 23: BullMQ active job without worker lock or heartbeat is failed, while active locked job is preserved ──
  test('23. BullMQ active job without lock or heartbeat is treated as abandoned, while locked active job is preserved', async () => {
    const abandonedJob = await Analysis.create({
      user: testUser1._id,
      resumeFilename: 'bullmq_abandoned.pdf',
      resumeOriginalName: 'BullAbandoned.pdf',
      jobTitle: 'TestLifecycle - BullMQ Abandoned',
      jobDescription: 'Cloud Architect role.',
      status: 'processing',
    });

    const activeJobWithLock = await Analysis.create({
      user: testUser1._id,
      resumeFilename: 'bullmq_active_locked.pdf',
      resumeOriginalName: 'BullActive.pdf',
      jobTitle: 'TestLifecycle - BullMQ Active Locked',
      jobDescription: 'Cloud Architect role.',
      status: 'processing',
    });

    const staleTime = new Date(Date.now() - 10 * 60 * 1000);
    await Analysis.updateMany(
      { _id: { $in: [abandonedJob._id, activeJobWithLock._id] } },
      { $set: { updatedAt: staleTime, heartbeatAt: staleTime } },
      { timestamps: false }
    );

    // Mock BullMQ queue
    const mockBullQueue = {
      getJob: jest.fn(async (id) => {
        if (id === abandonedJob._id.toString()) {
          return {
            getState: async () => 'active',
            attemptsMade: 1,
            opts: { attempts: 3 },
          };
        }
        if (id === activeJobWithLock._id.toString()) {
          return {
            getState: async () => 'active',
            attemptsMade: 1,
            opts: { attempts: 3 },
          };
        }
        return null;
      }),
      toKey: (key) => `bull:analyzeResume:${key}`,
    };

    const mockRedisConnection = {
      get: jest.fn(async (key) => {
        // Active job holds the lock; abandoned job lock has expired (returns null)
        if (key.includes(activeJobWithLock._id.toString())) {
          return 'worker-lock-token-xyz';
        }
        return null;
      }),
    };

    setQueueInstancesForTesting({
      analyzeQueue: mockBullQueue,
      redisConnection: mockRedisConnection,
    });

    try {
      const reconciled = await reconcileStaleJobs(5 * 60 * 1000);
      expect(reconciled).toBe(1);

      const freshAbandoned = await Analysis.findById(abandonedJob._id);
      expect(freshAbandoned.status).toBe('failed');
      expect(freshAbandoned.errorMessage).toMatch(/interrupted by a server restart/);

      const freshActive = await Analysis.findById(activeJobWithLock._id);
      expect(freshActive.status).toBe('processing');
      expect(freshActive.errorMessage).toBeNull();
    } finally {
      setQueueInstancesForTesting({
        analyzeQueue: null,
        redisConnection: null,
      });
    }
  });

  // ── TEST 24: Transient BullMQ queue inspection error safely preserves candidate jobs ──
  test('24. Transient BullMQ queue inspection error safely preserves candidate jobs without failing them', async () => {
    const candidateAnalysis = await Analysis.create({
      user: testUser1._id,
      resumeFilename: 'transient_redis_err.pdf',
      resumeOriginalName: 'TransientRedis.pdf',
      jobTitle: 'TestLifecycle - Transient Redis Err',
      jobDescription: 'Systems Engineer role.',
      status: 'processing',
    });

    const staleTime = new Date(Date.now() - 10 * 60 * 1000);
    await Analysis.updateOne(
      { _id: candidateAnalysis._id },
      { $set: { updatedAt: staleTime, heartbeatAt: staleTime } },
      { timestamps: false }
    );

    // Mock BullMQ queue throwing a transient Redis error
    const mockBullQueue = {
      getJob: jest.fn(async () => {
        throw new Error('ECONNRESET: Redis connection lost during cluster failover');
      }),
      toKey: (key) => `bull:analyzeResume:${key}`,
    };

    setQueueInstancesForTesting({
      analyzeQueue: mockBullQueue,
    });

    try {
      const reconciled = await reconcileStaleJobs(5 * 60 * 1000);
      // Transient error must preserve the job (not fail it!)
      expect(reconciled).toBe(0);

      const fresh = await Analysis.findById(candidateAnalysis._id);
      expect(fresh.status).toBe('processing');
      expect(fresh.errorMessage).toBeNull();
    } finally {
      setQueueInstancesForTesting({
        analyzeQueue: null,
      });
    }
  });

  // ── TEST 25: Worker A (old attempt) cannot overwrite Worker B (newer attempt) state, heartbeat, or scores ──
  test('25. Worker A (old attempt) cannot overwrite Worker B (newer attempt) state, heartbeat, or scores', async () => {
    const analysis = await Analysis.create({
      user: testUser1._id,
      resumeFilename: 'worker_isolation_1.pdf',
      resumeOriginalName: 'WorkerIso1.pdf',
      jobTitle: 'TestLifecycle - Worker Attempt Isolation',
      jobDescription: 'Backend Engineer with Node.js and MongoDB.',
      status: 'pending',
    });

    const tempPdfA = createTempPdf();
    const tempPdfB = createTempPdf();

    // 1. Worker A starts with token_A
    let resolveWorkerA;
    const workerAPromise = new Promise((resolve) => {
      resolveWorkerA = resolve;
    });

    axios.post.mockImplementationOnce(async () => {
      // Simulate Worker A in-flight while reconciler marks failed and Worker B starts
      await workerAPromise;
      return {
        data: {
          status: 'completed',
          score: 65, // Stale/old score from Worker A
          match_level: 'Moderate Match',
          scoring_breakdown: { hard_skills: 60, soft_skills: 70 },
          mandatory_warnings: [],
        },
      };
    });

    // Start Worker A asynchronously
    const runWorkerA = processAnalysisJob({
      analysisId: analysis._id.toString(),
      resumePath: tempPdfA,
      resumeOriginalName: 'WorkerIso1.pdf',
      jobDescription: analysis.jobDescription,
      attemptToken: 'token_attempt_A',
    }, 1, 3);

    // Give Worker A a cycle to claim attemptToken = 'token_attempt_A'
    await new Promise((r) => setTimeout(r, 30));

    const claimedA = await Analysis.findById(analysis._id);
    expect(claimedA.attemptToken).toBe('token_attempt_A');
    expect(claimedA.status).toBe('processing');

    // 2. Reconciler marks the analysis failed due to stale heartbeat
    await Analysis.updateOne(
      { _id: analysis._id },
      {
        $set: {
          status: 'failed',
          errorMessage: 'Analysis timed out or was interrupted by a server restart. Please submit your resume again.',
        },
      }
    );

    // 3. Worker B (Attempt 2) begins a new processing attempt
    axios.post.mockResolvedValueOnce({
      data: {
        status: 'completed',
        score: 95, // Superior/newer score from Worker B
        match_level: 'Strong Match',
        scoring_breakdown: { hard_skills: 95, soft_skills: 95 },
        mandatory_warnings: [],
      },
    });

    const workerBResult = await processAnalysisJob({
      analysisId: analysis._id.toString(),
      resumePath: tempPdfB,
      resumeOriginalName: 'WorkerIso1.pdf',
      jobDescription: analysis.jobDescription,
      attemptToken: 'token_attempt_B',
    }, 2, 3);

    expect(workerBResult.success).toBe(true);

    const afterWorkerB = await Analysis.findById(analysis._id);
    expect(afterWorkerB.status).toBe('completed');
    expect(afterWorkerB.score).toBe(95);
    expect(afterWorkerB.attemptToken).toBe('token_attempt_B');

    // 4. Worker A returns late with its stale result
    resolveWorkerA();
    const workerAResult = await runWorkerA;

    // Worker A must NOT succeed in overwriting Worker B
    expect(workerAResult.alreadyCompleted).toBe(true);

    // Database state remains Worker B's state: score 95, token_attempt_B, completed
    const finalDoc = await Analysis.findById(analysis._id);
    expect(finalDoc.status).toBe('completed');
    expect(finalDoc.score).toBe(95);
    expect(finalDoc.matchLevel).toBe('Strong Match');
    expect(finalDoc.attemptToken).toBe('token_attempt_B');
  });

  // ── TEST 26: Worker A fails late after Worker B has started processing ──
  test('26. Worker A fails late after Worker B has started processing without corrupting Worker B', async () => {
    const analysis = await Analysis.create({
      user: testUser1._id,
      resumeFilename: 'worker_isolation_fail.pdf',
      resumeOriginalName: 'WorkerIsoFail.pdf',
      jobTitle: 'TestLifecycle - Worker Fail Late',
      jobDescription: 'Staff Engineer role.',
      status: 'pending',
    });

    const tempPdfA = createTempPdf();
    const tempPdfB = createTempPdf();

    let rejectWorkerA;
    const workerAPromise = new Promise((_, reject) => {
      rejectWorkerA = reject;
    });

    // Worker A will encounter an unrecoverable error late
    axios.post.mockImplementationOnce(async () => {
      await workerAPromise;
    });

    // Start Worker A
    const runWorkerA = processAnalysisJob({
      analysisId: analysis._id.toString(),
      resumePath: tempPdfA,
      resumeOriginalName: 'WorkerIsoFail.pdf',
      jobDescription: analysis.jobDescription,
      attemptToken: 'token_fail_A',
    }, 1, 3);

    await new Promise((r) => setTimeout(r, 30));

    // Worker B claims the job while Worker A is still hanging
    const workerBClaim = await Analysis.findOneAndUpdate(
      { _id: analysis._id },
      {
        $set: {
          status: 'processing',
          attemptToken: 'token_worker_B',
          heartbeatAt: new Date(),
        },
      },
      { new: true }
    );
    expect(workerBClaim.attemptToken).toBe('token_worker_B');

    // Now Worker A fails with an unrecoverable 400 Bad Request error
    const clientErr = new Error('Request failed with status code 400');
    clientErr.response = { status: 400, data: { error: 'Invalid resume data from old attempt' } };
    rejectWorkerA(clientErr);

    let caughtA;
    try {
      await runWorkerA;
    } catch (err) {
      caughtA = err;
    }
    expect(caughtA).toBeDefined();

    // Verify Worker B's active processing state was NOT marked failed by Worker A's failure
    const afterAFailed = await Analysis.findById(analysis._id);
    expect(afterAFailed.status).toBe('processing');
    expect(afterAFailed.attemptToken).toBe('token_worker_B');
    expect(afterAFailed.errorMessage).toBeNull();
  });

  // ── TEST 27: Worker A heartbeat pulse cannot update Worker B active heartbeat ──
  test('27. Worker A heartbeat pulse cannot update Worker B active heartbeat', async () => {
    const analysis = await Analysis.create({
      user: testUser1._id,
      resumeFilename: 'worker_isolation_hb.pdf',
      resumeOriginalName: 'WorkerIsoHB.pdf',
      jobTitle: 'TestLifecycle - Worker Heartbeat Isolation',
      jobDescription: 'DevOps Engineer.',
      status: 'processing',
      attemptToken: 'token_worker_B',
      heartbeatAt: new Date('2026-01-01T00:00:00Z'),
    });

    // Simulate Worker A attempting to pulse heartbeat with stale token_worker_A
    const hbRes = await Analysis.updateOne(
      { _id: analysis._id, status: 'processing', attemptToken: 'token_worker_A' },
      { $set: { heartbeatAt: new Date() } }
    );

    // Stale token must match 0 documents
    expect(hbRes.matchedCount).toBe(0);

    // Heartbeat remains Worker B's original timestamp
    const fresh = await Analysis.findById(analysis._id);
    expect(fresh.heartbeatAt.toISOString()).toBe('2026-01-01T00:00:00.000Z');
  });

  // ── TEST 28: Worker A completes late while Worker B is actively processing ──
  test('28. Worker A completes late while Worker B is actively processing; Worker A is discarded as superseded', async () => {
    const analysis = await Analysis.create({
      user: testUser1._id,
      resumeFilename: 'worker_isolation_superseded.pdf',
      resumeOriginalName: 'WorkerIsoSuper.pdf',
      jobTitle: 'TestLifecycle - Worker Superseded',
      jobDescription: 'Data Scientist role.',
      status: 'pending',
    });

    const tempPdfA = createTempPdf();
    const tempPdfB = createTempPdf();

    let resolveWorkerA;
    const workerAPromise = new Promise((resolve) => {
      resolveWorkerA = resolve;
    });

    axios.post.mockImplementationOnce(async () => {
      await workerAPromise;
      return {
        data: {
          status: 'completed',
          score: 50,
          match_level: 'Low Match',
        },
      };
    });

    const runWorkerA = processAnalysisJob({
      analysisId: analysis._id.toString(),
      resumePath: tempPdfA,
      resumeOriginalName: 'WorkerIsoSuper.pdf',
      jobDescription: analysis.jobDescription,
      attemptToken: 'token_superseded_A',
    }, 1, 3);

    await new Promise((r) => setTimeout(r, 30));

    // Worker B starts and actively takes ownership (status remains processing)
    await Analysis.updateOne(
      { _id: analysis._id },
      {
        $set: {
          status: 'processing',
          attemptToken: 'token_active_B',
          heartbeatAt: new Date(),
        },
      }
    );

    // Worker A finishes late
    resolveWorkerA();
    const resultA = await runWorkerA;

    // Worker A must return superseded: true, success: false
    expect(resultA.superseded).toBe(true);
    expect(resultA.success).toBe(false);

    // Document remains in processing with Worker B's token; NOT completed with Worker A's score 50!
    const fresh = await Analysis.findById(analysis._id);
    expect(fresh.status).toBe('processing');
    expect(fresh.attemptToken).toBe('token_active_B');
    expect(fresh.score).toBe(0);

    // PDF for Worker B MUST still exist on disk (Worker A did NOT delete it)
    expect(fs.existsSync(tempPdfB)).toBe(true);
  });
});

