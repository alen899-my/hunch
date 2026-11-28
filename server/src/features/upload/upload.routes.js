const router = require('express').Router();
const multer = require('multer');
const controller = require('./upload.controller');
const { protect } = require('../../middlewares/auth.middleware');
const { createRateLimiter } = require('../../middlewares/security.middleware');

// Store file in memory within bounded upload size limit
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 200 * 1024 * 1024, // 200 MB
    files: 1,
    fields: 5,
  },
});

const uploadLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 60,
  keyPrefix: 'upload',
  message: 'Too many uploads. Please wait a few minutes and try again.',
});

// GET /api/upload/raw/* — gated by HMAC media signature or authenticated owner Bearer JWT
router.get('/raw/*', controller.getRawFile);

// All mutating upload endpoints require strict JWT authentication + rate limiting
router.use(protect, uploadLimiter);

// POST /api/upload/presign — get a presigned PUT URL for direct-to-R2 upload
router.post('/presign', controller.getPresignedUrl);

// POST /api/upload/file — server-side multipart upload to R2/local
router.post('/file', upload.single('file'), controller.uploadFile);

// DELETE /api/upload — remove a file owned by current user
router.delete('/', controller.deleteFile);

module.exports = router;
