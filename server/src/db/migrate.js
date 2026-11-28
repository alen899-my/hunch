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
    token_version INT NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
  );

  ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INT NOT NULL DEFAULT 0;

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
  CREATE INDEX IF NOT EXISTS idx_thoughts_user_day_created ON thoughts(user_id, day_date, created_at DESC);

  ALTER TABLE thoughts ADD COLUMN IF NOT EXISTS is_starred BOOLEAN NOT NULL DEFAULT FALSE;
  ALTER TABLE thoughts ADD COLUMN IF NOT EXISTS mood TEXT;
  ALTER TABLE thoughts ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}';
  ALTER TABLE thoughts ADD COLUMN IF NOT EXISTS reply_to_id UUID REFERENCES thoughts(id) ON DELETE SET NULL;

  CREATE INDEX IF NOT EXISTS idx_thoughts_tags ON thoughts USING GIN (tags);
  CREATE INDEX IF NOT EXISTS idx_thoughts_user_starred ON thoughts(user_id, is_starred) WHERE is_starred = TRUE;

  CREATE TABLE IF NOT EXISTS people (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID REFERENCES users(id) ON DELETE CASCADE,
    name         TEXT NOT NULL,
    handle       TEXT NOT NULL,
    avatar_url   TEXT,
    avatar_key   TEXT,
    relationship TEXT,
    notes        TEXT,
    birthday     TEXT,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    updated_at   TIMESTAMPTZ DEFAULT NOW()
  );

  ALTER TABLE people ADD COLUMN IF NOT EXISTS relationship TEXT;
  ALTER TABLE people ADD COLUMN IF NOT EXISTS notes TEXT;
  ALTER TABLE people ADD COLUMN IF NOT EXISTS birthday TEXT;

  CREATE INDEX IF NOT EXISTS idx_people_user ON people(user_id);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_people_user_handle ON people(user_id, LOWER(handle));

  CREATE TABLE IF NOT EXISTS thought_mentions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thought_id  UUID NOT NULL REFERENCES thoughts(id) ON DELETE CASCADE,
    person_id   UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(thought_id, person_id)
  );

  CREATE INDEX IF NOT EXISTS idx_thought_mentions_person ON thought_mentions(person_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_thought_mentions_person_user ON thought_mentions(person_id, user_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_thought_mentions_thought ON thought_mentions(thought_id);

  INSERT INTO users (id, name, email, provider)
  VALUES ('00000000-0000-0000-0000-000000000000', 'Guest', 'guest@hunch.local', 'local')
  ON CONFLICT (id) DO NOTHING;
`;

(async () => {
  try {
    await pool.query(createTables);
    console.log('✅ Database tables ready (users, thoughts, people, thought_mentions)');
  } catch (err) {
    console.error('Migration failed:', err.message);
  } finally {
    await pool.end();
  }
})();
