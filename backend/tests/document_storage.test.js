const fs = require('fs');
const os = require('os');
const path = require('path');
const { LocalDocumentStorage, S3DocumentStorage, DocumentStorageError } = require('../services/documentStorage');

describe('LocalDocumentStorage', () => {
  let rootDir;
  let storage;

  beforeEach(() => {
    rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'resumeiq-storage-'));
    storage = new LocalDocumentStorage({ rootDir });
    storage.ensureReady();
  });

  afterEach(() => {
    fs.rmSync(rootDir, { recursive: true, force: true });
  });

  test('streams and removes a document using its opaque key', async () => {
    const key = 'user-123_1700000000000.pdf';
    fs.writeFileSync(path.join(rootDir, key), '%PDF-1.4\n');

    expect(storage.has(key)).toBe(true);
    await expect(new Promise((resolve, reject) => {
      let data = '';
      const stream = storage.createReadStream(key);
      stream.on('data', (chunk) => { data += chunk.toString('utf8'); });
      stream.on('end', () => resolve(data));
      stream.on('error', reject);
    })).resolves.toBe('%PDF-1.4\n');

    expect(storage.remove(key)).toBe(true);
    expect(storage.has(key)).toBe(false);
    expect(storage.remove(key)).toBe(false);
  });

  test('rejects path traversal and absolute document keys', () => {
    expect(() => storage.resolveKey('../outside.pdf')).toThrow(DocumentStorageError);
    expect(() => storage.resolveKey(path.resolve(rootDir, 'outside.pdf'))).toThrow(DocumentStorageError);
    expect(storage.has('../outside.pdf')).toBe(false);
  });
});

describe('S3DocumentStorage', () => {
  const storageOptions = {
    bucket: 'resumeiq-private',
    region: 'us-east-1',
    accessKeyId: 'test-access-key',
    secretAccessKey: 'test-secret-key',
    stagingDir: path.join(os.tmpdir(), 'resumeiq-s3-staging'),
  };

  test('uses private server-side encrypted puts and opaque keys', async () => {
    const storage = new S3DocumentStorage(storageOptions);
    const sourcePath = path.join(os.tmpdir(), `resumeiq-upload-${Date.now()}.pdf`);
    fs.writeFileSync(sourcePath, '%PDF-1.4\n');
    const send = jest.fn((command) => new Promise((resolve, reject) => {
      command.input.Body.on('error', reject);
      command.input.Body.on('end', () => resolve({}));
      command.input.Body.resume();
    }));
    storage.client = { send };

    await storage.persistUpload('opaque.pdf', sourcePath);
    expect(send).toHaveBeenCalledTimes(1);
    const commandInput = send.mock.calls[0][0].input;
    expect(commandInput).toMatchObject({
      Bucket: 'resumeiq-private', Key: 'opaque.pdf', ContentType: 'application/pdf', ServerSideEncryption: 'AES256',
    });
    expect(() => storage.validateKey('../outside.pdf')).toThrow(DocumentStorageError);
    fs.unlinkSync(sourcePath);
  });

  test('treats only a provider 404 as an absent document', async () => {
    const storage = new S3DocumentStorage(storageOptions);
    storage.client = { send: jest.fn().mockRejectedValue({ name: 'NotFound', $metadata: { httpStatusCode: 404 } }) };
    await expect(storage.has('missing.pdf')).resolves.toBe(false);
  });
});
