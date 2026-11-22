/**
 * Run this once to create the users table.
 * Usage: node src/db/migrate.js
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const { pool } = require('./pool');

const createTables = `
  CREATE TABLE IF NOT EXISTS users (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT,
    email       TEXT UNIQUE,
    phone       TEXT UNIQUE,
    password    TEXT,                        -- null for Google-only accounts
    google_id   TEXT UNIQUE,
    avatar      TEXT,
    provider    TEXT NOT NULL DEFAULT 'local', -- 'local' | 'google'
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS thoughts (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
    day_date    DATE NOT NULL,
    content     TEXT NOT NULL,
    category    TEXT NOT NULL DEFAULT 'thinking',
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS idx_thoughts_user_day ON thoughts(user_id, day_date);

  INSERT INTO users (id, name, email, provider)
  VALUES ('00000000-0000-0000-0000-000000000000', 'Guest', 'guest@hunch.local', 'local')
  ON CONFLICT (id) DO NOTHING;
`;

(async () => {
  try {
    await pool.query(createTables);
    console.log('✅ Database tables ready (users, thoughts)');
  } catch (err) {
    console.error('Migration failed:', err.message);
  } finally {
    await pool.end();
  }
})();
