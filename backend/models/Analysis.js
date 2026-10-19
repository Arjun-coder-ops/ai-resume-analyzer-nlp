// models/Analysis.js - Mongoose schema for analysis results

const mongoose = require('mongoose');

const analysisSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    resumeFilename: {
      type: String,
      required: true,
    },
    resumeOriginalName: {
      type: String,
      required: true,
    },
    jobTitle: {
      type: String,
      trim: true,
      default: 'Untitled Position',
    },
    jobDescription: {
      type: String,
      required: [true, 'Job description is required'],
    },
    // NLP results stored here
    score: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    matchLevel: {
      type: String,
      default: 'Good Match',
    },
    scoringBreakdown: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    matchedSkills: {
      type: [String],
      default: [],
    },
    missingSkills: {
      type: [String],
      default: [],
    },
    extractedSkills: {
      type: [String],
      default: [],
    },
    suggestions: {
      type: [String],
      default: [],
    },
    recommendations: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    evaluationNotes: {
      type: [String],
      default: [],
    },
    // Candidate Details
    candidateInfo: {
      name: { type: String, default: '' },
      email: { type: String, default: '' },
      phone: { type: String, default: '' },
      location: { type: String, default: '' },
      linkedin: { type: String, default: '' },
      github: { type: String, default: '' },
      portfolio: { type: String, default: '' },
    },
    // Full Section Details (no truncation)
    summary: {
      type: String,
      default: '',
    },
    experience: {
      type: mongoose.Schema.Types.Mixed, // String or array of structured role objects
      default: [],
    },
    education: {
      type: mongoose.Schema.Types.Mixed, // String or array of structured education objects
      default: [],
    },
    projects: {
      type: mongoose.Schema.Types.Mixed, // Array of strings or array of structured project objects
      default: [],
    },
    certifications: {
      type: [String],
      default: [],
    },
    languages: {
      type: [String],
      default: [],
    },
    achievements: {
      type: [String],
      default: [],
    },
    // Track processing status
    status: {
      type: String,
      enum: ['pending', 'queued', 'processing', 'completed', 'failed'],
      default: 'processing',
    },
    errorMessage: {
      type: String,
      default: null,
    },
    idempotencyKey: {
      type: String,
      default: null,
    },
    heartbeatAt: {
      type: Date,
      default: null,
    },
    attemptToken: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes
analysisSchema.index({ user: 1, createdAt: -1 });
analysisSchema.index({ status: 1, heartbeatAt: 1 });
analysisSchema.index(
  { user: 1, idempotencyKey: 1 },
  {
    unique: true,
    partialFilterExpression: {
      idempotencyKey: { $type: 'string', $gt: '' },
    },
  }
);

const Analysis = mongoose.model('Analysis', analysisSchema);

/**
 * Validates that an index definition matches the required unique partial specification
 * for (user, idempotencyKey).
 */
const isCorrectUniquePartialIndex = (idx) => {
  if (!idx) return false;
  const isUnique = idx.unique === true;
  const hasKeys =
    idx.key &&
    idx.key.user === 1 &&
    idx.key.idempotencyKey === 1 &&
    Object.keys(idx.key).length === 2;
  const hasPartial =
    idx.partialFilterExpression &&
    idx.partialFilterExpression.idempotencyKey &&
    idx.partialFilterExpression.idempotencyKey.$type === 'string' &&
    idx.partialFilterExpression.idempotencyKey.$gt === '';
  return Boolean(isUnique && hasKeys && hasPartial);
};

/**
 * Migration & startup helper: safely synchronizes Analysis unique partial index in MongoDB.
 * 1. Checks if the target unique partial compound index already exists with correct specification.
 * 2. Only drops specifically identified obsolete indexes (idempotencyKey_1 or invalid user_1_idempotencyKey_1).
 * 3. Pre-checks existing data for duplicate non-empty idempotency keys before enforcing uniqueness.
 * 4. Uses targeted createIndex without calling Model.syncIndexes() to avoid dropping unrelated indexes.
 * 5. Handles concurrent startup races safely, verifying fresh inspection before continuing.
 * 6. Explicitly verifies index constraint exists and surfaces unexpected errors to halt unsafe startup.
 */
const syncAnalysisIndexes = async () => {
  const indexes = await Analysis.collection.indexes();

  // 1. Check if the target unique partial compound index already exists with correct specification
  const targetIndex = indexes.find((idx) => idx.name === 'user_1_idempotencyKey_1');
  if (isCorrectUniquePartialIndex(targetIndex)) {
    return;
  }

  // 2. Drop specifically identified legacy single-field index if present
  const legacySingle = indexes.find((idx) => idx.name === 'idempotencyKey_1');
  if (legacySingle) {
    try {
      console.log('[DB] Dropping redundant single-field idempotencyKey_1 index...');
      await Analysis.collection.dropIndex('idempotencyKey_1');
    } catch (dropErr) {
      if (dropErr.code !== 27 && !dropErr.message?.includes('index not found')) {
        throw dropErr;
      }
    }
  }

  // 3. Pre-check existing data for duplicate non-empty idempotency keys before enforcing uniqueness
  const duplicates = await Analysis.aggregate([
    {
      $match: {
        idempotencyKey: { $type: 'string', $gt: '' },
      },
    },
    {
      $group: {
        _id: { user: '$user', idempotencyKey: '$idempotencyKey' },
        count: { $sum: 1 },
      },
    },
    {
      $match: {
        count: { $gt: 1 },
      },
    },
    { $limit: 1 },
  ]);

  if (duplicates.length > 0) {
    const dup = duplicates[0];
    const errMsg = `[DB Migration Error] Cannot create unique index user_1_idempotencyKey_1: found duplicate records for user ${dup._id.user} with idempotencyKey "${dup._id.idempotencyKey}" (${dup.count} occurrences). Manual data deduplication is required before enforcing unique index.`;
    console.error(errMsg);
    throw new Error(errMsg);
  }

  // 4. Drop invalid or outdated target index if it exists but does not match required definition
  if (targetIndex && !isCorrectUniquePartialIndex(targetIndex)) {
    try {
      console.log('[DB] Dropping invalid or outdated user_1_idempotencyKey_1 index...');
      await Analysis.collection.dropIndex('user_1_idempotencyKey_1');
    } catch (dropErr) {
      if (dropErr.code !== 27 && !dropErr.message?.includes('index not found')) {
        throw dropErr;
      }
    }
  }

  // 5. Create targeted unique partial compound index without dropping unrelated production indexes
  try {
    await Analysis.collection.createIndex(
      { user: 1, idempotencyKey: 1 },
      {
        name: 'user_1_idempotencyKey_1',
        unique: true,
        partialFilterExpression: {
          idempotencyKey: { $type: 'string', $gt: '' },
        },
        background: true,
      }
    );
  } catch (createErr) {
    // If a race occurred with a concurrent instance building the index, inspect collection freshly
    const freshIndexes = await Analysis.collection.indexes();
    const freshTarget = freshIndexes.find((idx) => idx.name === 'user_1_idempotencyKey_1');
    if (isCorrectUniquePartialIndex(freshTarget)) {
      console.log('[DB] Analysis unique partial index was established concurrently by another instance.');
      return;
    }
    // If fresh inspection does not confirm the correct index exists, rethrow to fail startup
    throw createErr;
  }

  // 6. Explicitly verify the required unique index was successfully established
  const finalIndexes = await Analysis.collection.indexes();
  const finalTarget = finalIndexes.find((idx) => idx.name === 'user_1_idempotencyKey_1');
  if (!isCorrectUniquePartialIndex(finalTarget)) {
    throw new Error('[DB Migration Error] Failed to verify unique partial index user_1_idempotencyKey_1 after migration.');
  }

  console.log('[DB] Analysis unique partial index user_1_idempotencyKey_1 synchronized successfully.');
};

module.exports = Analysis;
module.exports.syncAnalysisIndexes = syncAnalysisIndexes;
module.exports.isCorrectUniquePartialIndex = isCorrectUniquePartialIndex;

