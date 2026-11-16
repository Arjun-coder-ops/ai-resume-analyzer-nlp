const { validationResult } = require('express-validator');
const mongoose = require('mongoose');
const Institution = require('../models/Institution');
const InstitutionMembership = require('../models/InstitutionMembership');
const AuditLog = require('../models/AuditLog');

const isObjectId = (value) => mongoose.Types.ObjectId.isValid(value);
const emailDomain = (email) => String(email || '').trim().toLowerCase().split('@')[1] || '';

const writeAudit = async ({ actor, institution, action, resourceType, resourceId, metadata = {} }) => {
  try {
    await AuditLog.create({ actor, institution, action, resourceType, resourceId: String(resourceId), metadata });
  } catch (error) {
    // Audit failure must not expose internals. It is still visible to operators.
    console.error(`[Audit] ${action} could not be recorded:`, error.message);
  }
};

const sendValidationError = (req, res) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) return false;
  res.status(400).json({ success: false, errors: errors.array() });
  return true;
};

const requirePlatformAdmin = (req, res, next) => {
  if (req.user?.platformRole !== 'platform_admin') {
    return res.status(403).json({ success: false, message: 'Platform administrator access is required.' });
  }
  return next();
};

const loadVerifiedPlacementAdmin = async (req, res, next) => {
  const institutionId = req.params.institutionId;
  if (!isObjectId(institutionId)) {
    return res.status(400).json({ success: false, message: 'Invalid institution identifier.' });
  }
  try {
    const membership = await InstitutionMembership.findOne({
      institution: institutionId,
      user: req.user._id,
      status: 'verified',
      role: 'placement_admin',
    });

    if (!membership) {
      return res.status(403).json({ success: false, message: 'Verified placement-administrator access is required for this institution.' });
    }

    req.institutionMembership = membership;
    return next();
  } catch (error) {
    return next(error);
  }
};

const listInstitutions = async (_req, res, next) => {
  try {
    const institutions = await Institution.find({ status: 'active' })
      .select('name slug')
      .sort({ name: 1 })
      .limit(200)
      .lean();
    return res.json({ success: true, data: institutions });
  } catch (error) {
    return next(error);
  }
};

const createInstitution = async (req, res, next) => {
  if (sendValidationError(req, res)) return;
  try {
    const institution = await Institution.create({
      name: req.body.name,
      slug: req.body.slug,
      verifiedDomains: req.body.verifiedDomains,
    });
    await writeAudit({
      actor: req.user._id,
      institution: institution._id,
      action: 'institution.created',
      resourceType: 'institution',
      resourceId: institution._id,
      metadata: { slug: institution.slug },
    });
    return res.status(201).json({ success: true, data: institution });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ success: false, message: 'An institution with that slug already exists.' });
    return next(error);
  }
};

const requestMembership = async (req, res, next) => {
  const { institutionId } = req.params;
  if (!isObjectId(institutionId)) return res.status(400).json({ success: false, message: 'Invalid institution identifier.' });

  try {
    const institution = await Institution.findOne({ _id: institutionId, status: 'active' });
    if (!institution) return res.status(404).json({ success: false, message: 'Institution not found.' });

    const domain = emailDomain(req.user.email);
    if (!institution.verifiedDomains.includes(domain)) {
      return res.status(403).json({ success: false, message: 'Use a verified institutional email address to request membership.' });
    }

    const membership = await InstitutionMembership.findOneAndUpdate(
      { institution: institution._id, user: req.user._id },
      {
        $setOnInsert: {
          requestedEmail: req.user.email,
          role: 'student',
          status: 'pending',
          verificationMethod: 'institutional_domain',
        },
      },
      { new: true, upsert: true, runValidators: true }
    );

    if (membership.status === 'pending') {
      await writeAudit({
        actor: req.user._id,
        institution: institution._id,
        action: 'membership.requested',
        resourceType: 'institution_membership',
        resourceId: membership._id,
        metadata: { verificationMethod: membership.verificationMethod },
      });
    }

    return res.status(membership.status === 'verified' ? 200 : 202).json({
      success: true,
      data: { id: membership._id, institution: institution._id, role: membership.role, status: membership.status },
    });
  } catch (error) {
    return next(error);
  }
};

const getMyMemberships = async (req, res, next) => {
  try {
    const memberships = await InstitutionMembership.find({ user: req.user._id })
      .populate('institution', 'name slug status')
      .select('institution role status verificationMethod verifiedAt createdAt')
      .sort({ createdAt: -1 })
      .lean();
    return res.json({ success: true, data: memberships });
  } catch (error) {
    return next(error);
  }
};

const listInstitutionMemberships = async (req, res, next) => {
  try {
    const memberships = await InstitutionMembership.find({ institution: req.params.institutionId })
      .populate('user', 'name email createdAt')
      .select('user role status verificationMethod verifiedAt createdAt')
      .sort({ createdAt: -1 })
      .limit(500)
      .lean();
    return res.json({ success: true, data: memberships });
  } catch (error) {
    return next(error);
  }
};

const verifyStudentMembership = async (req, res, next) => {
  const { institutionId, membershipId } = req.params;
  if (!isObjectId(membershipId)) return res.status(400).json({ success: false, message: 'Invalid membership identifier.' });

  try {
    const membership = await InstitutionMembership.findOne({ _id: membershipId, institution: institutionId });
    if (!membership) return res.status(404).json({ success: false, message: 'Membership not found.' });
    if (membership.status === 'suspended') return res.status(409).json({ success: false, message: 'Suspended memberships cannot be verified.' });

    membership.status = 'verified';
    membership.verifiedAt = new Date();
    membership.verifiedBy = req.user._id;
    if (membership.verificationMethod === 'institutional_domain') membership.verificationMethod = 'administrator_approval';
    await membership.save();

    await writeAudit({
      actor: req.user._id,
      institution: institutionId,
      action: 'membership.verified',
      resourceType: 'institution_membership',
      resourceId: membership._id,
      metadata: { role: membership.role },
    });
    return res.json({ success: true, data: { id: membership._id, role: membership.role, status: membership.status, verifiedAt: membership.verifiedAt } });
  } catch (error) {
    return next(error);
  }
};

const setMembershipRole = async (req, res, next) => {
  if (sendValidationError(req, res)) return;
  const { institutionId, membershipId } = req.params;
  if (!isObjectId(institutionId) || !isObjectId(membershipId)) return res.status(400).json({ success: false, message: 'Invalid institution or membership identifier.' });

  try {
    const membership = await InstitutionMembership.findOne({ _id: membershipId, institution: institutionId });
    if (!membership) return res.status(404).json({ success: false, message: 'Membership not found.' });
    if (membership.status !== 'verified') return res.status(409).json({ success: false, message: 'Only verified memberships can receive a role.' });

    membership.role = req.body.role;
    await membership.save();
    await writeAudit({
      actor: req.user._id,
      institution: institutionId,
      action: 'membership.role_updated',
      resourceType: 'institution_membership',
      resourceId: membership._id,
      metadata: { role: membership.role },
    });
    return res.json({ success: true, data: { id: membership._id, role: membership.role, status: membership.status } });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  listInstitutions,
  createInstitution,
  requestMembership,
  getMyMemberships,
  listInstitutionMemberships,
  verifyStudentMembership,
  setMembershipRole,
  requirePlatformAdmin,
  loadVerifiedPlacementAdmin,
};
