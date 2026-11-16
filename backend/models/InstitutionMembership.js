const mongoose = require('mongoose');

const institutionMembershipSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      immutable: true,
    },
    institution: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Institution',
      required: true,
      immutable: true,
    },
    role: {
      type: String,
      enum: ['student', 'placement_admin'],
      default: 'student',
    },
    status: {
      type: String,
      enum: ['pending', 'verified', 'suspended'],
      default: 'pending',
    },
    verificationMethod: {
      type: String,
      enum: ['institutional_domain', 'invitation', 'administrator_approval'],
      default: 'institutional_domain',
    },
    requestedEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      select: false,
    },
    verifiedAt: { type: Date, default: null },
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

// The unique pair is the tenant-isolation primitive: one user has at most one
// membership record per institution and every institutional query is scoped.
institutionMembershipSchema.index({ institution: 1, user: 1 }, { unique: true });
institutionMembershipSchema.index({ user: 1, status: 1 });
institutionMembershipSchema.index({ institution: 1, status: 1, role: 1 });

module.exports = mongoose.model('InstitutionMembership', institutionMembershipSchema);
