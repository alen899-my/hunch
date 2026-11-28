const { OAuth2Client } = require('google-auth-library');
const { hashPassword, comparePassword } = require('../../utils/hash');
const { signToken } = require('../../utils/jwt');
const {
  attachMediaSignature,
  isSafeExternalUrl,
} = require('../../middlewares/security.middleware');
const repo = require('./auth.repository');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// ── Helpers ──────────────────────────────────────────────────
const sanitizeUser = (user) => {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    avatar: attachMediaSignature(user.avatar),
    provider: user.provider,
  };
};

const buildTokenResponse = (user) => ({
  token: signToken({
    id: user.id,
    email: user.email,
    tv: user.token_version ?? 0,
  }),
  user: sanitizeUser(user),
});

const normalizeEmail = (email) =>
  typeof email === 'string' && email.trim() ? email.trim().toLowerCase() : null;

// ── Register (email or phone + password) ─────────────────────
const register = async ({ name, email, phone, password }) => {
  const cleanEmail = normalizeEmail(email);
  const cleanPhone = typeof phone === 'string' && phone.trim() ? phone.trim() : null;
  const cleanName = String(name || '').trim();

  if (cleanEmail) {
    const existing = await repo.findByEmail(cleanEmail);
    if (existing) throw { status: 409, message: 'Email already registered' };
  }
  if (cleanPhone) {
    const existing = await repo.findByPhone(cleanPhone);
    if (existing) throw { status: 409, message: 'Phone already registered' };
  }

  const hashed = await hashPassword(password);
  const user = await repo.createUser({
    name: cleanName,
    email: cleanEmail,
    phone: cleanPhone,
    password: hashed,
    provider: 'local',
  });
  return buildTokenResponse(user);
};

// ── Login (email or phone + password) ────────────────────────
const login = async ({ email, phone, password }) => {
  const cleanEmail = normalizeEmail(email);
  const cleanPhone = typeof phone === 'string' && phone.trim() ? phone.trim() : null;

  const user = cleanEmail
    ? await repo.findByEmail(cleanEmail)
    : await repo.findByPhone(cleanPhone);

  if (!user || !user.password) throw { status: 401, message: 'Invalid credentials' };

  const valid = await comparePassword(password, user.password);
  if (!valid) throw { status: 401, message: 'Invalid credentials' };

  return buildTokenResponse(user);
};

// ── Google Sign-In (idToken from Expo Google Auth) ───────────
const googleAuth = async ({ idToken }) => {
  if (!process.env.GOOGLE_CLIENT_ID) {
    throw { status: 503, message: 'Google authentication is not configured' };
  }

  const ticket = await googleClient.verifyIdToken({
    idToken,
    audience: process.env.GOOGLE_CLIENT_ID,
  });
  const payload = ticket.getPayload();
  const { sub: googleId, email, email_verified: emailVerified, name, picture } = payload || {};

  if (!googleId) throw { status: 401, message: 'Invalid Google credential' };

  const cleanEmail = normalizeEmail(email);
  const safePicture = picture && isSafeExternalUrl(picture) ? picture : null;

  let user = await repo.findByGoogleId(googleId);
  if (!user) {
    if (cleanEmail && !emailVerified) {
      throw { status: 401, message: 'Verified Google email is required' };
    }
    user = cleanEmail ? await repo.findByEmail(cleanEmail) : null;
    if (user) {
      user = await repo.updateUser(user.id, {
        google_id: googleId,
        avatar: user.avatar || safePicture,
        provider: 'google',
      });
    } else {
      user = await repo.createUser({
        name: name?.trim() || 'User',
        email: cleanEmail,
        avatar: safePicture,
        googleId,
        provider: 'google',
      });
    }
  }

  return buildTokenResponse(user);
};

// ── Get current user (never exposes password/google_id) ──────
const getMe = async (userId) => {
  const user = await repo.findPublicById(userId);
  if (!user) throw { status: 404, message: 'User not found' };
  return sanitizeUser(user);
};

// ── Update current user ──────────────────────────────────────
const updateMe = async (userId, { name, phone, avatar }) => {
  const fields = {};
  if (typeof name === 'string' && name.trim().length > 0) {
    fields.name = name.trim();
  }
  if (phone !== undefined) {
    const cleanPhone = typeof phone === 'string' ? phone.trim() : '';
    if (!cleanPhone) {
      const current = await repo.findPublicById(userId);
      if (!current?.email) {
        throw { status: 400, message: 'Phone number cannot be removed when no email is linked' };
      }
      fields.phone = null;
    } else {
      const digits = cleanPhone.replace(/\D/g, '');
      if (digits.length < 7 || digits.length > 15) {
        throw { status: 400, message: 'Please enter a valid phone number' };
      }
      const existing = await repo.findByPhone(cleanPhone);
      if (existing && existing.id !== userId) {
        throw { status: 409, message: 'Phone number is already in use' };
      }
      fields.phone = cleanPhone;
    }
  }
  if (avatar !== undefined) {
    if (avatar === null || avatar === '') {
      fields.avatar = null;
    } else if (isSafeExternalUrl(avatar)) {
      const cleanUrl = avatar.trim().split('?')[0];
      if (cleanUrl.includes('/api/upload/raw/') && !cleanUrl.includes(`/uploads/${userId}/`)) {
        throw { status: 403, message: 'Forbidden avatar resource' };
      }
      fields.avatar = cleanUrl;
    } else {
      throw { status: 400, message: 'Invalid avatar URL' };
    }
  }
  if (Object.keys(fields).length === 0) {
    return getMe(userId);
  }
  const updated = await repo.updateUser(userId, fields);
  return sanitizeUser(updated);
};

// ── Change password & revoke existing sessions via token_version ──
const changePassword = async (userId, { oldPassword, newPassword }) => {
  if (typeof newPassword !== 'string' || newPassword.length < 6 || newPassword.length > 128) {
    throw { status: 400, message: 'New password must be 6-128 characters' };
  }

  const user = await repo.findById(userId);
  if (!user) throw { status: 404, message: 'User not found' };

  if (user.password) {
    if (!oldPassword || typeof oldPassword !== 'string') {
      throw { status: 400, message: 'Current password is required' };
    }
    const valid = await comparePassword(oldPassword, user.password);
    if (!valid) {
      throw { status: 401, message: 'Current password is incorrect' };
    }
    if (oldPassword === newPassword) {
      throw { status: 400, message: 'New password must be different from your old password' };
    }
  }

  const hashed = await hashPassword(newPassword);
  const updatedUser = await repo.updatePasswordAndRotateTokens(userId, hashed);
  return {
    updated: true,
    token: signToken({
      id: updatedUser.id,
      email: updatedUser.email,
      tv: updatedUser.token_version ?? 0,
    }),
  };
};

module.exports = { register, login, googleAuth, getMe, updateMe, changePassword };
