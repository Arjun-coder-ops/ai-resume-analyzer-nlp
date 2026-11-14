// middleware/authMiddleware.js - Protect routes with JWT

const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  let token;

  // HttpOnly cookie is the primary browser session transport. Bearer support is
  // retained temporarily for existing API clients while they migrate.
  if (req.cookies?.resumeiq_session) {
    token = req.cookies.resumeiq_session;
    req.authType = 'session';
  } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
    req.authType = 'bearer';
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access denied. No token provided.',
    });
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Attach user to request (exclude password)
    req.user = await User.findById(decoded.id).select('-password +sessionVersion');

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'User not found. Token invalid.',
      });
    }

    // Documents created before sessionVersion existed do not have the field;
    // treat them as version zero until their first logout revokes them.
    const currentSessionVersion = req.user.sessionVersion || 0;
    if (decoded.sessionVersion !== undefined && decoded.sessionVersion !== currentSessionVersion) {
      return res.status(401).json({ success: false, message: 'Session has been revoked.' });
    }

    next();
  } catch (error) {
    console.error('Token verification error:', error.message);
    return res.status(401).json({
      success: false,
      message: 'Token is invalid or expired.',
    });
  }
};

module.exports = { protect };
