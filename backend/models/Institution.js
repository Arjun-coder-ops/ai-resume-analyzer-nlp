const mongoose = require('mongoose');

const normalizeDomain = (value) => String(value || '').trim().toLowerCase().replace(/^@/, '');

const institutionSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must use lowercase letters, numbers, and hyphens.'],
    },
    // Only platform administrators can configure these domains. A matching
    // address permits a membership request, never automatic verification.
    verifiedDomains: {
      type: [String],
      required: true,
      validate: {
        validator: (domains) => Array.isArray(domains) && domains.length > 0 && domains.every((domain) => /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain)),
        message: 'At least one valid institutional domain is required.',
      },
    },
    status: {
      type: String,
      enum: ['active', 'suspended'],
      default: 'active',
    },
  },
  { timestamps: true }
);

institutionSchema.pre('validate', function normalizeInstitution(next) {
  if (Array.isArray(this.verifiedDomains)) {
    this.verifiedDomains = [...new Set(this.verifiedDomains.map(normalizeDomain).filter(Boolean))];
  }
  next();
});

institutionSchema.index({ status: 1, name: 1 });

module.exports = mongoose.model('Institution', institutionSchema);
