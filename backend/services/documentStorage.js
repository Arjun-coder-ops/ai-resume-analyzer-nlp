const fs = require('fs');
const path = require('path');
const { S3Client, PutObjectCommand, HeadObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');

class DocumentStorageError extends Error {
  constructor(message, code = 'DOCUMENT_STORAGE_ERROR') {
    super(message);
    this.name = 'DocumentStorageError';
    this.code = code;
  }
}

/**
 * Local development storage adapter.
 *
 * Analyses persist an opaque document key (`resumeFilename`), never an
 * absolute path. Keeping path resolution here makes the API, worker, and
 * future object-storage adapters share the same ownership-safe contract.
 */
class LocalDocumentStorage {
  constructor({ rootDir = process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads') } = {}) {
    this.rootDir = path.resolve(rootDir);
    this.stagingDir = this.rootDir;
    this.isRemote = false;
  }

  ensureReady() {
    fs.mkdirSync(this.rootDir, { recursive: true });
  }

  resolveKey(key) {
    if (typeof key !== 'string' || !key.trim()) {
      throw new DocumentStorageError('A document key is required.', 'INVALID_DOCUMENT_KEY');
    }

    const safeKey = path.basename(key);
    if (safeKey !== key || safeKey === '.' || safeKey === path.sep) {
      throw new DocumentStorageError('Invalid document key.', 'INVALID_DOCUMENT_KEY');
    }

    const resolved = path.resolve(this.rootDir, safeKey);
    if (!resolved.startsWith(`${this.rootDir}${path.sep}`)) {
      throw new DocumentStorageError('Document key escapes storage root.', 'INVALID_DOCUMENT_KEY');
    }
    return resolved;
  }

  has(key) {
    try {
      return fs.existsSync(this.resolveKey(key));
    } catch (error) {
      return false;
    }
  }

  createReadStream(key) {
    return fs.createReadStream(this.resolveKey(key));
  }

  remove(key) {
    let documentPath;
    try {
      documentPath = this.resolveKey(key);
    } catch (error) {
      if (error instanceof DocumentStorageError) return false;
      throw error;
    }

    try {
      fs.unlinkSync(documentPath);
      return true;
    } catch (error) {
      if (error.code === 'ENOENT') return false;
      throw error;
    }
  }

  async persistUpload(key, sourcePath) {
    const destination = this.resolveKey(key);
    if (path.resolve(sourcePath) !== destination) {
      fs.copyFileSync(sourcePath, destination);
    }
  }
}

class S3DocumentStorage {
  constructor({
    bucket = process.env.DOCUMENT_STORAGE_BUCKET,
    region = process.env.AWS_REGION,
    endpoint = process.env.DOCUMENT_STORAGE_ENDPOINT,
    accessKeyId = process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY,
    stagingDir = process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads'),
  } = {}) {
    if (!bucket || !region || !accessKeyId || !secretAccessKey) {
      throw new DocumentStorageError('S3 document storage requires bucket, region, and credentials.', 'INVALID_STORAGE_CONFIG');
    }
    this.bucket = bucket;
    this.stagingDir = path.resolve(stagingDir);
    this.isRemote = true;
    this.client = new S3Client({
      region,
      endpoint: endpoint || undefined,
      forcePathStyle: Boolean(endpoint),
      credentials: { accessKeyId, secretAccessKey },
    });
  }

  ensureReady() { fs.mkdirSync(this.stagingDir, { recursive: true }); }

  validateKey(key) {
    if (typeof key !== 'string' || !key.trim() || path.basename(key) !== key) {
      throw new DocumentStorageError('Invalid document key.', 'INVALID_DOCUMENT_KEY');
    }
    return key;
  }

  async persistUpload(key, sourcePath) {
    const safeKey = this.validateKey(key);
    await this.client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: safeKey,
      Body: fs.createReadStream(sourcePath),
      ContentType: 'application/pdf',
      ServerSideEncryption: 'AES256',
    }));
  }

  async has(key) {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: this.validateKey(key) }));
      return true;
    } catch (error) {
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) return false;
      throw error;
    }
  }

  async createReadStream(key) {
    const response = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: this.validateKey(key) }));
    if (!response.Body || typeof response.Body.pipe !== 'function') {
      throw new DocumentStorageError('Stored document response did not include a readable body.', 'DOCUMENT_READ_FAILED');
    }
    return response.Body;
  }

  async remove(key) {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: this.validateKey(key) }));
    return true;
  }
}

const storageDriver = (process.env.DOCUMENT_STORAGE_DRIVER || 'local').toLowerCase();
const documentStorage = storageDriver === 's3'
  ? new S3DocumentStorage()
  : storageDriver === 'local'
    ? new LocalDocumentStorage()
    : (() => { throw new Error(`Unsupported DOCUMENT_STORAGE_DRIVER "${storageDriver}".`); })();
documentStorage.ensureReady();

module.exports = {
  documentStorage,
  LocalDocumentStorage,
  S3DocumentStorage,
  DocumentStorageError,
};
