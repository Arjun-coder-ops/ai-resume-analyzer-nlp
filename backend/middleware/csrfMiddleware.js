const crypto = require('crypto');

const requireCsrf = (req, res, next) => {
  if (req.authType !== 'session') return next();

  const cookieToken = req.cookies?.resumeiq_csrf;
  const headerToken = req.get('x-csrf-token');
  if (!cookieToken || !headerToken) {
    return res.status(403).json({ success: false, message: 'CSRF validation failed.' });
  }

  const cookieBuffer = Buffer.from(cookieToken);
  const headerBuffer = Buffer.from(headerToken);
  if (cookieBuffer.length !== headerBuffer.length || !crypto.timingSafeEqual(cookieBuffer, headerBuffer)) {
    return res.status(403).json({ success: false, message: 'CSRF validation failed.' });
  }

  return next();
};

module.exports = { requireCsrf };
