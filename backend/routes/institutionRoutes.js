const express = require('express');
const { body } = require('express-validator');
const { protect } = require('../middleware/authMiddleware');
const { requireCsrf } = require('../middleware/csrfMiddleware');
const {
  listInstitutions,
  createInstitution,
  requestMembership,
  getMyMemberships,
  listInstitutionMemberships,
  verifyStudentMembership,
  setMembershipRole,
  requirePlatformAdmin,
  loadVerifiedPlacementAdmin,
} = require('../controllers/institutionController');

const router = express.Router();

const institutionValidation = [
  body('name').trim().isLength({ min: 2, max: 120 }).withMessage('Institution name must be between 2 and 120 characters.'),
  body('slug').trim().matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).withMessage('Slug must use lowercase letters, numbers, and hyphens.'),
  body('verifiedDomains').isArray({ min: 1, max: 20 }).withMessage('At least one verified institutional domain is required.'),
  body('verifiedDomains.*').trim().matches(/^[a-z0-9.-]+\.[a-z]{2,}$/i).withMessage('Each verified domain must be valid.'),
];

router.get('/', listInstitutions);
router.get('/me/memberships', protect, getMyMemberships);
router.post('/', protect, requireCsrf, requirePlatformAdmin, institutionValidation, createInstitution);
router.post('/:institutionId/memberships/request', protect, requireCsrf, requestMembership);
router.get('/:institutionId/memberships', protect, loadVerifiedPlacementAdmin, listInstitutionMemberships);
router.patch('/:institutionId/memberships/:membershipId/verify', protect, requireCsrf, loadVerifiedPlacementAdmin, verifyStudentMembership);
router.patch(
  '/:institutionId/memberships/:membershipId/role',
  protect,
  requireCsrf,
  requirePlatformAdmin,
  body('role').isIn(['student', 'placement_admin']).withMessage('Role is invalid.'),
  setMembershipRole
);

module.exports = router;
