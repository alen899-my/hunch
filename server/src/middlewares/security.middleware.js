const crypto = require('crypto');

const RATE_STORE_MAX_KEYS = 10000;

/**
 * Derive an HMAC signing secret cleanly from JWT_SECRET (never empty).
 */
const getSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error('JWT_SECRET must be configured with at least 16 characters');
  }
  return secret;
};

/**
 * Security headers equivalent to Helmet defaults tuned for a JSON/media API.
 */
const securityHeaders = (_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
};

/**
 * Prevent caching of private API responses containing personal journal/user data.
 */
const noStoreApiCache = (req, res, next) => {
  if (!req.path.startsWith('/raw/')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
  }
  next();
};

/**
 * Create a sliding-window IP rate limiter with bounded memory usage.
 */
function createRateLimiter({ windowMs, max, keyPrefix = 'global', message }) {
  const hits = new Map();

  // Periodic cleanup to avoid unbounded memory growth under scan attacks
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits.entries()) {
      if (now >= entry.resetAt) hits.delete(key);
    }
  }, Math.max(windowMs, 60000));
  cleanupInterval.unref?.();

  return (req, res, next) => {
    const now = Date.now();
    const ip =
      req.ip ||
      req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() ||
      req.socket?.remoteAddress ||
      'unknown';
    const key = `${keyPrefix}:${ip}`;

    let entry = hits.get(key);
    if (!entry || now >= entry.resetAt) {
      if (hits.size >= RATE_STORE_MAX_KEYS) {
        const firstKey = hits.keys().next().value;
        if (firstKey) hits.delete(firstKey);
      }
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(key, entry);
    }

    entry.count += 1;

    const remaining = Math.max(0, max - entry.count);
    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(remaining));
    res.setHeader('X-RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));

    if (entry.count > max) {
      const retryAfterSecs = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retryAfterSecs));
      return res.status(429).json({
        success: false,
        message: message || 'Too many requests. Please try again shortly.',
      });
    }

    next();
  };
}

/**
 * Normalize query params to prevent HTTP Parameter Pollution crashes (array params instead of string).
 */
const preventParamPollution = (req, _res, next) => {
  if (req.query && typeof req.query === 'object') {
    for (const [k, v] of Object.entries(req.query)) {
      if (Array.isArray(v)) {
        req.query[k] = v[0];
      }
    }
  }
  next();
};

/**
 * Validate safe public HTTP(S) URLs (blocks javascript:, data:, file:, local SSRF hosts).
 */
function isSafeExternalUrl(raw) {
  if (typeof raw !== 'string') return false;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 1000) return false;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
    if (process.env.NODE_ENV === 'production' && parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    if (
      process.env.NODE_ENV === 'production' &&
      (host === 'localhost' ||
        host === '127.0.0.1' ||
        host === '::1' ||
        host.startsWith('10.') ||
        host.startsWith('192.168.') ||
        host === '169.254.169.254')
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Sign a raw media key using HMAC-SHA256 with expiry.
 */
function signMediaParams(key, ttlSeconds = 86400) {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const sig = crypto
    .createHmac('sha256', getSecret())
    .update(`${key}:${exp}`)
    .digest('hex')
    .slice(0, 32);
  return { exp: String(exp), sig };
}

/**
 * Verify an HMAC-signed media URL signature in constant time.
 */
function verifyMediaSignature(key, exp, sig) {
  if (!key || !exp || !sig || typeof sig !== 'string') return false;
  const expNum = Number(exp);
  if (!Number.isInteger(expNum) || expNum < Math.floor(Date.now() / 1000)) {
    return false;
  }
  if (!/^[a-f0-9]{32}$/i.test(sig)) return false;

  const expected = crypto
    .createHmac('sha256', getSecret())
    .update(`${key}:${expNum}`)
    .digest('hex')
    .slice(0, 32);

  try {
    return crypto.timingSafeEqual(Buffer.from(sig, 'utf8'), Buffer.from(expected, 'utf8'));
  } catch {
    return false;
  }
}

/**
 * Safely extract and URL-decode the storage key from a /api/upload/raw/ URL.
 */
function extractRawMediaKey(rawUrl) {
  if (typeof rawUrl !== 'string') return null;
  const marker = '/api/upload/raw/';
  const idx = rawUrl.indexOf(marker);
  if (idx === -1) return null;

  const baseAndPath = rawUrl.split('?')[0];
  try {
    const decoded = decodeURIComponent(baseAndPath.slice(idx + marker.length));
    return decoded || null;
  } catch {
    return null;
  }
}

/**
 * Attach fresh signed query params to any URL pointing at /api/upload/raw/...
 */
function attachMediaSignature(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return rawUrl;
  const key = extractRawMediaKey(rawUrl);
  if (!key || key.includes('..') || key.includes('\\')) return rawUrl;

  const baseAndPath = rawUrl.split('?')[0];
  const { exp, sig } = signMediaParams(key);
  return `${baseAndPath}?exp=${exp}&sig=${sig}`;
}

/**
 * Sign any /api/upload/raw/ URL inside serialized attachment thought content when owned by userId.
 */
function signAttachmentThoughtContent(userId, content) {
  if (typeof content !== 'string') return content;
  const trimmed = content.trim();
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return content;

  try {
    const parsed = JSON.parse(trimmed);
    const isAttachment = parsed?.type === 'attachment' || parsed?.__attachment === true;
    if (isAttachment && typeof parsed.publicUrl === 'string') {
      const rawKey = extractRawMediaKey(parsed.publicUrl);
      if (parsed.publicUrl.includes('/api/upload/raw/')) {
        if (
          !rawKey ||
          rawKey.includes('..') ||
          rawKey.includes('\\') ||
          !rawKey.startsWith(`uploads/${userId}/`)
        ) {
          return content;
        }
      }
      parsed.publicUrl = attachMediaSignature(parsed.publicUrl);
      return JSON.stringify(parsed);
    }
  } catch {
    // ignore non-JSON content
  }
  return content;
}

module.exports = {
  securityHeaders,
  noStoreApiCache,
  createRateLimiter,
  preventParamPollution,
  isSafeExternalUrl,
  extractRawMediaKey,
  signMediaParams,
  verifyMediaSignature,
  attachMediaSignature,
  signAttachmentThoughtContent,
};
