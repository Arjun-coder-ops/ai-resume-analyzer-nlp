// tests/health.test.js - Integration tests for the API health and error handling
process.env.NODE_ENV = 'test';
const request = require('supertest');
const app = require('../server');
const mongoose = require('mongoose');

describe('API Engineering & Reliability Tests', () => {
  // Close DB connection after tests if open
  afterAll(async () => {
    if (mongoose.connection && mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  });

  describe('Health Check Endpoint', () => {
    test('GET /api/health should return 200 OK', async () => {
      const res = await request(app).get('/api/health');
      expect(res.statusCode).toBe(200);
      expect(res.body.status).toBe('OK');
      expect(res.body).toHaveProperty('timestamp');
    });
  });

  describe('Structured Error Handling (Middleware)', () => {
    test('Should return 404 with structured JSON for non-existent routes', async () => {
      const res = await request(app).get('/api/non-existent-route');
      expect(res.statusCode).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Route Not Found/);
    });
  });

  describe('Auth Integration (Mock)', () => {
    test('GET /api/history without token should return 401 Unauthorized', async () => {
      const res = await request(app).get('/api/history');
      // The authMiddleware should catch this
      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });
});
