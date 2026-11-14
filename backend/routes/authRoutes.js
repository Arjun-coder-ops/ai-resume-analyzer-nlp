// routes/authRoutes.js - Authentication routes

const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { register, login, getMe, logout } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const { requireCsrf } = require('../middleware/csrfMiddleware');
const { loginLimiter, registrationLimiter } = require('../middleware/rateLimitMiddleware');

// Validation rules
const registerValidation = [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 50 }),
  body('email').isEmail().withMessage('Please enter a valid email').normalizeEmail(),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
];

const loginValidation = [
  body('email').isEmail().withMessage('Please enter a valid email').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
];

// Routes
router.post('/register', registrationLimiter, registerValidation, register);
router.post('/login',    loginLimiter, loginValidation, login);
router.get('/me',        protect,            getMe);
router.post('/logout',   protect, requireCsrf, logout);

module.exports = router;
