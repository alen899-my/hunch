const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  keepAlive: true,
});

// Run raw SQL — returns rows array
const query = (sql, params) => pool.query(sql, params).then((r) => r.rows);

// Get first row or null
const queryOne = (sql, params) => query(sql, params).then((rows) => rows[0] ?? null);

const testConnection = async () => {
  try {
    await pool.query('SELECT 1');
    console.log('✅ PostgreSQL connected');
  } catch (err) {
    console.error('❌ PostgreSQL connection failed:', err.message);
  }
};

module.exports = { pool, query, queryOne, testConnection };
