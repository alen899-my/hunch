const { verifyToken } = require('../utils/jwt');
const { unauthorized } = require('../utils/response');
const authRepo = require('../features/auth/auth.repository');

// Strict JWT protection backed by active database user & token_version check
const protect = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return unauthorized(res, 'Authentication required');
  }

  const rawToken = header.slice(7).trim();
  if (!rawToken || rawToken.length > 2048) {
    return unauthorized(res, 'Invalid authentication token');
  }

  try {
    const decoded = verifyToken(rawToken);
    if (!decoded?.id) {
      return unauthorized(res, 'Invalid or expired token');
    }

    const user = await authRepo.findAuthStateById(decoded.id);
    if (!user) {
      return unauthorized(res, 'Account no longer exists');
    }

    // Revoke older tokens immediately after password changes
    if (typeof decoded.tv === 'number' && decoded.tv !== (user.token_version ?? 0)) {
      return unauthorized(res, 'Session invalidated, please sign in again');
    }

    req.user = {
      id: user.id,
      email: user.email,
      tokenVersion: user.token_version ?? 0,
    };
    return next();
  } catch {
    return unauthorized(res, 'Invalid or expired token');
  }
};

module.exports = { protect };
