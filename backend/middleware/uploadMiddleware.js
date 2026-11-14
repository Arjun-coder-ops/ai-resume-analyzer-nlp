// middleware/uploadMiddleware.js - Multer config for PDF uploads

const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure uploads directory exists
const uploadDir = process.env.UPLOAD_DIR || './uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// ── Storage: save to disk with unique filename ──────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Format: userId_timestamp_original.pdf
    const uniqueName = `${req.user.id}_${Date.now()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

// ── File filter: only allow PDFs ────────────────────────────
const fileFilter = (req, file, cb) => {
  const isPdfName = path.extname(file.originalname || '').toLowerCase() === '.pdf';
  if (file.mimetype === 'application/pdf' && isPdfName) {
    cb(null, true);
  } else {
    cb(new Error('Only PDF files are allowed'), false);
  }
};

const validatePdfSignature = (req, res, next) => {
  if (!req.file) return next();

  try {
    const descriptor = fs.openSync(req.file.path, 'r');
    const header = Buffer.alloc(5);
    const bytesRead = fs.readSync(descriptor, header, 0, header.length, 0);
    fs.closeSync(descriptor);

    if (bytesRead !== 5 || header.toString('ascii') !== '%PDF-') {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ success: false, message: 'The uploaded file is not a valid PDF document.' });
    }
  } catch (error) {
    try { fs.unlinkSync(req.file.path); } catch (cleanupError) { /* no-op */ }
    return res.status(400).json({ success: false, message: 'The uploaded file could not be validated.' });
  }

  return next();
};

// ── Multer instance ─────────────────────────────────────────
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024, // 10 MB default
    files: 1,
  },
});

module.exports = { upload, validatePdfSignature };
