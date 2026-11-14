const { validateApiRuntimeConfig } = require('../config/runtime');

const productionConfig = {
  NODE_ENV: 'production',
  MONGO_URI: 'mongodb://database.example/resumeiq',
  REDIS_URL: 'rediss://cache.example:6379',
  JWT_SECRET: 'a-secure-production-jwt-secret-with-more-than-32-chars',
  INTERNAL_NLP_TOKEN: 'a-secure-internal-nlp-token-with-more-than-32-chars',
  CLIENT_URL: 'https://app.example.com',
  APP_URL: 'https://api.example.com',
  DOCUMENT_STORAGE_DRIVER: 's3',
  DOCUMENT_STORAGE_BUCKET: 'resumeiq-private',
  AWS_REGION: 'us-east-1',
  AWS_ACCESS_KEY_ID: 'test-access-key',
  AWS_SECRET_ACCESS_KEY: 'test-secret-key-that-is-not-used-in-production',
};

describe('API runtime configuration', () => {
  test('allows complete production configuration with a durable storage driver', () => {
    expect(validateApiRuntimeConfig(productionConfig)).toEqual([]);
  });

  test('rejects placeholders, insecure URLs, weak secrets, and local production storage', () => {
    const errors = validateApiRuntimeConfig({
      ...productionConfig,
      JWT_SECRET: 'short',
      INTERNAL_NLP_TOKEN: 'local-development-internal-token-change-before-deploy',
      CLIENT_URL: 'http://app.example.com',
      APP_URL: 'http://api.example.com',
      DOCUMENT_STORAGE_DRIVER: 'local',
    });

    expect(errors).toEqual(expect.arrayContaining([
      expect.stringContaining('JWT_SECRET must be at least 32'),
      expect.stringContaining('INTERNAL_NLP_TOKEN must be configured'),
      expect.stringContaining('CLIENT_URL must use HTTPS'),
      expect.stringContaining('APP_URL must use HTTPS'),
      expect.stringContaining('DOCUMENT_STORAGE_DRIVER=local'),
    ]));
  });

  test('does not impose production-only requirements on development and test processes', () => {
    expect(validateApiRuntimeConfig({ NODE_ENV: 'test' })).toEqual([]);
    expect(validateApiRuntimeConfig({ NODE_ENV: 'development' })).toEqual([]);
  });
});
