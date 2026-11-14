// controllers/authController.js - Register & Login logic

const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { validationResult } = require('express-validator');
const User = require('../models/User');

// ── Helper: generate JWT token ──────────────────────────────
const generateToken = (user) => {
  return jwt.sign({ id: user._id, sessionVersion: user.sessionVersion || 0 }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d',
  });
};

// ── Helper: build user response (without password) ─────────
const userResponse = (user) => ({
  success: true,
  user: {
    id: user._id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt,
  },
});

const getCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  maxAge: parseInt(process.env.SESSION_COOKIE_MAX_AGE_MS || '', 10) || 7 * 24 * 60 * 60 * 1000,
  path: '/',
});

const setSessionCookies = (res, user) => {
  res.cookie('resumeiq_session', generateToken(user), getCookieOptions());
  res.cookie('resumeiq_csrf', crypto.randomBytes(32).toString('hex'), {
    ...getCookieOptions(),
    httpOnly: false,
  });
};

// ──────────────────────────────────────────────────────────────
// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Public
// ──────────────────────────────────────────────────────────────
const register = async (req, res) => {
  // Validate request body
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const { name, email, password, confirmPassword } = req.body;

  if (password !== confirmPassword) {
    return res.status(400).json({
      success: false,
      message: 'Passwords do not match.',
    });
  }

  try {
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email already exists.',
      });
    }

    // Create new user (password hashed via pre-save hook)
    const user = await User.create({ name, email, password });

    setSessionCookies(res, user);
    res.status(201).json(userResponse(user));
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ success: false, message: 'Server error during registration.' });
  }
};

// ──────────────────────────────────────────────────────────────
// @route   POST /api/auth/login
// @desc    Login user and return JWT
// @access  Public
// ──────────────────────────────────────────────────────────────
const login = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const { email, password } = req.body;

  try {
    // Find user and explicitly select password (excluded by default)
    // sessionVersion is normally excluded, but it must be included in a newly
    // issued session token so logout can revoke all earlier sessions.
    const user = await User.findOne({ email }).select('+password +sessionVersion');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    // Compare provided password with stored hash
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    setSessionCookies(res, user);
    res.json(userResponse(user));
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Server error during login.' });
  }
};

// ──────────────────────────────────────────────────────────────
// @route   GET /api/auth/me
// @desc    Get current logged-in user profile
// @access  Private
// ──────────────────────────────────────────────────────────────
const getMe = async (req, res) => {
  res.json({
    success: true,
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      createdAt: req.user.createdAt,
    },
  });
};

const logout = async (req, res, next) => {
  try {
    await User.updateOne({ _id: req.user._id }, { $inc: { sessionVersion: 1 } });
    const options = getCookieOptions();
    res.clearCookie('resumeiq_session', options);
    res.clearCookie('resumeiq_csrf', { ...options, httpOnly: false });
    res.json({ success: true, message: 'Signed out successfully.' });
  } catch (error) {
    next(error);
  }
};

module.exports = { register, login, getMe, logout };
