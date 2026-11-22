const service = require('./upload.service');
const { ok, created, badRequest, notFound, serverError } = require('../../utils/response');

const handleError = (res, err) => {
  if (err.status) return res.status(err.status).json({ success: false, message: err.message });
  return serverError(res, err);
};

// POST /api/upload/presign
const getPresignedUrl = async (req, res) => {
  const { mimeType, fileSize } = req.body;

  if (!mimeType) return badRequest(res, 'mimeType is required');
  if (!fileSize || typeof fileSize !== 'number') return badRequest(res, 'fileSize (number) is required');

  try {
    const result = await service.getPresignedPutUrl(req.user.id, mimeType, fileSize);
    ok(res, result, result.useServerUpload ? 'Server fallback requested' : 'Presigned URL ready');
  } catch (err) {
    handleError(res, err);
  }
};

// POST /api/upload/file
const uploadFile = async (req, res) => {
  if (!req.file) return badRequest(res, 'No file received');

  const { mimetype, buffer } = req.file;
  const host = `${req.protocol}://${req.get('host')}`;

  try {
    const result = await service.uploadBuffer(req.user.id, mimetype, buffer, host);
    created(res, result, 'File uploaded');
  } catch (err) {
    handleError(res, err);
  }
};

// GET /api/upload/raw/:key(*)
const getRawFile = async (req, res) => {
  const key = req.params[0] || req.params.key;
  if (!key) return badRequest(res, 'key is required');

  try {
    const result = await service.getObjectStream(key);
    if (!result) return notFound(res, 'File not found');

    if (result.contentType) {
      res.setHeader('Content-Type', result.contentType);
    }
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');

    if (result.stream.pipe) {
      result.stream.pipe(res);
    } else {
      // ReadableStream (Node 18+)
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
  if (!key) return badRequest(res, 'key is required');

  if (!key.startsWith(`uploads/${req.user.id}/`)) {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }

  try {
    const result = await service.deleteObject(key);
    ok(res, result, 'File deleted');
  } catch (err) {
    handleError(res, err);
  }
};

module.exports = { getPresignedUrl, uploadFile, getRawFile, deleteFile };
