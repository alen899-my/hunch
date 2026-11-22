const router = require('express').Router();
const multer = require('multer');
const controller = require('./upload.controller');
const { optionalOrGuestProtect } = require('../../middlewares/auth.middleware');

// Store file in memory (buffer)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 200 * 1024 * 1024, // 200 MB
  },
});

// GET /api/upload/raw/* — public raw file stream for images, videos, audio notes
router.get('/raw/*', controller.getRawFile);

// All mutating routes require auth (or guest fallback)
router.use(optionalOrGuestProtect);

// POST /api/upload/presign — get a presigned PUT URL for direct-to-R2 upload
router.post('/presign', controller.getPresignedUrl);

// POST /api/upload/file — server-side multipart upload to R2
router.post('/file', upload.single('file'), controller.uploadFile);

// DELETE /api/upload — remove a file
router.delete('/', controller.deleteFile);

module.exports = router;
