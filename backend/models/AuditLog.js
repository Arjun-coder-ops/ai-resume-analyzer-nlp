const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    institution: { type: mongoose.Schema.Types.ObjectId, ref: 'Institution', default: null },
    action: { type: String, required: true, maxlength: 120 },
    resourceType: { type: String, required: true, maxlength: 80 },
    resourceId: { type: String, required: true, maxlength: 80 },
    // Metadata is intentionally operational only. Never store resume text,
    // cookies, credentials, or student-contact information here.
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

auditLogSchema.index({ institution: 1, createdAt: -1 });
auditLogSchema.index({ actor: 1, createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
