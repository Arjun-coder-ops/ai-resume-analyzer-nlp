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
    matchedSkills: {
      type: [String],
      default: [],
    },
    missingSkills: {
      type: [String],
      default: [],
    },
    suggestions: {
      type: [String],
      default: [],
    },
    // Track processing status
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending',
    },
    errorMessage: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Index for fast user-based queries
analysisSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('Analysis', analysisSchema);
