const { queryOne } = require('../../db/pool');

const PUBLIC_USER_COLUMNS =
  'id, name, email, phone, avatar, provider, token_version, created_at';

// ── Finders ─────────────────────────────────────────────────
const findByEmail = (email) =>
  queryOne('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [email]);

const findByPhone = (phone) =>
  queryOne('SELECT * FROM users WHERE phone = $1', [phone]);

const findByGoogleId = (googleId) =>
  queryOne('SELECT * FROM users WHERE google_id = $1', [googleId]);

const findById = (id) =>
  queryOne('SELECT * FROM users WHERE id = $1', [id]);

const findPublicById = (id) =>
  queryOne(`SELECT ${PUBLIC_USER_COLUMNS} FROM users WHERE id = $1`, [id]);

const findAuthStateById = (id) =>
  queryOne('SELECT id, email, token_version FROM users WHERE id = $1', [id]);

// ── Create ───────────────────────────────────────────────────
const createUser = ({ name, email, phone, password, googleId, avatar, provider = 'local' }) =>
  queryOne(
    `INSERT INTO users (name, email, phone, password, google_id, avatar, provider)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING ${PUBLIC_USER_COLUMNS}`,
    [name, email ?? null, phone ?? null, password ?? null, googleId ?? null, avatar ?? null, provider]
  );

// ── Update (strict column allowlist prevents mass assignment) ──
const ALLOWED_UPDATE_FIELDS = new Set([
  'name',
  'email',
  'phone',
  'password',
  'google_id',
  'avatar',
  'provider',
  'token_version',
]);

const updateUser = (id, fields) => {
  const keys = Object.keys(fields).filter((k) => ALLOWED_UPDATE_FIELDS.has(k));
  if (keys.length === 0) return findPublicById(id);

  const values = keys.map((k) => fields[k]);
  const set = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');
  return queryOne(
    `UPDATE users SET ${set}, updated_at = NOW() WHERE id = $1 RETURNING ${PUBLIC_USER_COLUMNS}`,
    [id, ...values]
  );
};

const updatePasswordAndRotateTokens = (id, hashedPassword) =>
  queryOne(
    `UPDATE users
     SET password = $2,
         token_version = COALESCE(token_version, 0) + 1,
         updated_at = NOW()
     WHERE id = $1
     RETURNING ${PUBLIC_USER_COLUMNS}`,
    [id, hashedPassword]
  );

module.exports = {
  findByEmail,
  findByPhone,
  findByGoogleId,
  findById,
  findPublicById,
  findAuthStateById,
  createUser,
  updateUser,
  updatePasswordAndRotateTokens,
};
