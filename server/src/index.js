require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { testConnection } = require('./db/pool');
const {
  securityHeaders,
  noStoreApiCache,
  createRateLimiter,
  preventParamPollution,
} = require('./middlewares/security.middleware');

const authRoutes = require('./features/auth/auth.routes');
const thoughtsRoutes = require('./features/thoughts/thoughts.routes');
const uploadRoutes = require('./features/upload/upload.routes');
const peopleRoutes = require('./features/people/people.routes');

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 16) {
  console.error('❌ FATAL: JWT_SECRET must be configured with at least 16 characters');
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';

app.disable('x-powered-by');
app.set('trust proxy', 1);

// ── Strict CORS Allowlist ────────────────────────────────────
const configuredOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const isAllowedOrigin = (origin) => {
  // Non-browser clients (native mobile apps, server tools) omit Origin
  if (!origin) return true;
  if (configuredOrigins.includes(origin)) return true;

  if (!IS_PROD) {
    try {
      const parsed = new URL(origin);
      const host = parsed.hostname.toLowerCase();
      if (host === 'localhost' || host === '127.0.0.1' || host.endsWith('.exp.direct')) {
        return true;
      }
    } catch {
      return false;
    }
  }
  return false;
};

app.use(securityHeaders);
app.use(
  cors({
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) return callback(null, true);
      const corsErr = new Error('Origin not allowed by CORS policy');
      corsErr.status = 403;
      return callback(corsErr);
    },
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: false,
    maxAge: 600,
  })
);

app.use(express.json({ limit: '256kb' }));
app.use(express.urlencoded({ extended: false, limit: '256kb' }));
app.use(preventParamPollution);

// Global API rate limiting + no-store private cache headers
const apiLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000,
  max: 300,
  keyPrefix: 'api',
});
app.use('/api', apiLimiter, noStoreApiCache);

// ── Routes ──────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/thoughts', thoughtsRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/people', peopleRoutes);

// ── Health check ────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok' }));
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

// ── 404 handler ─────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ success: false, message: 'Route not found' }));

// ── Safe Global Error Handler (never leaks stack traces) ────
app.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ success: false, message: 'Uploaded file exceeds maximum allowed size' });
    }
    return res.status(400).json({ success: false, message: 'Invalid multipart upload' });
  }
  if (err?.type === 'entity.parse.failed' || err instanceof SyntaxError) {
    return res.status(400).json({ success: false, message: 'Invalid JSON payload' });
  }
  if (err?.status) {
    return res.status(err.status).json({ success: false, message: err.message });
  }
  console.error('Unhandled API error:', err?.message || err);
  return res.status(500).json({ success: false, message: 'Internal server error' });
});

// ── Start ────────────────────────────────────────────────────
app.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT}`);
  await testConnection();
});
