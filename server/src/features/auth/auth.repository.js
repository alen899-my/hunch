const { query, queryOne } = require('../../db/pool');

// ── Finders ─────────────────────────────────────────────────
const findByEmail = (email) => queryOne('SELECT * FROM users WHERE email = $1', [email]);
const findByPhone = (phone) => queryOne('SELECT * FROM users WHERE phone = $1', [phone]);
const findByGoogleId = (googleId) => queryOne('SELECT * FROM users WHERE google_id = $1', [googleId]);
const findById = (id) => queryOne('SELECT * FROM users WHERE id = $1', [id]);

// ── Create ───────────────────────────────────────────────────
const createUser = ({ name, email, phone, password, googleId, avatar, provider = 'local' }) =>
  queryOne(
    `INSERT INTO users (name, email, phone, password, google_id, avatar, provider)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, name, email, phone, avatar, provider, created_at`,
    [name, email ?? null, phone ?? null, password ?? null, googleId ?? null, avatar ?? null, provider]
  );

// ── Update ───────────────────────────────────────────────────
const updateUser = (id, fields) => {
  const keys = Object.keys(fields);
  const values = Object.values(fields);
  const set = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');
  return queryOne(
    `UPDATE users SET ${set}, updated_at = NOW() WHERE id = $1 RETURNING id, name, email, phone, avatar, provider`,
    [id, ...values]
  );
};

module.exports = { findByEmail, findByPhone, findByGoogleId, findById, createUser, updateUser };
