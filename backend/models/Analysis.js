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
    extractedSkills: {
      type: [String],
      default: [],
    },
    suggestions: {
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
  },
  {
    timestamps: true,
  }
);

// Index for fast user-based queries
analysisSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('Analysis', analysisSchema);
