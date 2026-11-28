const service = require('./upload.service');
const authRepo = require('../auth/auth.repository');
const { verifyToken } = require('../../utils/jwt');
const { verifyMediaSignature } = require('../../middlewares/security.middleware');
const { ok, created, badRequest, forbidden, notFound, serverError } = require('../../utils/response');

const SAFE_HOST_REGEX = /^[a-zA-Z0-9.-]+(:\d{1,5})?$/;

const getSafeRequestBaseUrl = (req) => {
  if (process.env.PUBLIC_API_URL) {
    return process.env.PUBLIC_API_URL.replace(/\/+$/, '');
  }
  const rawHost = req.get('host') || '';
  const safeHost = SAFE_HOST_REGEX.test(rawHost) ? rawHost : `localhost:${process.env.PORT || 3000}`;
  const proto = req.protocol === 'https' ? 'https' : 'http';
  return `${proto}://${safeHost}`;
};

const handleError = (res, err) => {
  if (err.status) return res.status(err.status).json({ success: false, message: err.message });
  return serverError(res, err);
};

// POST /api/upload/presign
const getPresignedUrl = async (req, res) => {
  const { mimeType, fileSize } = req.body;

  if (!mimeType || typeof mimeType !== 'string') return badRequest(res, 'mimeType is required');
  if (!fileSize || typeof fileSize !== 'number' || !Number.isFinite(fileSize)) {
    return badRequest(res, 'fileSize (number) is required');
  }

  try {
    const result = await service.getPresignedPutUrl(req.user.id, mimeType, fileSize);
    ok(res, result, result.useServerUpload ? 'Server upload requested' : 'Presigned URL ready');
  } catch (err) {
    handleError(res, err);
  }
};

// POST /api/upload/file
const uploadFile = async (req, res) => {
  if (!req.file) return badRequest(res, 'No file received');

  const { mimetype, buffer } = req.file;
  const host = getSafeRequestBaseUrl(req);

  try {
    const result = await service.uploadBuffer(req.user.id, mimetype, buffer, host);
    created(res, result, 'File uploaded');
  } catch (err) {
    handleError(res, err);
  }
};

// GET /api/upload/raw/* — requires valid HMAC signature OR owner Bearer JWT
const getRawFile = async (req, res) => {
  const key = req.params[0] || req.params.key;
  if (!key || !service.isSafeUploadKey(key)) {
    return badRequest(res, 'Invalid file key');
  }

  const { exp, sig } = req.query;
  let authorized = verifyMediaSignature(key, exp, sig);

  if (!authorized) {
    const header = req.headers.authorization;
    if (header && header.startsWith('Bearer ')) {
      try {
        const decoded = verifyToken(header.slice(7).trim());
        const user = decoded?.id ? await authRepo.findAuthStateById(decoded.id) : null;
        if (
          user &&
          (typeof decoded.tv !== 'number' || decoded.tv === (user.token_version ?? 0)) &&
          service.isUserUploadKey(user.id, key)
        ) {
          authorized = true;
        }
      } catch {
        authorized = false;
      }
    }
  }

  if (!authorized) {
    return forbidden(res, 'Unauthorized media access');
  }

  try {
    const result = await service.getObjectStream(key);
    if (!result) return notFound(res, 'File not found');

    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', 'inline');
    if (result.contentType) {
      res.setHeader('Content-Type', result.contentType);
    }
    res.setHeader('Cache-Control', 'private, max-age=3600');

    if (result.stream.pipe) {
      result.stream.pipe(res);
    } else {
      const { Readable } = require('stream');
      Readable.from(result.stream).pipe(res);
    }
  } catch (err) {
    handleError(res, err);
  }
};

// DELETE /api/upload
const deleteFile = async (req, res) => {
  const { key } = req.body;
  if (!key || typeof key !== 'string') return badRequest(res, 'key is required');

  if (!service.isUserUploadKey(req.user.id, key)) {
    return forbidden(res, 'Forbidden');
  }

  try {
    const result = await service.deleteObject(key);
    ok(res, result, 'File deleted');
  } catch (err) {
    handleError(res, err);
  }
};

module.exports = { getPresignedUrl, uploadFile, getRawFile, deleteFile };
