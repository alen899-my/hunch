const { verifyToken } = require('../utils/jwt');
const { unauthorized } = require('../utils/response');

const GUEST_USER_ID = '00000000-0000-0000-0000-000000000000';

// Attach decoded user to req.user — if no token provided, fallback to guest user so saving always succeeds!
const optionalOrGuestProtect = (req, res, next) => {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    try {
      req.user = verifyToken(header.split(' ')[1]);
      return next();
    } catch {
      // Invalid/expired token falls back to guest user
    }
  }

  req.user = { id: GUEST_USER_ID, email: 'guest@hunch.local' };
  next();
};

// Strict protect for user-specific operations like profile /me
const protect = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return unauthorized(res, 'No token provided');

  try {
    req.user = verifyToken(header.split(' ')[1]);
    next();
  } catch {
    unauthorized(res, 'Invalid or expired token');
  }
};

module.exports = { protect, optionalOrGuestProtect, GUEST_USER_ID };
