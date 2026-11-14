const fs = require('fs');
const os = require('os');
const path = require('path');

describe('Recovery safety regressions', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalRedisUrl = process.env.REDIS_URL;

  afterEach(() => {
    jest.resetModules();
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
    if (originalRedisUrl === undefined) delete process.env.REDIS_URL;
    else process.env.REDIS_URL = originalRedisUrl;
  });

  test('BUG-003: production refuses to report queue readiness without Redis', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.REDIS_URL;
    let readiness;

    jest.isolateModules(() => {
      const { ensureQueueReady } = require('../queue/analyzeQueue');
      readiness = ensureQueueReady();
    });
    await expect(readiness).rejects.toThrow(/Redis\/BullMQ is required in production/);
  });

  test('BUG-010: production refuses rate-limit startup without Redis', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.REDIS_URL;
    let readiness;

    jest.isolateModules(() => {
      const { ensureRateLimitReady } = require('../middleware/rateLimitMiddleware');
      readiness = ensureRateLimitReady();
    });
    await expect(readiness).rejects.toThrow(/REDIS_URL is required/);
  });

  test('BUG-008: rejects an uploaded file whose bytes are not a PDF signature', () => {
    process.env.NODE_ENV = 'test';
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'resumeiq-upload-'));
    const invalidPath = path.join(tempDir, 'not-a-pdf.pdf');
    fs.writeFileSync(invalidPath, 'not actually a PDF');

    const { validatePdfSignature } = require('../middleware/uploadMiddleware');
    const status = jest.fn();
    const json = jest.fn();
    status.mockReturnValue({ json });
    const next = jest.fn();

    validatePdfSignature({ file: { path: invalidPath } }, { status }, next);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
    expect(next).not.toHaveBeenCalled();
    expect(fs.existsSync(invalidPath)).toBe(false);
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test('BUG-013: quota boundaries are explicit UTC dates', () => {
    const quota = require('../models/UserDailyQuota');
    const instant = new Date('2026-11-14T23:30:00-05:00');
    const { startOfDay, endOfDay } = quota.getLocalDayBounds(instant);

    expect(quota.getLocalDateKey(instant)).toBe('2026-11-15');
    expect(startOfDay.toISOString()).toBe('2026-11-15T00:00:00.000Z');
    expect(endOfDay.toISOString()).toBe('2026-11-16T00:00:00.000Z');
  });

  test('BUG-011: unexpected server errors do not expose internal messages', () => {
    const { errorMiddleware } = require('../middleware/errorMiddleware');
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const status = jest.fn();
    const json = jest.fn();
    status.mockReturnValue({ json });

    errorMiddleware(
      new Error('database password should not be exposed'),
      { method: 'GET', url: '/api/private' },
      { statusCode: 500, status },
      jest.fn(),
    );

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({
      message: 'An unexpected error occurred. Please try again later.',
    }));
    errorSpy.mockRestore();
  });

  test('BUG-009: cookie sessions require a matching CSRF header for mutations', () => {
    const { requireCsrf } = require('../middleware/csrfMiddleware');
    const status = jest.fn();
    const json = jest.fn();
    status.mockReturnValue({ json });
    const next = jest.fn();

    requireCsrf(
      {
        authType: 'session',
        cookies: { resumeiq_csrf: 'server-generated-token' },
        get: () => 'different-token',
      },
      { status },
      next,
    );

    expect(status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  test('BUG-009: matching CSRF token permits an authenticated mutation', () => {
    const { requireCsrf } = require('../middleware/csrfMiddleware');
    const next = jest.fn();
    requireCsrf(
      {
        authType: 'session',
        cookies: { resumeiq_csrf: 'server-generated-token' },
        get: () => 'server-generated-token',
      },
      {},
      next,
    );
    expect(next).toHaveBeenCalledTimes(1);
  });
});
