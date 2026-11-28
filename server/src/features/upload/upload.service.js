const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const { attachMediaSignature } = require('../../middlewares/security.middleware');

const BUCKET = process.env.R2_BUCKET || 'hunch';
const PUBLIC_URL_BASE = process.env.R2_PUBLIC_URL;
const UPLOAD_ROOT = path.resolve(__dirname, '../../../uploads');

const SAFE_KEY_REGEX =
  /^uploads\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/(image|video|audio)\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp|gif|heic|heif|mp4|mov|avi|webm|mp3|m4a|wav|ogg|aac|weba)$/i;

const isSafeUploadKey = (key) =>
  typeof key === 'string' &&
  !key.includes('..') &&
  !key.includes('\\') &&
  !key.includes('\0') &&
  SAFE_KEY_REGEX.test(key);

const isUserUploadKey = (userId, key) =>
  Boolean(userId) && isSafeUploadKey(key) && key.startsWith(`uploads/${userId}/`);

function resolveSafeLocalPath(key) {
  if (!isSafeUploadKey(key)) return null;
  const resolved = path.resolve(UPLOAD_ROOT, key);
  if (!resolved.startsWith(UPLOAD_ROOT + path.sep)) return null;
  return resolved;
}

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

const ALLOWED_MIME = {
  image: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'],
  video: ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm'],
  audio: ['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/ogg', 'audio/aac', 'audio/x-m4a', 'audio/webm'],
};

const ALL_ALLOWED_MIMES = new Set(Object.values(ALLOWED_MIME).flat());

const SIZE_LIMITS = {
  image: 10 * 1024 * 1024,
  video: 200 * 1024 * 1024,
  audio: 50 * 1024 * 1024,
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

const EXT_TO_MIME = Object.entries(EXTENSIONS).reduce((acc, [mime, ext]) => {
  if (!acc[ext]) acc[ext] = mime;
  return acc;
}, {});

function getMimeCategory(mimeType) {
  for (const [cat, types] of Object.entries(ALLOWED_MIME)) {
    if (types.includes(mimeType)) return cat;
  }
  return null;
}

/**
 * Inspect magic bytes of uploaded buffers so attackers cannot disguise HTML/JS/executables as media.
 */
function matchesMediaSignature(mimeType, buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 4) return false;
  const b = buffer;

  switch (mimeType) {
    case 'image/jpeg':
      return b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
    case 'image/png':
      return b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
    case 'image/gif':
      return b.slice(0, 6).toString('ascii') === 'GIF87a' || b.slice(0, 6).toString('ascii') === 'GIF89a';
    case 'image/webp':
      return b.length >= 12 && b.slice(0, 4).toString('ascii') === 'RIFF' && b.slice(8, 12).toString('ascii') === 'WEBP';
    case 'image/heic':
    case 'image/heif':
    case 'video/mp4':
    case 'video/quicktime':
    case 'audio/mp4':
    case 'audio/x-m4a':
      return b.length >= 8 && b.slice(4, 8).toString('ascii') === 'ftyp';
    case 'video/x-msvideo':
      return b.length >= 12 && b.slice(0, 4).toString('ascii') === 'RIFF' && b.slice(8, 12).toString('ascii') === 'AVI ';
    case 'audio/wav':
      return b.length >= 12 && b.slice(0, 4).toString('ascii') === 'RIFF' && b.slice(8, 12).toString('ascii') === 'WAVE';
    case 'audio/ogg':
      return b.slice(0, 4).toString('ascii') === 'OggS';
    case 'video/webm':
    case 'audio/webm':
      return b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3;
    case 'audio/mpeg':
      return b.slice(0, 3).toString('ascii') === 'ID3' || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0);
    case 'audio/aac':
      return (b[0] === 0xff && (b[1] & 0xf0) === 0xf0) || b.slice(0, 4).toString('ascii') === 'ADIF';
    default:
      return false;
  }
}

function buildKey(userId, category, mimeType) {
  const ext = EXTENSIONS[mimeType] || 'bin';
  return `uploads/${userId}/${category}/${uuidv4()}.${ext}`;
}

async function getPresignedPutUrl(userId, mimeType, fileSizeBytes) {
  const category = getMimeCategory(mimeType);
  if (!category) throw { status: 400, message: `Unsupported file type: ${mimeType}` };

  const limit = SIZE_LIMITS[category];
  if (fileSizeBytes <= 0 || fileSizeBytes > limit) {
    throw {
      status: 400,
      message: `File size invalid or exceeds max ${limit / 1024 / 1024} MB for ${category}`,
    };
  }

  const r2 = getR2();
  if (!r2) {
    return {
      useServerUpload: true,
      category,
      mimeType,
      message: 'Direct upload disabled, using authenticated server upload',
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

async function uploadBuffer(userId, mimeType, buffer, reqHost = '') {
  const category = getMimeCategory(mimeType);
  if (!category) throw { status: 400, message: `Unsupported file type: ${mimeType}` };

  const limit = SIZE_LIMITS[category];
  if (!buffer || buffer.length === 0 || buffer.length > limit) {
    throw {
      status: 400,
      message: `File empty or too large. Max ${limit / 1024 / 1024} MB for ${category}`,
    };
  }

  if (!matchesMediaSignature(mimeType, buffer)) {
    throw {
      status: 400,
      message: 'File content does not match declared media type',
    };
  }

  const key = buildKey(userId, category, mimeType);
  const r2 = getR2();
  const baseApiUrl = process.env.PUBLIC_API_URL || reqHost;

  if (r2) {
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
      : attachMediaSignature(`${baseApiUrl}/api/upload/raw/${key}`);

    return { key, publicUrl, category, mimeType, size: buffer.length };
  }

  const localPath = resolveSafeLocalPath(key);
  if (!localPath) throw { status: 400, message: 'Invalid storage path' };

  fs.mkdirSync(path.dirname(localPath), { recursive: true });
  fs.writeFileSync(localPath, buffer);

  const publicUrl = attachMediaSignature(`${baseApiUrl}/api/upload/raw/${key}`);
  return { key, publicUrl, category, mimeType, size: buffer.length, localFallback: true };
}

async function getObjectStream(key) {
  if (!isSafeUploadKey(key)) return null;

  const r2 = getR2();
  if (r2) {
    try {
      const data = await r2.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
      const safeType = ALL_ALLOWED_MIMES.has(data.ContentType)
        ? data.ContentType
        : EXT_TO_MIME[path.extname(key).slice(1).toLowerCase()] || 'application/octet-stream';
      return { stream: data.Body, contentType: safeType };
    } catch {
      // Fall through to safe local lookup
    }
  }

  const localPath = resolveSafeLocalPath(key);
  if (localPath && fs.existsSync(localPath)) {
    const ext = path.extname(localPath).slice(1).toLowerCase();
    return {
      stream: fs.createReadStream(localPath),
      contentType: EXT_TO_MIME[ext] || 'application/octet-stream',
    };
  }

  return null;
}

async function deleteObject(key) {
  if (!isSafeUploadKey(key)) {
    throw { status: 400, message: 'Invalid file key' };
  }
  const r2 = getR2();
  if (r2) {
    await r2.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
  }
  const localPath = resolveSafeLocalPath(key);
  if (localPath && fs.existsSync(localPath)) {
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
  isSafeUploadKey,
  isUserUploadKey,
  ALLOWED_MIME,
  SIZE_LIMITS,
};
