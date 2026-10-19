// tests/api_consistency.test.js - API state consistency, ownership isolation, and idempotency tests
process.env.NODE_ENV = 'test';

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const app = require('../server');
const Analysis = require('../models/Analysis');
const { syncAnalysisIndexes, isCorrectUniquePartialIndex } = require('../models/Analysis');
const User = require('../models/User');
const UserDailyQuota = require('../models/UserDailyQuota');
const {
  getLocalDateKey,
  reserveDailyQuota,
  commitDailyQuota,
  rollbackDailyQuota,
} = require('../models/UserDailyQuota');
const analyzeQueue = require('../queue/analyzeQueue');

jest.setTimeout(25000);

describe('API State Consistency & Security Ownership Tests', () => {
  let userA, userB;
  let tokenA, tokenB;
  const createdTestFiles = [];

  const createUploadTestFile = (filename, content = '%PDF-1.4 test document content') => {
    const uploadDir = path.resolve(process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads'));
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    const fullPath = path.join(uploadDir, filename);
    fs.writeFileSync(fullPath, content);
    createdTestFiles.push(fullPath);
    return fullPath;
  };

  const createTestUser = async (namePrefix) => {
    const user = await User.create({
      name: `User ${namePrefix}`,
      email: `test_${namePrefix.toLowerCase()}_${Date.now()}_${Math.random().toString(36).substring(7)}@example.com`,
      password: 'password123',
    });
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'secret123', { expiresIn: '1h' });
    return { user, token };
  };

  beforeAll(async () => {
    process.env.INTERNAL_NLP_TOKEN = process.env.INTERNAL_NLP_TOKEN || 'test_internal_token_secret_32bytes';

    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/resume_analyzer_test');
    }

    await syncAnalysisIndexes();
    await UserDailyQuota.createIndexes();

    await Analysis.deleteMany({ jobTitle: /TestConsistency/ });
    await User.deleteMany({ email: /test_consistency/ });

    userA = await User.create({
      name: 'User A Consistency',
      email: `test_consistency_a_${Date.now()}@example.com`,
      password: 'password123',
    });

    userB = await User.create({
      name: 'User B Consistency',
      email: `test_consistency_b_${Date.now()}@example.com`,
      password: 'password123',
    });

    await UserDailyQuota.deleteMany({ user: { $in: [userA._id, userB._id] } });

    const secret = process.env.JWT_SECRET || 'secret123';
    tokenA = jwt.sign({ id: userA._id }, secret, { expiresIn: '1h' });
    tokenB = jwt.sign({ id: userB._id }, secret, { expiresIn: '1h' });
  });

  afterAll(async () => {
    for (const filePath of createdTestFiles) {
      if (fs.existsSync(filePath)) {
        try { fs.unlinkSync(filePath); } catch (e) {}
      }
    }
    if (userA && userB) {
      await UserDailyQuota.deleteMany({ user: { $in: [userA._id, userB._id] } });
    }
    await Analysis.deleteMany({ jobTitle: /TestConsistency/ });
    await User.deleteMany({ email: /test_consistency/ });
    if (mongoose.connection && mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  });

  // ── TEST 1: Ownership Isolation on GET /api/history/:id ───────────────────
  test('1. User cannot retrieve another user analysis by ID (returns 404)', async () => {
    const analysisA = await Analysis.create({
      user: userA._id,
      resumeFilename: 'resumeA.pdf',
      resumeOriginalName: 'ResumeA.pdf',
      jobTitle: 'TestConsistency - Private Role A',
      jobDescription: 'Secret role description for User A only.',
      status: 'completed',
      score: 80,
    });

    // User B attempts to access User A's analysis
    const res = await request(app)
      .get(`/api/history/${analysisA._id}`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.statusCode).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/not found/i);
  });

  // ── TEST 2: Ownership Isolation on DELETE /api/history/:id ────────────────
  test('2. User cannot delete another user analysis by ID (returns 404)', async () => {
    const analysisA = await Analysis.create({
      user: userA._id,
      resumeFilename: 'resumeA_del.pdf',
      resumeOriginalName: 'ResumeA_del.pdf',
      jobTitle: 'TestConsistency - Delete Protected',
      jobDescription: 'User A analysis to be protected from User B.',
      status: 'completed',
      score: 75,
    });

    // User B attempts to delete User A's analysis
    const res = await request(app)
      .delete(`/api/history/${analysisA._id}`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.statusCode).toBe(404);

    // Verify record still exists in DB
    const stillExists = await Analysis.findById(analysisA._id);
    expect(stillExists).not.toBeNull();
  });

  // ── TEST 3: History Listing Includes Both Completed and Failed Analyses ──
  test('3. History endpoint returns both completed and failed analyses consistently', async () => {
    await Analysis.create({
      user: userA._id,
      resumeFilename: 'userA_completed.pdf',
      resumeOriginalName: 'Completed.pdf',
      jobTitle: 'TestConsistency - Completed Item',
      jobDescription: 'Description for completed analysis.',
      status: 'completed',
      score: 90,
    });

    await Analysis.create({
      user: userA._id,
      resumeFilename: 'userA_failed.pdf',
      resumeOriginalName: 'Failed.pdf',
      jobTitle: 'TestConsistency - Failed Item',
      jobDescription: 'Description for failed analysis.',
      status: 'failed',
      errorMessage: 'NLP service parsing timeout occurred',
    });

    const res = await request(app)
      .get('/api/history')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);

    const statuses = res.body.data.map((item) => item.status);
    expect(statuses).toContain('completed');
    expect(statuses).toContain('failed');
  });

  // ── TEST 4: Idempotency Key Handling on Submission ───────────────────────
  test('4. Repeated submission with identical Idempotency-Key returns existing analysis without creating duplicate', async () => {
    const idempotencyKey = `idem_${Date.now()}`;
    const initialAnalysis = await Analysis.create({
      user: userA._id,
      resumeFilename: 'idem.pdf',
      resumeOriginalName: 'IdemResume.pdf',
      jobTitle: 'TestConsistency - Idempotent Role',
      jobDescription: 'Detailed job description with at least 50 characters to pass validation checks cleanly.',
      status: 'processing',
      idempotencyKey,
    });

    const countBefore = await Analysis.countDocuments({ user: userA._id });

    // Submit request with same idempotency key
    const res = await request(app)
      .post('/api/analyze')
      .set('Authorization', `Bearer ${tokenA}`)
      .set('idempotency-key', idempotencyKey)
      .field('jobTitle', 'TestConsistency - Idempotent Role')
      .field('jobDescription', 'Detailed job description with at least 50 characters to pass validation checks cleanly.')
      .attach('resume', Buffer.from('%PDF-1.4 dummy'), 'IdemResume.pdf');

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.analysisId.toString()).toBe(initialAnalysis._id.toString());

    // Verify count did not increase
    const countAfter = await Analysis.countDocuments({ user: userA._id });
    expect(countAfter).toBe(countBefore);
  });

  // ── TEST 5: In-Flight Duplicate Deduplication ─────────────────────────────
  test('5. In-flight identical submission within 60s returns existing record without duplicating DB entry', async () => {
    const inFlightAnalysis = await Analysis.create({
      user: userA._id,
      resumeFilename: 'inflight.pdf',
      resumeOriginalName: 'InFlightResume.pdf',
      jobTitle: 'TestConsistency - InFlight Role',
      jobDescription: 'In-flight job description with at least 50 characters for rigorous validation checking.',
      status: 'processing',
    });

    const countBefore = await Analysis.countDocuments({ user: userA._id });

    // Submit identical resume name and JD
    const res = await request(app)
      .post('/api/analyze')
      .set('Authorization', `Bearer ${tokenA}`)
      .field('jobTitle', 'TestConsistency - InFlight Role')
      .field('jobDescription', 'In-flight job description with at least 50 characters for rigorous validation checking.')
      .attach('resume', Buffer.from('%PDF-1.4 dummy'), 'InFlightResume.pdf');

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.analysisId.toString()).toBe(inFlightAnalysis._id.toString());
    expect(res.body.message).toMatch(/already in progress/i);

    const countAfter = await Analysis.countDocuments({ user: userA._id });
    expect(countAfter).toBe(countBefore);
  });

  // ── TEST 6: Public Static Access to /uploads is Blocked (404) ─────────────
  test('6. Public access to /uploads/filename is blocked and returns 404', async () => {
    const filename = `public_leak_test_${Date.now()}.pdf`;
    createUploadTestFile(filename, '%PDF-1.4 confidential candidate resume data');

    // Unauthenticated GET request to former static uploads path
    const res = await request(app).get(`/uploads/${filename}`);

    expect(res.statusCode).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/not found/i);
  });

  // ── TEST 7: Path Traversal on /uploads Returns 404 ─────────────────────────
  test('7. Path traversal attempts on /uploads are rejected with 404', async () => {
    const res1 = await request(app).get('/uploads/../server.js');
    expect(res1.statusCode).toBe(404);

    const res2 = await request(app).get('/uploads/%2e%2e%2fserver.js');
    expect(res2.statusCode).toBe(404);
  });

  // ── TEST 8: Unauthenticated Download Request Returns 401 ──────────────────
  test('8. Unauthenticated request to GET /api/history/:id/resume returns 401', async () => {
    const filename = `unauth_test_${Date.now()}.pdf`;
    createUploadTestFile(filename);

    const analysis = await Analysis.create({
      user: userA._id,
      resumeFilename: filename,
      resumeOriginalName: 'UnauthTest.pdf',
      jobTitle: 'TestConsistency - Unauth Role',
      jobDescription: 'Job description text with sufficient length for test consistency.',
      status: 'completed',
    });

    const res = await request(app).get(`/api/history/${analysis._id}/resume`);
    expect(res.statusCode).toBe(401);
    expect(res.body.success).toBe(false);
  });

  // ── TEST 9: Ownership Isolation on Resume Download ────────────────────────
  test('9. User B cannot download User A resume (returns 404 ownership isolation)', async () => {
    const filename = `userA_private_${Date.now()}.pdf`;
    createUploadTestFile(filename, '%PDF-1.4 User A confidential data');

    const analysisA = await Analysis.create({
      user: userA._id,
      resumeFilename: filename,
      resumeOriginalName: 'UserAPrivate.pdf',
      jobTitle: 'TestConsistency - User A Private Analysis',
      jobDescription: 'Job description text with sufficient length for test consistency.',
      status: 'completed',
    });

    // User B attempts to download User A's file
    const res = await request(app)
      .get(`/api/history/${analysisA._id}/resume`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.statusCode).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/not found/i);
  });

  // ── TEST 10: Authorized Owner Can Securely Stream Uploaded Resume ─────────
  test('10. Authorized owner (User A) can securely download/stream their uploaded resume', async () => {
    const filename = `owner_ok_${Date.now()}.pdf`;
    const testContent = '%PDF-1.4 Authorized Owner PDF Stream Content';
    createUploadTestFile(filename, testContent);

    const analysisA = await Analysis.create({
      user: userA._id,
      resumeFilename: filename,
      resumeOriginalName: 'MyResume.pdf',
      jobTitle: 'TestConsistency - Owner Access',
      jobDescription: 'Job description text with sufficient length for test consistency.',
      status: 'completed',
    });

    const res = await request(app)
      .get(`/api/history/${analysisA._id}/resume`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/pdf/);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-disposition']).toMatch(/inline; filename="MyResume.pdf"/);
    expect(res.body.toString('utf8')).toBe(testContent);
  });

  // ── TEST 11: Missing/Cleaned-Up Resume File Returns Clean 404 ─────────────
  test('11. Resume download returns 404 when resume file has been unlinked/cleaned up from disk', async () => {
    const missingFilename = `cleaned_up_file_${Date.now()}.pdf`;

    const analysis = await Analysis.create({
      user: userA._id,
      resumeFilename: missingFilename,
      resumeOriginalName: 'CleanedUp.pdf',
      jobTitle: 'TestConsistency - Cleaned Up',
      jobDescription: 'Job description text with sufficient length for test consistency.',
      status: 'completed',
    });

    const res = await request(app)
      .get(`/api/history/${analysis._id}/resume`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.statusCode).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/no longer available/i);
  });

  // ── TEST 12: Directory Traversal via resumeFilename is Blocked ────────────
  test('12. Directory traversal in resumeFilename cannot access files outside the upload directory', async () => {
    const analysis = await Analysis.create({
      user: userA._id,
      resumeFilename: '../../server.js',
      resumeOriginalName: 'Hacked.pdf',
      jobTitle: 'TestConsistency - Traversal Attempt',
      jobDescription: 'Job description text with sufficient length for test consistency.',
      status: 'completed',
    });

    const res = await request(app)
      .get(`/api/history/${analysis._id}/resume`)
      .set('Authorization', `Bearer ${tokenA}`);

    // Must not stream server.js (either 404 because basename sanitized to server.js not in uploads, or 403)
    expect([403, 404]).toContain(res.statusCode);
    const bodyStr = res.body ? res.body.toString() : (res.text || '');
    expect(bodyStr).not.toContain('express');
  });

  // ── TEST 13: Webhook Accepts Valid Configured X-Internal-Token ────────────
  test('13. Webhook endpoint accepts requests with valid configured X-Internal-Token', async () => {
    const analysis = await Analysis.create({
      user: userA._id,
      resumeFilename: 'webhook_auth.pdf',
      resumeOriginalName: 'WebhookAuth.pdf',
      jobTitle: 'TestConsistency - Webhook Valid Auth',
      jobDescription: 'Job description text with sufficient length for test consistency.',
      status: 'processing',
    });

    const validToken = process.env.INTERNAL_NLP_TOKEN || 'test_internal_token_secret_32bytes';

    const res = await request(app)
      .post(`/api/analyze/webhook/${analysis._id}`)
      .set('x-internal-token', validToken)
      .send({
        status: 'completed',
        score: 89,
        match_level: 'Good Match',
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);

    const fresh = await Analysis.findById(analysis._id);
    expect(fresh.status).toBe('completed');
    expect(fresh.score).toBe(89);
  });

  // ── TEST 14: Webhook Rejects Missing X-Internal-Token (401) ───────────────
  test('14. Webhook endpoint rejects requests missing X-Internal-Token with 401 Unauthorized', async () => {
    const analysis = await Analysis.create({
      user: userA._id,
      resumeFilename: 'webhook_no_token.pdf',
      resumeOriginalName: 'NoToken.pdf',
      jobTitle: 'TestConsistency - Webhook Missing Auth',
      jobDescription: 'Job description text with sufficient length for test consistency.',
      status: 'processing',
    });

    // Request without x-internal-token header
    const res = await request(app)
      .post(`/api/analyze/webhook/${analysis._id}`)
      .send({
        status: 'completed',
        score: 99,
      });

    expect(res.statusCode).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/unauthorized/i);

    // Verify record in DB was NOT modified
    const fresh = await Analysis.findById(analysis._id);
    expect(fresh.status).toBe('processing');
    expect(fresh.score).toBe(0);
  });

  // ── TEST 15: Webhook Rejects Incorrect or Empty X-Internal-Token (401) ─────
  test('15. Webhook endpoint rejects incorrect or empty X-Internal-Token with 401', async () => {
    const analysis = await Analysis.create({
      user: userA._id,
      resumeFilename: 'webhook_bad_token.pdf',
      resumeOriginalName: 'BadToken.pdf',
      jobTitle: 'TestConsistency - Webhook Bad Auth',
      jobDescription: 'Job description text with sufficient length for test consistency.',
      status: 'processing',
    });

    // Case 1: Wrong token
    const resWrong = await request(app)
      .post(`/api/analyze/webhook/${analysis._id}`)
      .set('x-internal-token', 'completely_wrong_secret_token')
      .send({ status: 'completed', score: 99 });

    expect(resWrong.statusCode).toBe(401);
    expect(resWrong.body.success).toBe(false);

    // Case 2: Empty token
    const resEmpty = await request(app)
      .post(`/api/analyze/webhook/${analysis._id}`)
      .set('x-internal-token', '')
      .send({ status: 'completed', score: 99 });

    expect(resEmpty.statusCode).toBe(401);
    expect(resEmpty.body.success).toBe(false);

    // Verify record in DB was NOT modified
    const fresh = await Analysis.findById(analysis._id);
    expect(fresh.status).toBe('processing');
    expect(fresh.score).toBe(0);
  });

  // ── TEST 16: Webhook Fails Closed (500) When Server Secret is Missing ─────
  test('16. Webhook endpoint fails closed with 500 when server-side INTERNAL_NLP_TOKEN is unconfigured or empty', async () => {
    const analysis = await Analysis.create({
      user: userA._id,
      resumeFilename: 'webhook_server_unconfig.pdf',
      resumeOriginalName: 'ServerUnconfig.pdf',
      jobTitle: 'TestConsistency - Webhook Server Unconfigured',
      jobDescription: 'Job description text with sufficient length for test consistency.',
      status: 'processing',
    });

    const savedToken = process.env.INTERNAL_NLP_TOKEN;

    try {
      // 1. Secret completely undefined
      delete process.env.INTERNAL_NLP_TOKEN;

      const resUnset = await request(app)
        .post(`/api/analyze/webhook/${analysis._id}`)
        .set('x-internal-token', 'any_attempted_token')
        .send({ status: 'completed', score: 99 });

      expect(resUnset.statusCode).toBe(500);
      expect(resUnset.body.success).toBe(false);
      expect(resUnset.body.message).toMatch(/unconfigured/i);

      // 2. Secret set to empty string or whitespace
      process.env.INTERNAL_NLP_TOKEN = '   ';

      const resEmpty = await request(app)
        .post(`/api/analyze/webhook/${analysis._id}`)
        .set('x-internal-token', 'any_attempted_token')
        .send({ status: 'completed', score: 99 });

      expect(resEmpty.statusCode).toBe(500);
      expect(resEmpty.body.success).toBe(false);
      expect(resEmpty.body.message).toMatch(/unconfigured/i);

      // Verify DB record remained processing and was not modified
      const fresh = await Analysis.findById(analysis._id);
      expect(fresh.status).toBe('processing');
      expect(fresh.score).toBe(0);
    } finally {
      process.env.INTERNAL_NLP_TOKEN = savedToken;
    }
  });

  // ── TEST 17: Repeated sequential requests with the same idempotency key ──
  test('17. Repeated sequential requests with the same idempotency key return existing analysis', async () => {
    const { user: user17, token: token17 } = await createTestUser('SeqIdem');
    const key = `seq_idem_${Date.now()}`;
    const desc = 'Full Stack Engineer with extensive Node.js, Express, MongoDB, and React experience.';

    const res1 = await request(app)
      .post('/api/analyze')
      .set('Authorization', `Bearer ${token17}`)
      .set('idempotency-key', key)
      .field('jobTitle', 'TestConsistency - Seq Idempotency')
      .field('jobDescription', desc)
      .attach('resume', Buffer.from('%PDF-1.4 sample content'), 'SeqResume.pdf');

    expect(res1.statusCode).toBe(200);
    expect(res1.body.success).toBe(true);
    const analysisId1 = res1.body.data.analysisId;

    const res2 = await request(app)
      .post('/api/analyze')
      .set('Authorization', `Bearer ${token17}`)
      .set('idempotency-key', key)
      .field('jobTitle', 'TestConsistency - Seq Idempotency')
      .field('jobDescription', desc)
      .attach('resume', Buffer.from('%PDF-1.4 sample content'), 'SeqResume.pdf');

    expect(res2.statusCode).toBe(200);
    expect(res2.body.success).toBe(true);
    expect(res2.body.message).toMatch(/already initiated/i);
    expect(res2.body.data.analysisId.toString()).toBe(analysisId1.toString());

    // Check DB: exactly 1 analysis created with this idempotency key
    const docs = await Analysis.find({ user: user17._id, idempotencyKey: key });
    expect(docs.length).toBe(1);
  });

  // ── TEST 18: Multiple simultaneous requests from same user with same key ─
  test('18. Multiple simultaneous requests from the same user with same idempotency key create exactly 1 analysis', async () => {
    const { user: user18, token: token18 } = await createTestUser('ConcSame');
    const key = `conc_same_${Date.now()}`;
    const desc = 'Senior Cloud Architect with AWS, Kubernetes, Terraform, and system design expertise.';

    // Send 3 requests truly simultaneously via Promise.all
    const requests = [1, 2, 3].map(() =>
      request(app)
        .post('/api/analyze')
        .set('Authorization', `Bearer ${token18}`)
        .set('idempotency-key', key)
        .field('jobTitle', 'TestConsistency - Concurrent Same Key')
        .field('jobDescription', desc)
        .attach('resume', Buffer.from('%PDF-1.4 concurrent sample'), 'ConcSame.pdf')
    );

    const responses = await Promise.all(requests);

    // All should return 200
    for (const res of responses) {
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    }

    // All must return the exact same analysisId
    const firstId = responses[0].body.data.analysisId.toString();
    for (const res of responses) {
      expect(res.body.data.analysisId.toString()).toBe(firstId);
    }

    // DB must contain exactly ONE record for this key
    const count = await Analysis.countDocuments({ user: user18._id, idempotencyKey: key });
    expect(count).toBe(1);
  });

  // ── TEST 19: Simultaneous requests with different keys when only 1 slot remains ──
  test('19. Simultaneous requests with different keys when only 1 quota slot remains allow exactly 1 and reject others with 429', async () => {
    const quotaUser = await User.create({
      name: 'Quota Test User',
      email: `quota_race_${Date.now()}@example.com`,
      password: 'password123',
    });
    const quotaToken = jwt.sign({ id: quotaUser._id }, process.env.JWT_SECRET || 'secret123', { expiresIn: '1h' });

    const todayKey = getLocalDateKey();
    // Pre-set quota count to 4 (so exactly 1 of 5 slots remains)
    await UserDailyQuota.updateOne(
      { user: quotaUser._id, dateKey: todayKey },
      { $set: { count: 4 } },
      { upsert: true }
    );

    const desc = 'Machine Learning Engineer with PyTorch, NLP, Transformers, and Python experience required.';

    // Fire 3 simultaneous requests with different idempotency keys
    const reqPromises = [1, 2, 3].map((i) =>
      request(app)
        .post('/api/analyze')
        .set('Authorization', `Bearer ${quotaToken}`)
        .set('idempotency-key', `diff_key_${i}_${Date.now()}`)
        .field('jobTitle', `TestConsistency - Quota Slot Race ${i}`)
        .field('jobDescription', desc + ` Variant ${i}`)
        .attach('resume', Buffer.from('%PDF-1.4 quota slot test'), `QuotaSlot_${i}.pdf`)
    );

    const responses = await Promise.all(reqPromises);

    const successes = responses.filter((r) => r.statusCode === 200);
    const rateLimited = responses.filter((r) => r.statusCode === 429);

    expect(successes.length).toBe(1);
    expect(rateLimited.length).toBe(2);

    expect(rateLimited[0].body.success).toBe(false);
    expect(rateLimited[0].body.message).toMatch(/daily limit reached/i);
    expect(rateLimited[0].body.trialsRemaining).toBe(0);

    // Verify DB quota count is capped at 5
    const quotaDoc = await UserDailyQuota.findOne({ user: quotaUser._id, dateKey: todayKey });
    expect(quotaDoc.count).toBe(5);

    await UserDailyQuota.deleteOne({ user: quotaUser._id });
    await Analysis.deleteMany({ user: quotaUser._id });
    await User.deleteOne({ _id: quotaUser._id });
  });

  // ── TEST 20: MongoDB E11000 duplicate key error handling ──
  test('20. MongoDB E11000 duplicate key error rolls back tentative quota and returns existing analysis', async () => {
    const { user: user20, token: token20 } = await createTestUser('E11000');
    const key = `e11000_key_${Date.now()}`;
    const desc = 'DevOps Engineer with CI/CD, Docker, Kubernetes, Prometheus, and Linux experience.';

    // Insert original analysis first
    const existing = await Analysis.create({
      user: user20._id,
      resumeFilename: 'e11000_orig.pdf',
      resumeOriginalName: 'Original.pdf',
      jobTitle: 'TestConsistency - E11000 Existing',
      jobDescription: desc,
      status: 'processing',
      idempotencyKey: key,
    });

    // Spy on Analysis.create to force an E11000 duplicate key error simulation
    const mongoE11000Error = new Error('E11000 duplicate key error collection: analyses index: user_1_idempotencyKey_1');
    mongoE11000Error.code = 11000;

    jest.spyOn(Analysis, 'create').mockRejectedValueOnce(mongoE11000Error);

    try {
      const res = await request(app)
        .post('/api/analyze')
        .set('Authorization', `Bearer ${token20}`)
        .set('idempotency-key', key)
        .field('jobTitle', 'TestConsistency - E11000 Test')
        .field('jobDescription', desc)
        .attach('resume', Buffer.from('%PDF-1.4 e11000 doc'), 'E11000.pdf');

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.analysisId.toString()).toBe(existing._id.toString());
      expect(res.body.message).toMatch(/already initiated/i);
    } finally {
      Analysis.create.mockRestore();
    }
  });

  // ── TEST 21: Requests without idempotency keys do not conflict ──
  test('21. Multiple requests without idempotency keys do not conflict or collide', async () => {
    const { user: user21, token: token21 } = await createTestUser('NoKey');
    const desc = 'Backend Developer specializing in PostgreSQL, Redis, Node.js, and API architecture.';

    // Send 2 requests without any idempotency-key header
    const res1 = await request(app)
      .post('/api/analyze')
      .set('Authorization', `Bearer ${token21}`)
      .field('jobTitle', 'TestConsistency - No Key 1')
      .field('jobDescription', desc + ' Variation 1.')
      .attach('resume', Buffer.from('%PDF-1.4 no key 1'), 'NoKey1.pdf');

    const res2 = await request(app)
      .post('/api/analyze')
      .set('Authorization', `Bearer ${token21}`)
      .field('jobTitle', 'TestConsistency - No Key 2')
      .field('jobDescription', desc + ' Variation 2.')
      .attach('resume', Buffer.from('%PDF-1.4 no key 2'), 'NoKey2.pdf');

    expect(res1.statusCode).toBe(200);
    expect(res2.statusCode).toBe(200);
    expect(res1.body.data.analysisId).not.toBe(res2.body.data.analysisId);

    // Both documents have null idempotencyKey and coexist peacefully
    const doc1 = await Analysis.findById(res1.body.data.analysisId);
    const doc2 = await Analysis.findById(res2.body.data.analysisId);
    expect(doc1.idempotencyKey).toBeNull();
    expect(doc2.idempotencyKey).toBeNull();
  });

  // ── TEST 22: Queue insertion failure after analysis creation ──
  test('22. Queue insertion failure after analysis creation rolls back quota and marks analysis failed', async () => {
    const { user: user22, token: token22 } = await createTestUser('QueueFail');
    const key = `queue_fail_${Date.now()}`;
    const desc = 'Security Engineer with penetration testing, OAuth2, Cryptography, and OWASP knowledge.';

    // Record quota before
    const quotaBefore = await request(app).get('/api/analyze/quota').set('Authorization', `Bearer ${token22}`);
    const usedBefore = quotaBefore.body.data.trialsUsed;

    // Spy on enqueueAnalysis to simulate queue/Redis failure
    jest.spyOn(analyzeQueue, 'enqueueAnalysis').mockRejectedValueOnce(new Error('Redis connection refused'));

    try {
      const res = await request(app)
        .post('/api/analyze')
        .set('Authorization', `Bearer ${token22}`)
        .set('idempotency-key', key)
        .field('jobTitle', 'TestConsistency - Queue Fail')
        .field('jobDescription', desc)
        .attach('resume', Buffer.from('%PDF-1.4 queue fail test'), 'QueueFail.pdf');

      expect(res.statusCode).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/failed to initiate/i);

      // Verify quota was rolled back (did NOT consume quota)
      const quotaAfter = await request(app).get('/api/analyze/quota').set('Authorization', `Bearer ${token22}`);
      expect(quotaAfter.body.data.trialsUsed).toBe(usedBefore);

      // Verify analysis document was marked failed with proper error message
      const failedDoc = await Analysis.findOne({ user: user22._id, idempotencyKey: key });
      expect(failedDoc).not.toBeNull();
      expect(failedDoc.status).toBe('failed');
      expect(failedDoc.errorMessage).toMatch(/failed to initiate analysis job/i);
    } finally {
      analyzeQueue.enqueueAnalysis.mockRestore();
    }
  });

  // ── TEST 23: Retry after a partial submission failure ──
  test('23. Retry with same idempotency key after partial submission failure cleans up failed shell and succeeds', async () => {
    const { user: user23, token: token23 } = await createTestUser('RetryPartial');
    const key = `retry_partial_${Date.now()}`;
    const desc = 'Frontend Specialist with React, TypeScript, Tailwind CSS, and Next.js experience.';

    // Step 1: Simulate partial submission failure
    jest.spyOn(analyzeQueue, 'enqueueAnalysis').mockRejectedValueOnce(new Error('Queue timeout'));
    const resFail = await request(app)
      .post('/api/analyze')
      .set('Authorization', `Bearer ${token23}`)
      .set('idempotency-key', key)
      .field('jobTitle', 'TestConsistency - Retry Partial')
      .field('jobDescription', desc)
      .attach('resume', Buffer.from('%PDF-1.4 retry doc'), 'RetryFail.pdf');

    expect(resFail.statusCode).toBe(500);
    analyzeQueue.enqueueAnalysis.mockRestore();

    // Step 2: Client retries with the exact same idempotency key now that queue is healthy
    const resRetry = await request(app)
      .post('/api/analyze')
      .set('Authorization', `Bearer ${token23}`)
      .set('idempotency-key', key)
      .field('jobTitle', 'TestConsistency - Retry Partial')
      .field('jobDescription', desc)
      .attach('resume', Buffer.from('%PDF-1.4 retry doc'), 'RetrySuccess.pdf');

    expect(resRetry.statusCode).toBe(200);
    expect(resRetry.body.success).toBe(true);
    expect(resRetry.body.data.status).toBe('processing');

    // DB should have 1 active processing analysis (failed shell cleaned up)
    const docs = await Analysis.find({ user: user23._id, idempotencyKey: key });
    expect(docs.length).toBe(1);
    expect(docs[0].status).toBe('processing');
  });

  // ── TEST 24: A duplicate request not consuming quota twice ──
  test('24. Duplicate idempotent submission does not consume quota twice', async () => {
    const { user: user24, token: token24 } = await createTestUser('QuotaDedup');
    const key = `quota_dedup_${Date.now()}`;
    const desc = 'Database Administrator with PostgreSQL, MongoDB indexing, sharding, and backup expertise.';

    const quotaBefore = await request(app).get('/api/analyze/quota').set('Authorization', `Bearer ${token24}`);
    const usedBefore = quotaBefore.body.data.trialsUsed;

    // First submission
    const res1 = await request(app)
      .post('/api/analyze')
      .set('Authorization', `Bearer ${token24}`)
      .set('idempotency-key', key)
      .field('jobTitle', 'TestConsistency - Quota Dedup')
      .field('jobDescription', desc)
      .attach('resume', Buffer.from('%PDF-1.4 quota dedup test'), 'QuotaDedup.pdf');

    expect(res1.statusCode).toBe(200);

    const quotaAfterFirst = await request(app).get('/api/analyze/quota').set('Authorization', `Bearer ${token24}`);
    expect(quotaAfterFirst.body.data.trialsUsed).toBe(usedBefore + 1);

    // Duplicate submission with same key
    const res2 = await request(app)
      .post('/api/analyze')
      .set('Authorization', `Bearer ${token24}`)
      .set('idempotency-key', key)
      .field('jobTitle', 'TestConsistency - Quota Dedup')
      .field('jobDescription', desc)
      .attach('resume', Buffer.from('%PDF-1.4 quota dedup test'), 'QuotaDedup.pdf');

    expect(res2.statusCode).toBe(200);

    const quotaAfterSecond = await request(app).get('/api/analyze/quota').set('Authorization', `Bearer ${token24}`);
    // Quota used must NOT increase again!
    expect(quotaAfterSecond.body.data.trialsUsed).toBe(usedBefore + 1);
  });

  // ── TEST 25: Different users using the same idempotency key ──
  test('25. Different users using the same idempotency key do not collide', async () => {
    const { user: userA25, token: tokenA25 } = await createTestUser('SharedA');
    const { user: userB25, token: tokenB25 } = await createTestUser('SharedB');
    const sharedKey = `shared_client_uuid_${Date.now()}`;
    const desc = 'Site Reliability Engineer with Grafana, Datadog, incident response, and Go experience.';

    // User A submits with sharedKey
    const resA = await request(app)
      .post('/api/analyze')
      .set('Authorization', `Bearer ${tokenA25}`)
      .set('idempotency-key', sharedKey)
      .field('jobTitle', 'TestConsistency - Shared User A')
      .field('jobDescription', desc)
      .attach('resume', Buffer.from('%PDF-1.4 user A file'), 'UserA.pdf');

    expect(resA.statusCode).toBe(200);
    const idA = resA.body.data.analysisId;

    // User B submits with the exact same sharedKey
    const resB = await request(app)
      .post('/api/analyze')
      .set('Authorization', `Bearer ${tokenB25}`)
      .set('idempotency-key', sharedKey)
      .field('jobTitle', 'TestConsistency - Shared User B')
      .field('jobDescription', desc)
      .attach('resume', Buffer.from('%PDF-1.4 user B file'), 'UserB.pdf');

    expect(resB.statusCode).toBe(200);
    const idB = resB.body.data.analysisId;

    expect(idA.toString()).not.toBe(idB.toString());

    // Both documents exist in database independently
    const docA = await Analysis.findOne({ user: userA25._id, idempotencyKey: sharedKey });
    const docB = await Analysis.findOne({ user: userB25._id, idempotencyKey: sharedKey });
    expect(docA).not.toBeNull();
    expect(docB).not.toBeNull();
    expect(docA._id.toString()).toBe(idA.toString());
    expect(docB._id.toString()).toBe(idB.toString());
  });

  // ── TEST 26: Existing ownership and API-response behavior remaining intact ──
  test('26. Existing API response contracts for POST /api/analyze and GET /api/analyze/quota remain intact', async () => {
    const { token: token26 } = await createTestUser('Contracts');
    const quotaRes = await request(app).get('/api/analyze/quota').set('Authorization', `Bearer ${token26}`);
    expect(quotaRes.statusCode).toBe(200);
    expect(quotaRes.body).toHaveProperty('success', true);
    expect(quotaRes.body.data).toHaveProperty('dailyLimit', 5);
    expect(quotaRes.body.data).toHaveProperty('trialsUsed');
    expect(quotaRes.body.data).toHaveProperty('trialsRemaining');
    expect(quotaRes.body.data).toHaveProperty('resetsAt');
    expect(new Date(quotaRes.body.data.resetsAt).getTime()).not.toBeNaN();
  });

  // ── TEST 27: Check 1 - Repeated rollback attempts cannot double-refund (idempotent rollback) ──
  test('27. Quota rollback is idempotent per reservationId and cannot double-refund', async () => {
    const { user: user27 } = await createTestUser('RollbackIdempotent');
    const todayKey = getLocalDateKey();

    // 1. Reserve a slot
    const reservation = await reserveDailyQuota(user27._id);
    expect(reservation).not.toBeNull();
    expect(reservation.reservationId).toBeDefined();

    const quotaAfterReserve = await UserDailyQuota.findOne({ user: user27._id, dateKey: todayKey });
    expect(quotaAfterReserve.count).toBe(1);
    expect(quotaAfterReserve.activeReservations).toContain(reservation.reservationId);

    // 2. First rollback should succeed and decrement count to 0
    const firstRollback = await rollbackDailyQuota(user27._id, reservation.reservationId);
    expect(firstRollback).not.toBeNull();
    expect(firstRollback.count).toBe(0);
    expect(firstRollback.activeReservations).not.toContain(reservation.reservationId);

    // 3. Second rollback with the SAME reservationId must be a no-op (return null, count remains 0)
    const secondRollback = await rollbackDailyQuota(user27._id, reservation.reservationId);
    expect(secondRollback).toBeNull();

    const quotaAfterSecond = await UserDailyQuota.findOne({ user: user27._id, dateKey: todayKey });
    expect(quotaAfterSecond.count).toBe(0);

    // 4. Rollback without a reservationId must return null and never blind-decrement
    const blindRollback = await rollbackDailyQuota(user27._id, null);
    expect(blindRollback).toBeNull();
    const quotaAfterBlind = await UserDailyQuota.findOne({ user: user27._id, dateKey: todayKey });
    expect(quotaAfterBlind.count).toBe(0);

    await UserDailyQuota.deleteOne({ user: user27._id });
    await User.deleteOne({ _id: user27._id });
  });

  // ── TEST 28: Check 1 - Reservation ownership & rollback protection after commit ──
  test('28. Committed reservations cannot be rolled back, and reservations cannot be refunded across users', async () => {
    const { user: user28A } = await createTestUser('CommitA');
    const { user: user28B } = await createTestUser('CommitB');
    const todayKey = getLocalDateKey();

    const resA = await reserveDailyQuota(user28A._id);
    expect(resA).not.toBeNull();

    // User B tries to rollback User A's reservationId
    const crossRollback = await rollbackDailyQuota(user28B._id, resA.reservationId);
    expect(crossRollback).toBeNull();

    const quotaA = await UserDailyQuota.findOne({ user: user28A._id, dateKey: todayKey });
    expect(quotaA.count).toBe(1);
    expect(quotaA.activeReservations).toContain(resA.reservationId);

    // Commit User A's reservation (simulating successful enqueue)
    const commitResult = await commitDailyQuota(user28A._id, resA.reservationId);
    expect(commitResult).not.toBeNull();
    expect(commitResult.activeReservations).not.toContain(resA.reservationId);
    expect(commitResult.count).toBe(1); // count remains consumed

    // Attempting to rollback after commit must be rejected
    const postCommitRollback = await rollbackDailyQuota(user28A._id, resA.reservationId);
    expect(postCommitRollback).toBeNull();

    const finalQuotaA = await UserDailyQuota.findOne({ user: user28A._id, dateKey: todayKey });
    expect(finalQuotaA.count).toBe(1);

    await UserDailyQuota.deleteMany({ user: { $in: [user28A._id, user28B._id] } });
    await User.deleteMany({ _id: { $in: [user28A._id, user28B._id] } });
  });

  // ── TEST 29: Check 2 - In-memory queue deduplication against actively processing jobs ──
  test('29. In-memory queue deduplication rejects duplicate enqueue when job is actively in-flight', async () => {
    const testAnalysisId = new mongoose.Types.ObjectId().toString();

    // Simulate an actively processing job in analyzeQueue.activeJobs
    analyzeQueue.activeJobs.add(testAnalysisId);

    try {
      const initialQueueLength = analyzeQueue.inMemoryQueue.length;

      // Attempt to enqueue the exact same analysisId while it is in activeJobs
      const result = await analyzeQueue.enqueueAnalysis({
        analysisId: testAnalysisId,
        resumePath: '/fake/path/test.pdf',
        resumeOriginalName: 'test.pdf',
        jobDescription: 'Software Engineer with test experience and skills.',
      });

      expect(result.id).toBe(testAnalysisId);
      // It must NOT have pushed to inMemoryQueue because it was recognized as actively in-flight
      expect(analyzeQueue.inMemoryQueue.length).toBe(initialQueueLength);
      const wasAdded = analyzeQueue.inMemoryQueue.some(
        (item) => item.jobData && item.jobData.analysisId === testAnalysisId
      );
      expect(wasAdded).toBe(false);
    } finally {
      analyzeQueue.activeJobs.delete(testAnalysisId);
    }
  });

  // ── TEST 30: Check 3 - Index migration pre-checks duplicate non-empty keys and surfaces error ──
  test('30. syncAnalysisIndexes detects duplicate non-empty idempotency keys and throws migration error', async () => {
    const { user: user30 } = await createTestUser('IndexDup');
    const duplicateKey = `dup_migration_${Date.now()}`;

    // Temporarily drop the unique index to simulate legacy database state with duplicate data
    try {
      await Analysis.collection.dropIndex('user_1_idempotencyKey_1');
    } catch (e) {
      // ignore if not present
    }

    // Insert two documents for the same user with the exact same non-empty idempotencyKey
    await Analysis.collection.insertMany([
      {
        user: user30._id,
        resumeFilename: 'dup1.pdf',
        resumeOriginalName: 'dup1.pdf',
        jobTitle: 'TestConsistency - Dup 1',
        jobDescription: 'Job description 1 with duplicate idempotency key.',
        status: 'completed',
        idempotencyKey: duplicateKey,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        user: user30._id,
        resumeFilename: 'dup2.pdf',
        resumeOriginalName: 'dup2.pdf',
        jobTitle: 'TestConsistency - Dup 2',
        jobDescription: 'Job description 2 with duplicate idempotency key.',
        status: 'completed',
        idempotencyKey: duplicateKey,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    // Running syncAnalysisIndexes should detect the duplicates and throw a descriptive error
    await expect(syncAnalysisIndexes()).rejects.toThrow(
      /Cannot create unique index user_1_idempotencyKey_1: found duplicate records/
    );

    // Clean up duplicates
    await Analysis.deleteMany({ user: user30._id, idempotencyKey: duplicateKey });

    // After removing duplicates, syncAnalysisIndexes should succeed and enforce the constraint
    await expect(syncAnalysisIndexes()).resolves.toBeUndefined();

    // Verify the unique index is established and enforces uniqueness
    const indexes = await Analysis.collection.indexes();
    const createdIndex = indexes.find((idx) => idx.name === 'user_1_idempotencyKey_1');
    expect(createdIndex).toBeDefined();
    expect(createdIndex.unique).toBe(true);

    await User.deleteOne({ _id: user30._id });
  });

  // ── TEST 31: Check 1 - Quota commit failure after queue acceptance preserves quota and processing status ──
  test('31. commitDailyQuota failure after queue acceptance does not refund quota or mark analysis failed', async () => {
    const { user: user31, token: token31 } = await createTestUser('CommitFail');
    const key = `commit_fail_${Date.now()}`;
    const desc = 'Principal Infrastructure Engineer specializing in Kubernetes, AWS, Go, and high availability systems.';

    // Spy on commitDailyQuota in UserDailyQuota model to simulate persistent commit failure during request
    const quotaModule = require('../models/UserDailyQuota');
    const originalCommit = quotaModule.commitDailyQuota;
    const commitSpy = jest.spyOn(quotaModule, 'commitDailyQuota').mockRejectedValue(new Error('Transient Mongo timeout during commit'));

    try {
      const res = await request(app)
        .post('/api/analyze')
        .set('Authorization', `Bearer ${token31}`)
        .set('idempotency-key', key)
        .field('jobTitle', 'TestConsistency - Commit Failure Tolerance')
        .field('jobDescription', desc)
        .attach('resume', Buffer.from('%PDF-1.4 commit failure test file'), 'CommitFail.pdf');

      // The submission must be accepted (200) since queue acceptance succeeded
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);

      const analysisId = res.body.data.analysisId;

      // Analysis document in DB must remain in 'processing' state (NOT erroneously failed)
      const analysisDoc = await Analysis.findById(analysisId);
      expect(analysisDoc).not.toBeNull();
      expect(analysisDoc.status).toBe('processing');
      expect(analysisDoc.errorMessage).toBeNull();

      // Quota must NOT have been refunded (trialsUsed must remain 1)
      const quotaCheck = await request(app).get('/api/analyze/quota').set('Authorization', `Bearer ${token31}`);
      expect(quotaCheck.body.data.trialsUsed).toBe(1);

      // Verify that retrying commitDailyQuota manually resolves cleanly and does NOT increment quota
      const todayKey = getLocalDateKey();
      const quotaDoc = await UserDailyQuota.findOne({ user: user31._id, dateKey: todayKey });
      expect(quotaDoc.count).toBe(1);
      const pendingReservationId = quotaDoc.activeReservations[0];
      expect(pendingReservationId).toBeDefined();

      commitSpy.mockRestore();

      // Retry the commit
      const retryResult = await originalCommit(user31._id, pendingReservationId);
      expect(retryResult).not.toBeNull();
      expect(retryResult.activeReservations).not.toContain(pendingReservationId);

      // Quota count remains 1 (no double increment)
      const finalQuota = await UserDailyQuota.findOne({ user: user31._id, dateKey: todayKey });
      expect(finalQuota.count).toBe(1);
    } finally {
      if (commitSpy.mockRestore) commitSpy.mockRestore();
      await UserDailyQuota.deleteOne({ user: user31._id });
      await Analysis.deleteMany({ user: user31._id });
      await User.deleteOne({ _id: user31._id });
    }
  });

  // ── TEST 32: Check 2 - Index migration replaces incorrectly defined index of the same name ──
  test('32. syncAnalysisIndexes replaces an incorrectly defined user_1_idempotencyKey_1 index', async () => {
    // 1. Drop the valid index if present
    try {
      await Analysis.collection.dropIndex('user_1_idempotencyKey_1');
    } catch (e) {}

    // 2. Create an invalid index with the same name (e.g. unique: false and no partialFilterExpression)
    await Analysis.collection.createIndex(
      { user: 1, idempotencyKey: 1 },
      { name: 'user_1_idempotencyKey_1', unique: false }
    );

    const initialIndexes = await Analysis.collection.indexes();
    const badIndex = initialIndexes.find((idx) => idx.name === 'user_1_idempotencyKey_1');
    expect(badIndex).toBeDefined();
    expect(badIndex.unique).toBeFalsy();
    expect(isCorrectUniquePartialIndex(badIndex)).toBe(false);

    // 3. Run syncAnalysisIndexes - it should detect the invalid definition, drop it, and create the correct one
    await syncAnalysisIndexes();

    const updatedIndexes = await Analysis.collection.indexes();
    const correctedIndex = updatedIndexes.find((idx) => idx.name === 'user_1_idempotencyKey_1');
    expect(correctedIndex).toBeDefined();
    expect(correctedIndex.unique).toBe(true);
    expect(isCorrectUniquePartialIndex(correctedIndex)).toBe(true);
  });
});
