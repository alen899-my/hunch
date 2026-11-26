const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

const BUCKET = process.env.R2_BUCKET || 'hunch';
const PUBLIC_URL_BASE = process.env.R2_PUBLIC_URL; // e.g. https://pub-xxx.r2.dev or custom domain

// Check if real Cloudflare R2 credentials are configured
function hasValidR2Credentials() {
  const key = process.env.R2_ACCESS_KEY_ID;
  const secret = process.env.R2_SECRET_ACCESS_KEY;
  return Boolean(
    key &&
    secret &&
    !key.includes('your_r2_access_key') &&
    !secret.includes('your_r2_secret') &&
    key.length > 5 &&
    secret.length > 5
  );
}

// Lazy R2 client instantiation
let _r2Client = null;
function getR2() {
  if (!hasValidR2Credentials()) return null;
  if (!_r2Client) {
    _r2Client = new S3Client({
      region: 'auto',
      endpoint: process.env.R2_ENDPOINT,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      },
    });
  }
  return _r2Client;
}

// ── Allowed types ──────────────────────────────────────────────
const ALLOWED_MIME = {
  image: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'],
  video: ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm'],
  audio: ['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/ogg', 'audio/aac', 'audio/x-m4a', 'audio/webm'],
};

const SIZE_LIMITS = {
  image: 10 * 1024 * 1024,  // 10 MB
  video: 200 * 1024 * 1024, // 200 MB
  audio: 50 * 1024 * 1024,  // 50 MB
};

const EXTENSIONS = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/x-msvideo': 'avi',
  'video/webm': 'webm',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/wav': 'wav',
  'audio/ogg': 'ogg',
  'audio/aac': 'aac',
  'audio/x-m4a': 'm4a',
  'audio/webm': 'weba',
};

function getMimeCategory(mimeType) {
  for (const [cat, types] of Object.entries(ALLOWED_MIME)) {
    if (types.includes(mimeType)) return cat;
  }
  return null;
}

function buildKey(userId, category, mimeType) {
  const ext = EXTENSIONS[mimeType] || 'bin';
  return `uploads/${userId}/${category}/${uuidv4()}.${ext}`;
}

// ── Generate a presigned PUT URL (client uploads directly to R2) ──
async function getPresignedPutUrl(userId, mimeType, fileSizeBytes) {
  const category = getMimeCategory(mimeType);
  if (!category) throw { status: 400, message: `Unsupported file type: ${mimeType}` };

  const limit = SIZE_LIMITS[category];
  if (fileSizeBytes > limit) {
    throw {
      status: 400,
      message: `File too large. Max ${limit / 1024 / 1024} MB for ${category}`,
    };
  }

  const r2 = getR2();
  if (!r2) {
    // Graceful fallback to server-side multipart upload if R2 keys are not yet provided
    return {
      useServerUpload: true,
      category,
      mimeType,
      message: 'R2 credentials not set in server/.env, use server upload route',
    };
  }

  const key = buildKey(userId, category, mimeType);
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: mimeType,
  });

  const url = await getSignedUrl(r2, command, { expiresIn: 300 });
  const publicUrl = PUBLIC_URL_BASE
    ? `${PUBLIC_URL_BASE}/${key}`
    : `${process.env.R2_ENDPOINT}/${BUCKET}/${key}`;

  return { uploadUrl: url, key, publicUrl, category, mimeType, useServerUpload: false };
}

// ── Upload a buffer directly from server ───────────────────────
async function uploadBuffer(userId, mimeType, buffer, reqHost = '') {
  const category = getMimeCategory(mimeType);
  if (!category) throw { status: 400, message: `Unsupported file type: ${mimeType}` };

  const limit = SIZE_LIMITS[category];
  if (buffer.length > limit) {
    throw {
      status: 400,
      message: `File too large. Max ${limit / 1024 / 1024} MB for ${category}`,
    };
  }

  const key = buildKey(userId, category, mimeType);
  const r2 = getR2();

  if (r2) {
    // ── Upload to Cloudflare R2
    await r2.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
      })
    );

    const publicUrl = PUBLIC_URL_BASE
      ? `${PUBLIC_URL_BASE}/${key}`
      : `${reqHost || 'http://10.62.124.145:3000'}/api/upload/raw/${key}`;

    return { key, publicUrl, category, mimeType, size: buffer.length };
  } else {
    // ── Local disk fallback while user adds R2 credentials
    const localDir = path.join(__dirname, '../../../uploads', path.dirname(key));
    fs.mkdirSync(localDir, { recursive: true });
    const localPath = path.join(__dirname, '../../../uploads', key);
    fs.writeFileSync(localPath, buffer);

    const publicUrl = `${reqHost || 'http://10.62.124.145:3000'}/api/upload/raw/${key}`;
    return { key, publicUrl, category, mimeType, size: buffer.length, localFallback: true };
  }
}

// ── Fetch object stream (from R2 or local disk) ────────────────
async function getObjectStream(key) {
  const r2 = getR2();
  if (r2) {
    try {
      const data = await r2.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
      return { stream: data.Body, contentType: data.ContentType };
    } catch {
      // Fall through to local
    }
  }

  const localPath = path.join(__dirname, '../../../uploads', key);
  if (fs.existsSync(localPath)) {
    return { stream: fs.createReadStream(localPath), contentType: 'application/octet-stream' };
  }

  return null;
}

// ── Delete an object ───────────────────────────────────────────
async function deleteObject(key) {
  const r2 = getR2();
  if (r2) {
    await r2.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
  }
  const localPath = path.join(__dirname, '../../../uploads', key);
  if (fs.existsSync(localPath)) {
    fs.unlinkSync(localPath);
  }
  return { deleted: true, key };
}

module.exports = {
  getPresignedPutUrl,
  uploadBuffer,
  getObjectStream,
  deleteObject,
  getMimeCategory,
  hasValidR2Credentials,
  ALLOWED_MIME,
  SIZE_LIMITS,
};
