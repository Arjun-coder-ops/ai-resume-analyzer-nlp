const PLACEHOLDER_VALUES = new Set([
  'change-me',
  'your_jwt_secret_key_min_32_chars',
  'local-development-jwt-secret-change-before-deploy',
  'local-development-internal-token-change-before-deploy',
]);

const isPlaceholder = (value) => !value || PLACEHOLDER_VALUES.has(value.trim());

const isHttpsUrl = (value) => {
  try {
    return new URL(value).protocol === 'https:';
  } catch (error) {
    return false;
  }
};

/**
 * Validates only the API process requirements. Worker-only containers do not
 * need browser session configuration, which keeps the process roles separate.
 */
const validateApiRuntimeConfig = (env = process.env) => {
  if (env.NODE_ENV !== 'production') return [];

  const errors = [];
  const required = ['MONGO_URI', 'REDIS_URL', 'JWT_SECRET', 'INTERNAL_NLP_TOKEN', 'CLIENT_URL', 'APP_URL'];
  required.forEach((key) => {
    if (isPlaceholder(env[key])) errors.push(`${key} must be configured with a non-placeholder value in production.`);
  });

  if (env.JWT_SECRET && env.JWT_SECRET.trim().length < 32) {
    errors.push('JWT_SECRET must be at least 32 characters in production.');
  }
  if (env.INTERNAL_NLP_TOKEN && env.INTERNAL_NLP_TOKEN.trim().length < 32) {
    errors.push('INTERNAL_NLP_TOKEN must be at least 32 characters in production.');
  }
  if (env.CLIENT_URL && !isHttpsUrl(env.CLIENT_URL)) {
    errors.push('CLIENT_URL must use HTTPS in production.');
  }
  if (env.APP_URL && !isHttpsUrl(env.APP_URL)) {
    errors.push('APP_URL must use HTTPS in production.');
  }
  if ((env.DOCUMENT_STORAGE_DRIVER || 'local').toLowerCase() === 'local') {
    errors.push('DOCUMENT_STORAGE_DRIVER=local is not permitted for multi-instance production deployments.');
  }
  if ((env.DOCUMENT_STORAGE_DRIVER || '').toLowerCase() === 's3') {
    ['DOCUMENT_STORAGE_BUCKET', 'AWS_REGION', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY'].forEach((key) => {
      if (isPlaceholder(env[key])) errors.push(`${key} must be configured for S3 document storage.`);
    });
  }

  return errors;
};

const assertApiRuntimeConfig = (env = process.env) => {
  const errors = validateApiRuntimeConfig(env);
  if (errors.length > 0) {
    throw new Error(`Invalid production configuration: ${errors.join(' ')}`);
  }
};

module.exports = { validateApiRuntimeConfig, assertApiRuntimeConfig };
