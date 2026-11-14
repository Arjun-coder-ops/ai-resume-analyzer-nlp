const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const IORedis = require('ioredis');

const isProduction = process.env.NODE_ENV === 'production';
const redisUrl = process.env.REDIS_URL?.trim();
let rateLimitConnection = null;

if (redisUrl) {
  rateLimitConnection = new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
    lazyConnect: true,
    connectTimeout: 10_000,
  });
  rateLimitConnection.on('error', (error) => {
    console.error(`[Rate Limit Redis Error] ${error.message}`);
  });
}

const createStore = (prefix) => {
  if (!rateLimitConnection) return undefined;
  return new RedisStore({
    prefix,
    sendCommand: (...args) => rateLimitConnection.call(...args),
  });
};

const createLimiter = ({ prefix, windowMs, limit, keyGenerator }) => rateLimit({
  windowMs,
  limit,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  store: createStore(prefix),
  keyGenerator,
  message: { success: false, message: 'Too many requests. Please try again later.' },
});

const apiLimiter = createLimiter({
  prefix: 'rl:api:',
  windowMs: 15 * 60 * 1000,
  limit: 300,
});

const loginLimiter = createLimiter({
  prefix: 'rl:login:',
  windowMs: 15 * 60 * 1000,
  limit: 10,
});

const registrationLimiter = createLimiter({
  prefix: 'rl:register:',
  windowMs: 60 * 60 * 1000,
  limit: 5,
});

const analysisLimiter = createLimiter({
  prefix: 'rl:analysis:',
  windowMs: 60 * 60 * 1000,
  limit: 10,
  keyGenerator: (req) => req.user?._id ? `user:${req.user._id}` : ipKeyGenerator(req.ip),
});

const ensureRateLimitReady = async () => {
  if (isProduction && !rateLimitConnection) {
    throw new Error('REDIS_URL is required for distributed production rate limiting.');
  }

  if (isProduction) {
    await rateLimitConnection.connect();
    await rateLimitConnection.ping();
  }
};

module.exports = {
  apiLimiter,
  loginLimiter,
  registrationLimiter,
  analysisLimiter,
  ensureRateLimitReady,
};
