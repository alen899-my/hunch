const jwt = require('jsonwebtoken');

const EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error('JWT_SECRET must be set and at least 16 characters long');
  }
  return secret;
};

// Sign a JWT with pinned HS256 algorithm
const signToken = (payload) =>
  jwt.sign(payload, getJwtSecret(), { algorithm: 'HS256', expiresIn: EXPIRES_IN });

// Verify and decode strictly with HS256 — throws if invalid
const verifyToken = (token) =>
  jwt.verify(token, getJwtSecret(), { algorithms: ['HS256'] });

module.exports = { signToken, verifyToken };
