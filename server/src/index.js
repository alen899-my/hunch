require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { testConnection } = require('./db/pool');

const authRoutes = require('./features/auth/auth.routes');
const thoughtsRoutes = require('./features/thoughts/thoughts.routes');
const uploadRoutes = require('./features/upload/upload.routes');
const peopleRoutes = require('./features/people/people.routes');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ──────────────────────────────────────────────
app.use(cors());
app.use(express.json());

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

// ── Start ────────────────────────────────────────────────────
app.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT}`);
  await testConnection();
});
