// controllers/authController.js - Register & Login logic

const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const User = require('../models/User');

// ── Helper: generate JWT token ──────────────────────────────
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d',
  });
};

// ── Helper: build user response (without password) ─────────
const userResponse = (user, token) => ({
  success: true,
  token,
  user: {
    id: user._id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt,
  },
});

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

  const { name, email, password } = req.body;

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

    // Generate token and respond
    const token = generateToken(user._id);
    res.status(201).json(userResponse(user, token));
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
    const user = await User.findOne({ email }).select('+password');
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

    const token = generateToken(user._id);
    res.json(userResponse(user, token));
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

module.exports = { register, login, getMe };
