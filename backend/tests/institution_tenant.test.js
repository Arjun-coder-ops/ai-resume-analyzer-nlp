process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'tenant-test-secret';

const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const app = require('../server');
const User = require('../models/User');
const Institution = require('../models/Institution');
const InstitutionMembership = require('../models/InstitutionMembership');
const AuditLog = require('../models/AuditLog');

jest.setTimeout(20000);

const tokenFor = (user) => jwt.sign(
  { id: user._id, sessionVersion: user.sessionVersion || 0 },
  process.env.JWT_SECRET,
  { expiresIn: '1h' }
);

describe('institution tenant authorization', () => {
  const createdUserIds = [];
  const createdInstitutionIds = [];
  let institutionA;
  let institutionB;
  let studentA;
  let externalStudent;
  let adminA;
  let adminB;

  const createUser = async (name, email) => {
    const user = await User.create({ name, email, password: 'safe-test-password' });
    createdUserIds.push(user._id);
    return user;
  };

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/resume_analyzer_test');
    }

    institutionA = await Institution.create({
      name: 'Test University A',
      slug: `test-university-a-${Date.now()}`,
      verifiedDomains: ['students.test-a.edu'],
    });
    institutionB = await Institution.create({
      name: 'Test University B',
      slug: `test-university-b-${Date.now()}`,
      verifiedDomains: ['students.test-b.edu'],
    });
    createdInstitutionIds.push(institutionA._id, institutionB._id);

    studentA = await createUser('Student A', `student-a-${Date.now()}@students.test-a.edu`);
    externalStudent = await createUser('External Student', `external-${Date.now()}@example.test`);
    adminA = await createUser('Placement Admin A', `admin-a-${Date.now()}@students.test-a.edu`);
    adminB = await createUser('Placement Admin B', `admin-b-${Date.now()}@students.test-b.edu`);

    await InstitutionMembership.create([
      { user: adminA._id, institution: institutionA._id, role: 'placement_admin', status: 'verified', requestedEmail: adminA.email, verifiedAt: new Date() },
      { user: adminB._id, institution: institutionB._id, role: 'placement_admin', status: 'verified', requestedEmail: adminB.email, verifiedAt: new Date() },
    ]);
  });

  afterAll(async () => {
    await AuditLog.deleteMany({ institution: { $in: createdInstitutionIds } });
    await InstitutionMembership.deleteMany({ institution: { $in: createdInstitutionIds } });
    await Institution.deleteMany({ _id: { $in: createdInstitutionIds } });
    await User.deleteMany({ _id: { $in: createdUserIds } });
    if (mongoose.connection.readyState !== 0) await mongoose.connection.close();
  });

  test('a matching institutional domain creates a pending student request, never an admin role', async () => {
    const response = await request(app)
      .post(`/api/institutions/${institutionA._id}/memberships/request`)
      .set('Authorization', `Bearer ${tokenFor(studentA)}`);

    expect(response.statusCode).toBe(202);
    expect(response.body.data.status).toBe('pending');
    expect(response.body.data.role).toBe('student');
  });

  test('an email outside the verified domain cannot request membership', async () => {
    const response = await request(app)
      .post(`/api/institutions/${institutionA._id}/memberships/request`)
      .set('Authorization', `Bearer ${tokenFor(externalStudent)}`);

    expect(response.statusCode).toBe(403);
    expect(response.body.message).toMatch(/verified institutional email/i);
  });

  test('a verified placement administrator can verify only a membership in their own institution', async () => {
    const studentMembership = await InstitutionMembership.findOne({ user: studentA._id, institution: institutionA._id });
    const allowed = await request(app)
      .patch(`/api/institutions/${institutionA._id}/memberships/${studentMembership._id}/verify`)
      .set('Authorization', `Bearer ${tokenFor(adminA)}`);

    expect(allowed.statusCode).toBe(200);
    expect(allowed.body.data.status).toBe('verified');

    const denied = await request(app)
      .patch(`/api/institutions/${institutionA._id}/memberships/${studentMembership._id}/verify`)
      .set('Authorization', `Bearer ${tokenFor(adminB)}`);

    expect(denied.statusCode).toBe(403);
  });

  test('a placement administrator cannot list another institution membership roster', async () => {
    const ownTenant = await request(app)
      .get(`/api/institutions/${institutionA._id}/memberships`)
      .set('Authorization', `Bearer ${tokenFor(adminA)}`);
    expect(ownTenant.statusCode).toBe(200);
    expect(ownTenant.body.data.some((membership) => String(membership.user._id) === String(studentA._id))).toBe(true);

    const otherTenant = await request(app)
      .get(`/api/institutions/${institutionA._id}/memberships`)
      .set('Authorization', `Bearer ${tokenFor(adminB)}`);
    expect(otherTenant.statusCode).toBe(403);
  });

  test('registration ignores a user-controlled platform role', async () => {
    const email = `register-role-${Date.now()}@example.test`;
    const response = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Role Test', email, password: 'safe-test-password', confirmPassword: 'safe-test-password', platformRole: 'platform_admin' });

    expect(response.statusCode).toBe(201);
    const registered = await User.findOne({ email });
    createdUserIds.push(registered._id);
    expect(registered.platformRole).toBe('student');
  });
});
