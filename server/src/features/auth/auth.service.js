const { OAuth2Client } = require('google-auth-library');
const { hashPassword, comparePassword } = require('../../utils/hash');
const { signToken } = require('../../utils/jwt');
const repo = require('./auth.repository');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// ── Helpers ──────────────────────────────────────────────────
const buildTokenResponse = (user) => ({
  token: signToken({ id: user.id, email: user.email }),
  user: {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    avatar: user.avatar,
    provider: user.provider,
  },
});

// ── Register (email or phone + password) ─────────────────────
const register = async ({ name, email, phone, password }) => {
  if (email) {
    const existing = await repo.findByEmail(email);
    if (existing) throw { status: 409, message: 'Email already registered' };
  }
  if (phone) {
    const existing = await repo.findByPhone(phone);
    if (existing) throw { status: 409, message: 'Phone already registered' };
  }

  const hashed = await hashPassword(password);
  const user = await repo.createUser({ name, email, phone, password: hashed, provider: 'local' });
  return buildTokenResponse(user);
};

// ── Login (email or phone + password) ────────────────────────
const login = async ({ email, phone, password }) => {
  const user = email
    ? await repo.findByEmail(email)
    : await repo.findByPhone(phone);

  if (!user || !user.password) throw { status: 401, message: 'Invalid credentials' };

  const valid = await comparePassword(password, user.password);
  if (!valid) throw { status: 401, message: 'Invalid credentials' };

  return buildTokenResponse(user);
};

// ── Google Sign-In (idToken from Expo Google Auth) ───────────
const googleAuth = async ({ idToken }) => {
  // Verify token with Google
  const ticket = await googleClient.verifyIdToken({
    idToken,
    audience: process.env.GOOGLE_CLIENT_ID,
  });
  const { sub: googleId, email, name, picture } = ticket.getPayload();

  // Find or create user
  let user = await repo.findByGoogleId(googleId);
  if (!user) {
    // If email exists link accounts, else create fresh
    user = email ? await repo.findByEmail(email) : null;
    if (user) {
      user = await repo.updateUser(user.id, { google_id: googleId, avatar: picture, provider: 'google' });
    } else {
      user = await repo.createUser({ name, email, avatar: picture, googleId, provider: 'google' });
    }
  }

  return buildTokenResponse(user);
};

// ── Get current user ─────────────────────────────────────────
const getMe = (userId) => repo.findById(userId);

module.exports = { register, login, googleAuth, getMe };
